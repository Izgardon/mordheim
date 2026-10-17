"""Completing a trade once both sides have locked: both offers' stash items and gold change hands, or nothing.

Runs in the lock's transaction with the trade row locked; both warbands are locked too (lowest id first). The
trader is only checked to still be on the roster: locking spent his trading action (BUG-05).
"""

from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.trades.models import TradeRequest
from apps.warbands.models import Hero, Warband, on_roster
from apps.warbands.services import ledger
from apps.warbands.services.stash import StashShortage, add_to_stash, remove_from_stash
from apps.warbands.services.summary import warband_gold

from .errors import TradeError
from .offers import requested_items, stored_offer
from .traders import SIDES

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


def _move_items(trade: TradeRequest, side: str, offer: dict[str, Any]) -> None:
    source = getattr(trade, f"{side}_warband_id")
    target = getattr(trade, f"{_other(side)}_warband_id")
    for item_id, quantity in requested_items(offer["items"]).items():
        try:
            taken = remove_from_stash(source, item_id, quantity)
        except StashShortage as shortage:
            detail = "Not enough quantity for one or more items."
            if not shortage.held:
                detail = "One or more items are not in the warchest."
            raise TradeError(detail, status=409, code=FAILED, warband_id=source) from shortage
        # the copies keep their cost (BUG-40); a row the receiver already prices keeps its own
        add_to_stash(target, item_id, quantity, taken.cost, keep_cost=True)


def _record_gold(trade: TradeRequest, offers: dict[str, dict[str, Any]]) -> None:
    """Each side's gold leaves its ledger and enters the other's (both balances in one statement)."""
    entries = []
    for side in SIDES:
        gold = offers[side]["gold"]
        if not gold:
            continue
        sender, receiver = getattr(trade, f"{side}_warband"), getattr(trade, f"{_other(side)}_warband")
        entries.append(ledger.Entry(sender, "Trade sent", -gold, f"Gold sent to {receiver.name}"))
        entries.append(ledger.Entry(receiver, "Trade received", gold, f"Gold received from {sender.name}"))
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
    trade.from_offer, trade.to_offer = offers["from"], offers["to"]
    trade.status = TradeRequest.STATUS_COMPLETED
    trade.responded_at = timezone.now()
    trade.save(update_fields=["status", "responded_at", "from_offer", "to_offer"])
