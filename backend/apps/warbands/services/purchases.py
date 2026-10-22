"""Buying (or being given) items, written on the server in one transaction (BUG-07; decisions 1, 2, 9 and 11).

A purchase appends its copies to the unit (`kind.items`) or the stash, never replacing a list; writes its "Buy"
ledger row and its loadout log entry; and saves the rarity roll that found the item, spending the searching
hero's trading action. Nothing is refused for game reasons (decisions 2 and 9): gold may go below 0 and a hero
who already used his trading action may search again; each comes back as a warning (the client showed it before
it confirmed). With no price sent, a copy costs the item's current campaign price (decision 11, "Buy again").

Refusals are RosterErrors in the standard shape, their field keys prefixed with the line's key in a batch.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from django.db import transaction

from apps.items.models import Item
from apps.warbands.models import LedgerAction, RosterUnit, Warband, WarbandTrade
from apps.warbands.units.errors import RosterError

from . import economy_log, ledger
from .prices import CampaignPrices
from .rarity_rolls import RollRefused, record_roll
from .stash import add_to_stash
from .unit_items import add_unit_copies, resolve_unit

Warning = dict[str, Any]  # {"code", "message", ...}, the shape trades answer
GOLD_NEGATIVE = "gold_negative"
ARCHIVED_ENTRY = "archived_entry"
STASH = "stash"
LOG_ENTRY = {
    "hero": "hero_item",
    "henchmen_group": "henchmen_item",
    "hireling": "hireling_item",
    STASH: "stash_item",
}


@dataclass
class Line:
    item: Item
    target_type: str
    unit: RosterUnit | None  # None for the stash
    data: Mapping[str, Any]  # a validated purchase line
    price: int | None  # one copy's cost (resolved by `price_line`)
    key: str = ""  # the line's place in a batch ("purchases.0"), for error keys

    @property
    def total(self) -> int:
        return (self.price or 0) * self.data["quantity"] if self.data["is_buying"] else 0


def archived_entry(item: Item) -> Warning:
    """An item bought from a list read before it was archived, or removed from the campaign's catalogue: the purchase
    goes through and says so (decision 5)."""
    message = f"{item.name} is archived in this campaign's catalogue; it was bought anyway."
    return {"code": ARCHIVED_ENTRY, "message": message, "item_id": item.id}


def refused(key: str, name: str, message: str) -> RosterError:
    return RosterError(message, "invalid", {f"{key}.{name}" if key else name: [message]})


def price_line(warband: Warband, item: Item, data: Mapping[str, Any], key: str = "") -> int | None:
    """One copy's cost: the price sent, else the availability sent, else the current campaign price."""
    if data.get("price") is not None:
        price: int | None = int(data["price"])
    elif data.get("availability_id") is not None:
        price = CampaignPrices(warband.campaign_id).availability_price(item, data["availability_id"])
        if price is None:
            raise refused(key, "availability_id", "Not one of this item's availabilities.")
    else:
        price = CampaignPrices(warband.campaign_id).current(item)
    if data["is_buying"] and price is None:
        raise refused(key, "price", "No price is known for this item; send one.")
    if data["is_buying"] and (price or 0) * data["quantity"] > ledger.MAX_TRADE_PRICE:
        raise refused(key, "price", f"A purchase costs at most {ledger.MAX_TRADE_PRICE} gc.")
    return price


def _log(warband: Warband, line: Line) -> None:
    payload: dict[str, Any] = {}
    if line.unit is not None:
        payload["hero"] = economy_log.unit_name(line.target_type, line.unit)
    payload["item"] = line.item.name
    if line.total > 0:
        payload["price"] = line.total
    if line.data["quantity"] > 1:
        payload["quantity"] = line.data["quantity"]
    if not line.data["is_buying"] and line.data.get("reason"):
        payload["reason"] = line.data["reason"]
    economy_log.write(warband, "loadout", LOG_ENTRY[line.target_type], payload)


def _description(line: Line) -> str:
    quantity = line.data["quantity"]
    return f"{line.item.name} x {quantity}" if quantity > 1 else line.item.name


def _header(warband: Warband, charged: Sequence[Line]) -> WarbandTrade | None:
    """Several charges share a "Group" header, as the roster Save's purchases always did."""
    if len(charged) < 2:
        return None
    names = list(dict.fromkeys(economy_log.unit_name(line.target_type, line.unit) or "the stash" for line in charged))
    total = sum(line.total for line in charged)
    return ledger.group_header(warband, f"Equipped {', '.join(names)} ({len(charged)} items, {total} gc)")


def buy_lines(warband: Warband, lines: Sequence[Line]) -> tuple[list[WarbandTrade], list[Warning]]:
    """Inside the caller's transaction: charge, save the rolls, append the copies and log each line; the "Buy"
    rows and the warnings. The gold goes first: it locks the warband before the hero and stash rows."""
    charged = [line for line in lines if line.total > 0]
    header = _header(warband, charged)
    entries = [
        ledger.Entry(warband, LedgerAction.BUY, -line.total, _description(line), parent=header) for line in charged
    ]
    trades = ledger.record_entries(entries)
    warnings: list[Warning] = []
    for line in lines:
        if line.data.get("rarity_roll"):
            try:
                warnings += record_roll(warband, line.item, line.data["rarity_roll"])
            except RollRefused as refusal:
                raise refused(line.key, "rarity_roll.hero_id", str(refusal)) from None
        if line.unit is None:
            add_to_stash(warband.id, line.item.id, line.data["quantity"], line.price)
        else:
            add_unit_copies(line.target_type, line.unit, line.item, [line.price] * line.data["quantity"])
        _log(warband, line)
        if line.item.archived_at is not None or getattr(line.item, "removed", False):
            warnings.append(archived_entry(line.item))
    if charged and warband.gold < 0:
        warnings.append(
            {"code": GOLD_NEGATIVE, "message": f"This leaves the warband at {warband.gold} gc.", "gold": warband.gold}
        )
    return trades, warnings


@dataclass
class Purchase:
    line: Line
    trade: WarbandTrade | None
    warnings: list[Warning]


def purchase(warband: Warband, item: Item, data: Mapping[str, Any]) -> Purchase:
    """POST purchases/: buy or give `quantity` copies of `item` to the target of a validated body."""
    target_type = data["target_type"]
    unit = None if target_type == STASH else resolve_unit(warband, target_type, data.get("target_id"), "Target")
    line = Line(item, target_type, unit, data, price_line(warband, item, data))
    with transaction.atomic():
        trades, warnings = buy_lines(warband, [line])
    return Purchase(line, trades[0] if trades else None, warnings)
