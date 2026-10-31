"""Kills come from the battle_kill table (next step 9, models/kill.py), never from a number someone typed (decision 5).

A kill is tapped in the fight (phase "fight", stamped with its round) or added in the killer's own postbattle (phase
"after"), and written with its `unit_kill_recorded` event, which stays the feed and the undo log. A player can undo
his own kills and item uses until he finalises: the event and the kill are marked voided and stay. Everything counts
the live (not voided) kills: the live kill counts in the battle's snapshot, the suggested XP, finalise (the only thing
that writes the units' `kills`), pivotal moments, the chronicle, the overview and kill history.
"""

from collections import Counter
from collections.abc import Iterable
from typing import Any

from django.contrib.postgres.expressions import ArraySubquery
from django.db.models import OuterRef, QuerySet
from django.db.models.functions import JSONObject

from ..models import Battle, BattleEvent, BattleKill

UNDOABLE_TYPES = {
    BattleEvent.TYPE_UNIT_KILL_RECORDED: BattleEvent.TYPE_UNIT_KILL_VOIDED,
    BattleEvent.TYPE_ITEM_USED: BattleEvent.TYPE_ITEM_USED_VOIDED,
}


def live_kills(battle_id: int) -> QuerySet[BattleKill]:
    return BattleKill.objects.filter(battle_id=battle_id, voided_at__isnull=True)


def live_kills_in(campaign_id: int) -> QuerySet[BattleKill]:
    """The live kills of a campaign's ended battles (the overview, the chronicle)."""
    return BattleKill.objects.filter(
        campaign_id=campaign_id, battle__status=Battle.STATUS_ENDED, voided_at__isnull=True
    )


def count_by_unit(kills: Iterable[BattleKill], warband_id: int | None = None, *, xp_only: bool = False) -> Counter[str]:
    """Kills per killer unit key ("hero:12", "henchman:88"), of one warband when given, only those that earn XP when
    asked."""
    counts: Counter[str] = Counter()
    for kill in kills:
        if (warband_id is not None and kill.killer_warband_id != warband_id) or (xp_only and not kill.earns_xp):
            continue
        if unit_key := kill.killer_unit_key:
            counts[unit_key] += 1
    return counts


def live_killers(battle: Any, warband: Any) -> ArraySubquery:
    """One column: the killer (kind and row ids) of each live kill the warband scored in the battle (ids or
    OuterRefs), so a read that already loads the warband or its participant counts kills in the same query."""
    kills = BattleKill.objects.filter(battle_id=battle, killer_warband_id=warband, voided_at__isnull=True)
    killer = JSONObject(
        kind="killer_kind", hero="killer_hero_id", henchman="killer_henchman_id", hireling="killer_hireling_id"
    )
    return ArraySubquery(kills.order_by("id").values(json=killer))


def _killer_key(killer: Any) -> str | None:
    if not isinstance(killer, dict):
        return None
    kind = killer.get("kind")
    unit_id = killer.get(kind) if isinstance(kind, str) else None
    return f"{kind}:{unit_id}" if isinstance(unit_id, int) else None


def count_killers(killers: Iterable[Any] | None) -> Counter[str]:
    """Kills per killer unit key, from a `live_killers` column."""
    return Counter(key for key in map(_killer_key, killers or []) if key)


def with_live_kills(participants: QuerySet[Any]) -> QuerySet[Any]:
    """Participants with `live_kill_killers`, their warband's live kills in the battle (the snapshot's kill counts,
    `unit_information_with_kills`), read in the same query."""
    annotated: QuerySet[Any] = participants.annotate(
        live_kill_killers=live_killers(OuterRef("battle_id"), OuterRef("warband_id"))
    )
    return annotated


NO_INFORMATION: dict[str, Any] = {"stats_override": {}, "notes": "", "current_wounds": None, "out_of_action": False}


def unit_information_with_kills(participant: Any) -> dict:
    """The participant's stored unit information with each unit's live `kill_count` (from battle_kill, never
    stored), when he was read `with_live_kills`; as stored otherwise."""
    stored = participant.unit_information_json if isinstance(participant.unit_information_json, dict) else {}
    killers = getattr(participant, "live_kill_killers", None)
    if killers is None:
        return stored
    counts = count_killers(killers)
    information = {
        key: {**entry, "kill_count": counts.pop(key, 0)} for key, entry in stored.items() if isinstance(entry, dict)
    }
    information.update({key: {**NO_INFORMATION, "kill_count": count} for key, count in counts.items()})
    return information
