"""The warband log entries the server writes for economy changes, in the same transaction (ECON-CQ-02).

Feature "items": "sold", "moved" and "discarded"; feature "trade": "completed" (one entry per side). Payloads
name things as the screen shows them, so the log reads the same after a unit is renamed or an item leaves:

- sold: {item, quantity, price, source_type, source_name}
- moved: {item, quantity, source_type, source_name, target_type, target_name}
- discarded: {item, quantity}
- completed: {partner, sent: {gold, items: [{item, quantity}]}, received: {gold, items: [...]}}

`*_type` is "stash", "hero", "hired_sword" or "henchmen_group"; `*_name` is the unit's name (None for the stash).

The client may log only what the server can't see (`CLIENT_LOG_ENTRIES`), with a size cap.
"""

from typing import Any, cast

from apps.warbands.models import RosterUnit, Warband, WarbandLog
from apps.warbands.units.kinds import KINDS, UnitKindKey

STASH = "stash"
# (feature, entry type) the client may still post to logs/: dice rolls happen in the browser. Purchases and
# rarity rolls are logged by the server (POST purchases/, rarity-rolls/ and the roster batch).
CLIENT_LOG_ENTRIES = frozenset({("dice_roll", "dice_roll")})
MAX_CLIENT_PAYLOAD = 4096  # bytes of JSON


def unit_name(unit_type: str, unit: RosterUnit | None) -> str | None:
    """How the log names a move's or sale's end: the unit's name (or type), None for the stash."""
    if unit is None:
        return None
    return unit.name or unit.unit_type or KINDS[cast(UnitKindKey, unit_type)].unknown_name


def write(warband: Warband, feature: str, entry_type: str, payload: dict[str, Any]) -> WarbandLog:
    """One log entry for the warband, in the caller's transaction."""
    return WarbandLog.objects.create(warband=warband, feature=feature, entry_type=entry_type, payload=payload)


def log_sale(warband: Warband, item: str, quantity: int, price: int, source: tuple[str, str | None]) -> None:
    source_type, source_name = source
    payload = {"item": item, "quantity": quantity, "price": price}
    write(warband, "items", "sold", payload | {"source_type": source_type, "source_name": source_name})


def log_move(
    warband: Warband, item: str, quantity: int, source: tuple[str, str | None], target: tuple[str, str | None]
) -> None:
    payload = {"item": item, "quantity": quantity, "source_type": source[0], "source_name": source[1]}
    write(warband, "items", "moved", payload | {"target_type": target[0], "target_name": target[1]})


def log_discard(warband: Warband, item: str, quantity: int) -> None:
    write(warband, "items", "discarded", {"item": item, "quantity": quantity})


def _offered(offer: dict[str, Any]) -> dict[str, Any]:
    items = [{"item": entry.get("name"), "quantity": entry.get("quantity")} for entry in offer["items"]]
    return {"gold": offer["gold"], "items": items}


def log_completed_trade(sides: dict[str, tuple[Warband, dict[str, Any]]]) -> None:
    """One "trade completed" entry per warband (one INSERT): what it sent and received. `sides` maps "from" and
    "to" to the side's warband and its normalised offer; nothing is logged when nothing changed hands."""
    (first, first_offer), (second, second_offer) = sides["from"], sides["to"]
    if not any(offer["gold"] or offer["items"] for offer in (first_offer, second_offer)):
        return
    entries = [
        (first, second, first_offer, second_offer),
        (second, first, second_offer, first_offer),
    ]
    WarbandLog.objects.bulk_create(
        WarbandLog(
            warband=warband,
            feature="trade",
            entry_type="completed",
            payload={"partner": partner.name, "sent": _offered(sent), "received": _offered(received)},
        )
        for warband, partner, sent, received in entries
    )
