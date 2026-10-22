"""Single-use items used during a battle: what an `item_used` event may say (BUG-72, SEC-09).

The event is stored and replayed to every player on each state read, and finalise (or a skip) removes one copy of
the item per use, so it must name a unit of the player's that carries the item. The stored payload is rebuilt from
the whitelisted keys with the server's own unit and item fields, never kept as sent.
"""

import json
from typing import Any

from django.db.models import Q

from apps.core.models import RevertedVersion
from apps.warbands.models import HenchmenGroupItem, HeroItem, HirelingItem

from ..models import BattleParticipant
from .errors import BattleError

MAX_EVENT_PAYLOAD_BYTES = 2048
ITEM_USE_KEYS = frozenset({"participant_user_id", "unit_key", "unit_id", "unit_type", "item_id", "item_name"})
ITEM_UNIT_TYPES = ("hero", "hired_sword", "henchman")


def check_payload_size(payload: dict[str, Any]) -> None:
    """Any event a player posts is at most 2 KB as JSON (SEC-09)."""
    if len(json.dumps(payload, default=str)) > MAX_EVENT_PAYLOAD_BYTES:
        raise BattleError("payload_json must be at most 2 KB", code="payload_too_large")


def _unit(payload: dict[str, Any]) -> tuple[str, str, int]:
    raw_key = payload.get("unit_key")
    unit_key = raw_key.strip() if isinstance(raw_key, str) else ""
    unit_type, _, raw_id = unit_key.partition(":")
    if unit_type not in ITEM_UNIT_TYPES or not raw_id.isdigit() or int(raw_id) <= 0:
        raise BattleError(
            "unit_key must name a hero, hired sword or henchman",
            fields={"unit_key": ["Use <hero|hired_sword|henchman>:<id>."]},
        )
    return unit_key, unit_type, int(raw_id)


def _item_id(payload: dict[str, Any]) -> int:
    raw = payload.get("item_id")
    if isinstance(raw, bool) or not isinstance(raw, int | str) or not str(raw).isdigit() or int(raw) <= 0:
        raise BattleError("item_id must be an item's id", fields={"item_id": ["Must be a positive whole number."]})
    return int(raw)


def _carried_links(warband_id: int, unit_type: str, unit_id: int) -> Any:
    if unit_type == "hero":
        return HeroItem.objects.filter(hero_id=unit_id, hero__warband_id=warband_id)
    if unit_type == "hired_sword":
        return HirelingItem.objects.filter(hireling_id=unit_id, hireling__warband_id=warband_id)
    return HenchmenGroupItem.objects.filter(henchmen_group__henchmen__id=unit_id, henchmen_group__warband_id=warband_id)


def _carried_item(warband_id: int, unit: tuple[str, int], item_id: int, campaign_id: int) -> tuple[int, str] | None:
    """The id and name of the item the unit (of this warband) carries for `item_id`: that item, or the campaign's
    version of it (a sheet read before the edit, CAT-TWEAK-03), or for a version reverted since, its book item; a
    henchman carries his group's."""
    links = _carried_links(warband_id, *unit)
    found: tuple[int, str] | None = (
        links.filter(Q(item_id=item_id) | Q(item__replaces_id=item_id, item__campaign_id=campaign_id))
        .values_list("item_id", "item__name")
        .first()
    )
    if found is None:
        book_id = RevertedVersion.objects.filter(kind="items", version_id=item_id).values_list("book_id", flat=True)
        found = links.filter(item_id__in=book_id).values_list("item_id", "item__name").first()
    return found


def item_use_payload(
    participant: BattleParticipant, payload: dict[str, Any], selected_keys: set[str] | None, campaign_id: int
) -> dict[str, Any]:
    """The payload to store for an item use, or BattleError. Once the battle is active (`selected_keys` given) the
    unit must be one the player selected; in prebattle, where a selection may not be saved yet, his own is enough."""
    unknown = sorted(set(payload) - ITEM_USE_KEYS)
    if unknown:
        raise BattleError(f"payload_json has unsupported keys: {', '.join(unknown)}", fields={"payload_json": unknown})
    unit_key, unit_type, unit_id = _unit(payload)
    item_id = _item_id(payload)
    if selected_keys is not None and unit_key not in selected_keys:
        raise BattleError("unit_key is not selected for this participant", code="unit_not_selected")
    carried = _carried_item(participant.warband_id, (unit_type, unit_id), item_id, campaign_id)
    if carried is None:
        raise BattleError("That unit doesn't carry this item", code="item_not_carried")
    return {
        "participant_user_id": participant.user_id,
        "unit_key": unit_key,
        "unit_id": unit_id,
        "unit_type": unit_type,
        "item_id": carried[0],
        "item_name": carried[1],
    }
