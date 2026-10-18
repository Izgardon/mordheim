"""How a battle's result is recorded (decision 3, BUG-09).

Wins and losses count once, when the battle ends: when the last player finishes postbattle, or postbattle is closed
(by a player with the right, or when its deadline passes). The battle's end runs under the battle lock with its
status as the guard, so this runs once per battle; PR C's automatic end (decision 4) calls the same end.
"""

from dataclasses import dataclass

from django.db.models import Count, F, Q, Value
from django.db.models.functions import Coalesce

from apps.warbands.models import Warband

from ..models import Battle, BattleParticipant


@dataclass(frozen=True)
class Headcount:
    """The participants still in a battle (not declined or cancelled), and how many have accepted or are ready."""

    total: int
    accepted: int
    ready: int


def participants_all_in(battle_id: int) -> Headcount:
    """One aggregate; declined and cancelled rows don't count (BUG-45: a cancelled row blocked start for ever)."""
    counts = (
        BattleParticipant.objects.filter(battle_id=battle_id)
        .exclude(status__in=BattleParticipant.LEFT_STATUSES)
        .aggregate(
            total=Count("id"),
            accepted=Count("id", filter=Q(status__in=BattleParticipant.ACCEPTED_STATUSES)),
            ready=Count("id", filter=Q(status=BattleParticipant.STATUS_READY)),
        )
    )
    return Headcount(total=counts["total"], accepted=counts["accepted"], ready=counts["ready"])


def record_wins_and_losses(battle: Battle) -> None:
    """A win for each winning warband still in the battle and a loss for every other one; nothing at all when
    nobody won ("No winner", decision 8)."""
    winner_ids = set(battle.winner_warband_ids_json or [])
    if not winner_ids:
        return
    warband_ids = set(
        BattleParticipant.objects.filter(battle_id=battle.id)
        .exclude(status__in=BattleParticipant.LEFT_STATUSES)
        .values_list("warband_id", flat=True)
    )
    winners, losers = warband_ids & winner_ids, warband_ids - winner_ids
    if winners:
        Warband.objects.filter(id__in=winners).update(wins=Coalesce(F("wins"), Value(0)) + 1)
    if losers:
        Warband.objects.filter(id__in=losers).update(losses=Coalesce(F("losses"), Value(0)) + 1)
