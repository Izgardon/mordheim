"""Each unit's kills by who was taken out, for the postbattle page (decision 5, BATL-NEW-06).

The list is the battle's live kill events (services/kills.py), the same ones finalise counts into `kills` and that
kill history, pivotal moments and the suggested XP read: removing a kill voids its event (`events/:id/void/`), adding
one records a `source: "postbattle"` kill (`unit-kill/`) with a victim from another roster (`victim_unit_key`) or a
typed name (`victim_name`).
"""

from collections.abc import Iterable

from ...models import BattleEvent, BattleParticipant
from ...serializers import display_name


def _part(payload: dict, name: str) -> dict:
    part = payload.get(name)
    return part if isinstance(part, dict) else {}


def _victim(victim: dict, owners: dict[int, BattleParticipant]) -> dict:
    warband_id = victim.get("warband_id")
    owner = owners.get(warband_id) if isinstance(warband_id, int) else None
    return {
        "unit_key": victim.get("unit_key"),
        "name": victim.get("name"),
        "type_name": victim.get("type_name"),
        "warband_id": victim.get("warband_id"),
        "warband_name": owner.warband.name if owner else None,
        "player_label": display_name(owner.user) if owner else None,
    }


def unit_kills(
    warband_id: int, events: Iterable[BattleEvent], participants: Iterable[BattleParticipant]
) -> dict[str, list[dict]]:
    """The live kills of one warband's units, by killer unit key, in the order they were recorded."""
    owners = {entry.warband_id: entry for entry in participants}
    kills: dict[str, list[dict]] = {}
    for event in events:
        payload = event.payload_json if isinstance(event.payload_json, dict) else {}
        killer = _part(payload, "killer")
        unit_key = killer.get("unit_key")
        if killer.get("warband_id") != warband_id or not isinstance(unit_key, str):
            continue
        kills.setdefault(unit_key, []).append(
            {
                "event_id": event.id,
                "victim": _victim(_part(payload, "victim"), owners),
                "earned_xp": payload.get("earned_xp") is not False,
                "source": payload.get("source", "battle"),
                "notes": payload.get("notes", ""),
            }
        )
    return kills
