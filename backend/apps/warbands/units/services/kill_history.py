"""A unit's kills (next step 9): its kill total and the kills it scored in its campaign's ended battles, newest
first, from battle_kill, for the "Kills" list on its open card. A henchmen group's are its members' (dead and
dismissed ones included), each naming the model who scored it. Undone kills, and kills of battles that never ended,
aren't listed.
"""

from typing import TYPE_CHECKING, Any

from apps.battles.models import Battle, BattleKill
from apps.warbands.models import RosterUnit, Warband

if TYPE_CHECKING:
    from apps.warbands.units.kinds import UnitKindSpec


def _entry(kill: BattleKill, group: bool) -> dict[str, Any]:
    battle = kill.battle
    return {
        "id": kill.id,
        "victim": kill.victim_called(start=True),
        "victim_kind": kill.victim_kind,
        "victim_warband": kill.victim_warband.name if kill.victim_warband else None,
        "battle_id": kill.battle_id,
        "scenario": battle.scenario,
        "date": (battle.ended_at or battle.created_at).isoformat(),
        "round": kill.round,
        "phase": kill.phase,
        "how": kill.how,
        "by": kill.killer_called(start=True) if group else None,  # which model, for a group
    }


def kill_history(kind: "UnitKindSpec", warband: Warband, unit: RosterUnit) -> dict[str, Any]:
    """`{total_kills, kills}`: the unit's kill counter (finalise writes it) and its kills, newest first (one read)."""
    killer, total_kills = kind.hooks.kill_tally(kind, unit)
    kills = (
        BattleKill.objects.filter(
            **killer,
            campaign_id=warband.campaign_id,
            battle__status=Battle.STATUS_ENDED,
            voided_at__isnull=True,
        )
        .select_related("battle", "victim_warband")
        .order_by("-created_at", "-id")
    )
    group = "killer_group" in killer
    return {"total_kills": max(0, int(total_kills or 0)), "kills": [_entry(kill, group) for kill in kills]}
