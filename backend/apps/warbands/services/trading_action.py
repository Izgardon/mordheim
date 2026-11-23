"""A hero's trading action (decision 9, ECON-TWEAK-01): one a round, spent by a search for a rare item, a completed
trade and a visit to a location that takes it.

Spending is one guarded UPDATE, so a hero who already used his is left as he is and the caller warns: nothing is
refused for having spent it (a guide, not a gatekeeper).
"""

from typing import Any

from django.db.models import QuerySet
from django.utils import timezone

from apps.warbands.models import Hero

TRADING_ACTION_SPENT = "trading_action_spent"


def spend_trading_action(heroes: "QuerySet[Hero]") -> int:
    """Spend the trading action of each hero in `heroes` who still has his; how many were spent. One UPDATE."""
    return heroes.filter(trading_action=True).update(trading_action=False, updated_at=timezone.now())


def spent_warning(hero: Hero) -> dict[str, Any]:
    """The warning for a hero who already used his trading action this round."""
    name = hero.name or f"Hero {hero.id}"
    return {
        "code": TRADING_ACTION_SPENT,
        "message": f"{name} already used their trading action this round.",
        "hero_id": hero.id,
    }
