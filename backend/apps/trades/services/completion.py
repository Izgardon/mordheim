"""Completing a trade once both sides have locked: both offers' stash items and gold change hands, or nothing.

Runs in the lock's transaction with the trade row locked; both warbands are locked too (lowest id first). Each
side's trader must still be on the roster (BUG-05); his trading action is spent here, once the trade can no longer
fail (decision 9). An item edited or reverted in the campaign since the offer moves under its current id.
"""

from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.core.catalogue.current import resolve
from apps.items.models import Item
from apps.trades.models import TradeRequest
from apps.warbands.models import Hero, LedgerAction, Warband, on_roster
from apps.warbands.services import economy_log, ledger
from apps.warbands.services.stash import StashShortage, StashTake, add_costs, remove_from_stash
from apps.warbands.services.summary import warband_gold

from .errors import TradeError
from .offers import requested_items, stored_offer
from .traders import SIDES, spend_traders

FAILED = "trade_completion_failed"


def _other(side: str) -> str:
    return "to" if side == "from" else "from"


def _check_side(trade: TradeRequest, side: str, offer: dict[str, Any]) -> None:
    warband_id = getattr(trade, f"{side}_warband_id")
    trader_id = offer["trader_id"]
    if trader_id is not None and not on_roster(Hero.objects.filter(id=trader_id, warband_id=warband_id)).exists():
        raise TradeError("Trader not found.", status=409, code=FAILED, warband_id=warband_id)
    if offer["gold"] and offer["gold"] > max(warband_gold(warband_id), 0):
        raise TradeError("Not enough gold.", status=409, code=FAILED, warband_id=warband_id)


def _take(trade: TradeRequest, source: int, item_id: int, quantity: int) -> tuple[int, StashTake]:
    """Take the offered copies out of the source's stash; the item id they left under, and what was taken. An item
    the campaign edited or reverted since the offer (its copies moved to the version, or back to the book) is taken
    under its current id, which only that case reads (CAT-TWEAK-03)."""
    try:
        return item_id, remove_from_stash(source, item_id, quantity)
    except StashShortage as shortage:
        rows = Item.objects.only("id", "campaign_id", "replaces_id")
        current = None if shortage.held else resolve(rows, "items", [item_id], trade.campaign_id).get(item_id)
        if current is not None and current.id != item_id:
            return _take(trade, source, current.id, quantity)
        detail = "Not enough quantity for one or more items."
        if not shortage.held:
            detail = "One or more items are not in the warchest."
        raise TradeError(detail, status=409, code=FAILED, warband_id=source) from shortage


def _move_items(trade: TradeRequest, side: str, offer: dict[str, Any]) -> None:
    source = getattr(trade, f"{side}_warband_id")
    target = getattr(trade, f"{_other(side)}_warband_id")
    for offered_id, quantity in requested_items(offer["items"]).items():
        item_id, taken = _take(trade, source, offered_id, quantity)
        # each copy keeps its cost (BUG-40, BUG-117), beside the receiver's own copies
        add_costs(target, item_id, taken.costs)


def _record_gold(trade: TradeRequest, offers: dict[str, dict[str, Any]]) -> None:
    """Each side's gold leaves its ledger and enters the other's (both balances in one statement)."""
    entries = []
    for side in SIDES:
        gold = offers[side]["gold"]
        if not gold:
            continue
        sender, receiver = getattr(trade, f"{side}_warband"), getattr(trade, f"{_other(side)}_warband")
        entries.append(ledger.Entry(sender, LedgerAction.TRADE, -gold, f"Gold sent to {receiver.name}"))
        entries.append(ledger.Entry(receiver, LedgerAction.TRADE, gold, f"Gold received from {sender.name}"))
    ledger.record_entries(entries)


def complete_trade(trade: TradeRequest) -> None:
    """Move both offers and mark the trade completed; TradeError (409) when a side's trader has left the roster
    or the side no longer has the gold or stash items it offered. Nothing has moved when it raises."""
    warband_ids = [trade.from_warband_id, trade.to_warband_id]
    list(Warband.objects.select_for_update().filter(id__in=warband_ids).order_by("id").values_list("id"))
    offers = {side: stored_offer(getattr(trade, f"{side}_offer")) for side in SIDES}
    for side in SIDES:
        _check_side(trade, side, offers[side])
    if any(offers[side]["items"] for side in SIDES):
        with transaction.atomic():  # a savepoint: the second side's shortage undoes the first side's move
            for side in SIDES:
                _move_items(trade, side, offers[side])
    _record_gold(trade, offers)
    economy_log.log_completed_trade({side: (getattr(trade, f"{side}_warband"), offers[side]) for side in SIDES})
    spend_traders(trade, offers)  # after every check and move: nothing can fail past this point
    trade.from_offer, trade.to_offer = offers["from"], offers["to"]
    trade.status = TradeRequest.STATUS_COMPLETED
    trade.responded_at = timezone.now()
    changed = ["status", "responded_at", "from_offer", "to_offer", "from_trader_spent", "to_trader_spent"]
    trade.save(update_fields=changed)
