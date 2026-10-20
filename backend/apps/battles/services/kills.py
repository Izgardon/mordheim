"""Kills come from the battle's kill events, never from a number someone typed (decision 5, BUG-11).

A kill is a `unit_kill_recorded` event: tapped in battle (`source: "battle"`) or added in the killer's own
postbattle (`source: "postbattle"`). A player can undo his own kills and item uses until he finalises: the event is
marked voided and stays in the timeline. Finalise adds each unit's live (not voided) kills, the only thing that
writes `kills`; the live `kill_count` in unit information, pivotal moments and kill history all count the same
events.
"""

from collections import Counter
from collections.abc import Iterable

from django.db.models import QuerySet

from ..models import BattleEvent

UNDOABLE_TYPES = {
    BattleEvent.TYPE_UNIT_KILL_RECORDED: BattleEvent.TYPE_UNIT_KILL_VOIDED,
    BattleEvent.TYPE_ITEM_USED: BattleEvent.TYPE_ITEM_USED_VOIDED,
}


def live_kill_events(battle_id: int) -> QuerySet[BattleEvent]:
    return BattleEvent.objects.filter(
        battle_id=battle_id, type=BattleEvent.TYPE_UNIT_KILL_RECORDED, voided_at__isnull=True
    )


def _killer(payload: object) -> dict:
    killer = payload.get("killer") if isinstance(payload, dict) else None
    return killer if isinstance(killer, dict) else {}


def kill_counts_by_unit(battle_id: int, warband_id: int | None = None) -> Counter[str]:
    """Live kills per killer unit key (of one warband, when given), in one query."""
    return count_kills(live_kill_events(battle_id).values_list("payload_json", flat=True), warband_id)


def count_kills(payloads: Iterable[object], warband_id: int | None = None) -> Counter[str]:
    """Kills per killer unit key in these kill events' payloads (of one warband, when given)."""
    counts: Counter[str] = Counter()
    for payload in payloads:
        killer = _killer(payload)
        unit_key = killer.get("unit_key")
        if not isinstance(unit_key, str) or (warband_id is not None and killer.get("warband_id") != warband_id):
            continue
        counts[unit_key] += 1
    return counts


def killer_unit_key(event: BattleEvent) -> str | None:
    unit_key = _killer(event.payload_json).get("unit_key")
    return unit_key if isinstance(unit_key, str) else None
