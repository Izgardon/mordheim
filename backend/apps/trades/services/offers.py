"""Trade offers: what one side puts on the table, normalised and checked against its own warband.

An offer is `{"trader_id", "trader_name", "gold", "items": [{"id", "name", "quantity", "cost"}]}`. Loose input
is coerced or dropped silently, as it always was; what the warband can't offer is a TradeError (400).
"""

from typing import Any

from apps.warbands.models import Hero, WarbandItem, on_roster
from apps.warbands.services.summary import warband_gold

from .errors import TradeError


def _whole(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def offer_trader_id(offer: Any) -> int | None:
    """The hero an offer (sent or stored) names as its trader, or None."""
    if not isinstance(offer, dict) or offer.get("trader_id") in (None, ""):
        return None
    return _whole(offer.get("trader_id"))


def offer_gold(offer: Any) -> int:
    """The gold an offer puts up: a whole number, 0 or more."""
    if not isinstance(offer, dict):
        return 0
    return max(0, _whole(offer.get("gold", 0)) or 0)


def requested_items(items: Any) -> dict[int, int]:
    """Item id -> copies from an offer's item list; malformed entries are dropped and repeated ids add up."""
    requested: dict[int, int] = {}
    if not isinstance(items, list):
        return requested
    for entry in items:
        if not isinstance(entry, dict) or entry.get("id") is None:
            continue
        item_id, quantity = _whole(entry.get("id")), _whole(entry.get("quantity", 0))
        if item_id is None or quantity is None or item_id <= 0 or quantity <= 0:
            continue
        requested[item_id] = requested.get(item_id, 0) + quantity
    return requested


def _offer_items(items: Any, warband_id: int) -> list[dict[str, Any]]:
    """The offered stash items with their names, checked against the warband's stash (one query)."""
    requested = requested_items(items)
    if not requested:
        return []
    rows = {
        row.item_id: row
        for row in WarbandItem.objects.select_related("item").filter(warband_id=warband_id, item_id__in=requested)
    }
    offered = []
    for item_id, quantity in requested.items():
        row = rows.get(item_id)
        if row is None:
            raise TradeError("One or more items are not in the warchest.")
        if quantity > row.quantity:
            raise TradeError("Not enough quantity for one or more items.")
        offered.append(
            {"id": item_id, "name": row.item.name, "quantity": quantity, "cost": getattr(row.item, "cost", 0)}
        )
    return offered


def build_offer(payload: Any, warband_id: int) -> dict[str, Any]:
    """The offer one side sends, normalised; TradeError for a trader, gold or items the warband can't offer."""
    data = payload if isinstance(payload, dict) else {}
    trader_id = offer_trader_id(data)
    trader_name = None
    if trader_id is not None:
        hero = on_roster(Hero.objects.filter(id=trader_id, warband_id=warband_id)).first()
        if hero is None:  # missing, dead or dismissed (BUG-109)
            raise TradeError("Trader not found.")
        if not hero.trading_action:  # a hero who has traded this round is refused (decision 9 may change this)
            raise TradeError("Selected trader is unavailable.")
        trader_name = hero.name or f"Hero {hero.id}"
    gold = offer_gold(data)
    if gold > max(warband_gold(warband_id), 0):
        raise TradeError("Not enough gold.")
    items = _offer_items(data.get("items", []), warband_id)
    return {"trader_id": trader_id, "trader_name": trader_name, "gold": gold, "items": items}


def stored_offer(raw: Any) -> dict[str, Any]:
    """A side's stored offer with every key (a side that never offered is stored as {})."""
    data = raw if isinstance(raw, dict) else {}
    items = data.get("items")
    return {
        "trader_id": offer_trader_id(data),
        "trader_name": data.get("trader_name"),
        "gold": offer_gold(data),
        "items": items if isinstance(items, list) else [],
    }
