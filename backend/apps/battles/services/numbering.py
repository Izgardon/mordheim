"""The campaign battle number. William: "campaign battle number will just be greatest games played between the
players". A battle's number is the most games any of its warbands has played, this battle included.

A warband's game is a battle it played in (its player didn't decline, leave before the start or refuse a reported
result, and it wasn't taken off the record) that counts: a normal battle once it has started, unless it was
cancelled, and a reported result once every player approved it.

The number is set when the battle is made (what it would be then, for the invitation and the pre-battle) and set
again, for good, when it starts; a reported result's when its last player approves it. It never shifts afterwards,
whatever later battles do. Migration `0008_backfill_battle_number` numbered the battles played before this existed.
"""

from collections.abc import Iterable

from django.db.models import Count, Q

from ..models import Battle, BattleParticipant

PLAYED = Q(battle__flow_type=Battle.FLOW_TYPE_NORMAL, battle__started_at__isnull=False) | Q(
    battle__flow_type=Battle.FLOW_TYPE_REPORTED_RESULT, battle__status=Battle.STATUS_ENDED
)


def games_played(warband_ids: Iterable[int], *, excluding: int | None = None) -> dict[int, int]:
    """How many games each warband has played (one query); a warband with none is left out."""
    rows = (
        BattleParticipant.objects.filter(PLAYED, warband_id__in=list(warband_ids), removed_from_record=False)
        .exclude(status__in=BattleParticipant.LEFT_STATUSES)
        .exclude(battle__status=Battle.STATUS_CANCELED)
    )
    if excluding is not None:
        rows = rows.exclude(battle_id=excluding)
    counted = rows.order_by().values_list("warband_id").annotate(games=Count("battle_id", distinct=True))
    return {warband_id: games for warband_id, games in counted}


def battle_number(warband_ids: Iterable[int], *, battle_id: int | None = None) -> int:
    """The number of a battle these warbands play: the most games any of them has played besides it, plus this one."""
    return max(games_played(warband_ids, excluding=battle_id).values(), default=0) + 1
