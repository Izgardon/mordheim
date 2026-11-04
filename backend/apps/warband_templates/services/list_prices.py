"""List prices (the templates plan, question 8): a warband buys kit from its fighters' lists at list price, with no
rarity roll, in the hire screens until the fight of its first battle is over. Nothing is stored: the server reads it
from the warband's battles.

The fight is over once a battle the warband took part in reaches the post-game or ends (a reported result ends when
every player approves it). A cancelled battle doesn't count, nor does one its player declined or left before the
start, nor one taken off the record.
"""

from apps.battles.models import Battle, BattleParticipant

FOUGHT = (Battle.STATUS_POSTBATTLE, Battle.STATUS_ENDED)


def list_prices_open(warband_id: int) -> bool:
    """Whether the warband still buys at list prices: none of its battles has finished its fight (one query)."""
    fought = (
        BattleParticipant.objects.filter(warband_id=warband_id, removed_from_record=False, battle__status__in=FOUGHT)
        .exclude(status__in=BattleParticipant.LEFT_STATUSES)
        .exists()
    )
    return not fought
