"""A unit's kill history: its kill total and the named kills recorded in its campaign's battles."""

from collections.abc import Iterable
from typing import TYPE_CHECKING, Any

from apps.battles.models import BattleEvent
from apps.warbands.models import RosterUnit, Warband

if TYPE_CHECKING:
    from apps.warbands.units.kinds import UnitKindSpec


def _serialize_named_kills(events: Iterable[BattleEvent]) -> list[dict[str, Any]]:
    victim_warband_ids: set[int] = set()
    normalized_events: list[tuple[str, int, str]] = []

    for event in events:
        payload = event.payload_json if isinstance(event.payload_json, dict) else {}
        victim = payload.get("victim", {})
        if not isinstance(victim, dict):
            continue

        victim_name = str(victim.get("name", "") or "").strip()
        if not victim_name:
            continue

        victim_warband_id = victim.get("warband_id")
        if not isinstance(victim_warband_id, int | float | str):
            continue
        try:
            parsed_victim_warband_id = int(victim_warband_id)
        except ValueError:
            continue
        if parsed_victim_warband_id <= 0:
            continue

        scenario_name = str(getattr(event.battle, "scenario", "") or "").strip()
        normalized_events.append((victim_name, parsed_victim_warband_id, scenario_name))
        victim_warband_ids.add(parsed_victim_warband_id)

    warband_names = {
        warband_id: warband_name
        for warband_id, warband_name in Warband.objects.filter(id__in=victim_warband_ids).values_list("id", "name")
    }

    named_kills: list[dict[str, Any]] = []
    for victim_name, victim_warband_id, scenario_name in normalized_events:
        victim_warband_name = str(warband_names.get(victim_warband_id, "") or "").strip()
        if not victim_warband_name:
            continue
        named_kills.append(
            {
                "victim_name": victim_name,
                "victim_warband_name": victim_warband_name,
                "scenario_name": scenario_name,
            }
        )
    return named_kills


def _kill_events(warband: Warband, killer_type: str, killer_ids: list[int]) -> Any:
    """Kill events credited to these units, newest first, from the warband's own campaign only.

    The killer lookups match the partial index battle_event_kill_killer_idx (PERF-29), so this reads
    only the unit's own kill events instead of scanning every battle event in every campaign.
    """
    return (
        BattleEvent.objects.filter(
            type=BattleEvent.TYPE_UNIT_KILL_RECORDED,
            battle__campaign_id=warband.campaign_id,
            payload_json__killer__unit_type=killer_type,
            payload_json__killer__unit_id__in=killer_ids,
        )
        .select_related("battle")
        .order_by("-created_at", "-id")
    )


def kill_history(kind: "UnitKindSpec", warband: Warband, unit: RosterUnit) -> dict[str, Any]:
    """The kill-history payload; a henchmen group's kills are its members' (dead ones included)."""
    killer_type, killer_ids, total_kills = kind.hooks.kill_tally(kind, unit)
    named_kills = _serialize_named_kills(_kill_events(warband, killer_type, killer_ids) if killer_ids else [])
    return {
        "total_kills": max(0, int(total_kills or 0)),
        "named_kills_count": len(named_kills),
        "named_kills": named_kills,
    }
