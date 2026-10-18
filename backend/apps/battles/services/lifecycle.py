"""How a battle's result is recorded (decision 3, BUG-09).

Wins and losses count once, when the battle ends: when the last player finishes postbattle, or postbattle is closed
(by a player with the right, or when its deadline passes). The battle's end runs under the battle lock with its
status as the guard, so this runs once per battle; PR C's automatic end (decision 4) calls the same end.
"""

from django.db.models import F, Value
from django.db.models.functions import Coalesce

from apps.warbands.models import Warband

from ..models import Battle, BattleParticipant


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
