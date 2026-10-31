"""Each unit's kills by who was taken out, for the postbattle page (decision 5, BATL-NEW-06).

The list is the battle's live kills (battle_kill, services/kills.py), the same ones finalise counts into `kills` and
that kill history, pivotal moments and the suggested XP read: removing a kill voids it (`events/:id/void/`, its
event's id), adding one records a `source: "postbattle"` kill (`unit-kill/`) with a victim from another roster
(`victim_unit_key`) or a typed name (`victim_name`).
"""

from collections.abc import Iterable

from apps.users.names import display_name

from ...models import BattleKill, BattleParticipant
from ...models.kill import AFTER, CREATURE

SOURCES = {AFTER: "postbattle"}  # the page's name for a kill's phase; "battle" for one tapped in the fight


def _victim(kill: BattleKill, owners: dict[int, BattleParticipant]) -> dict:
    owner = owners.get(kill.victim_warband_id) if kill.victim_warband_id is not None else None
    return {
        "unit_key": None if kill.victim_kind == CREATURE else kill.victim_unit_key,
        "name": kill.victim_name or None,
        "type_name": kill.victim_type or None,
        "warband_id": kill.victim_warband_id,
        "warband_name": owner.warband.name if owner else None,
        "player_label": display_name(owner.user) if owner else None,
    }


def unit_kills(
    warband_id: int, kills: Iterable[BattleKill], participants: Iterable[BattleParticipant]
) -> dict[str, list[dict]]:
    """The live kills of one warband's units, by killer unit key, in the order they were recorded (kills read with
    their events, for the notes)."""
    owners = {entry.warband_id: entry for entry in participants}
    listed: dict[str, list[dict]] = {}
    for kill in kills:
        unit_key = kill.killer_unit_key
        if kill.killer_warband_id != warband_id or unit_key is None:
            continue
        payload = kill.event.payload_json if isinstance(kill.event.payload_json, dict) else {}
        listed.setdefault(unit_key, []).append(
            {
                "event_id": kill.event_id,
                "victim": _victim(kill, owners),
                "earned_xp": kill.earns_xp,
                "source": SOURCES.get(kill.phase, "battle"),
                "notes": payload.get("notes", ""),
            }
        )
    return listed
