"""A visit to one of the campaign's locations (William, 23 Nov 2026): the heroes a warband sends there.

Nothing is refused for game reasons. Fewer heroes than the location takes, or more, is a warning ("All" is every hero
the warband has on its roster); where going takes the trading action, each hero's is spent, and one who had already
used his goes anyway with a warning. One log line says who went. Nothing else is applied: a fee, gold or a find is
the player's own to record. A hero who is not on the warband's roster is refused, as for a rare search.
"""

from typing import Any

from django.db import transaction

from apps.campaigns.models import CampaignLocation
from apps.campaigns.services.location_words import heroes_text, names_text
from apps.warbands.models import Hero, Warband, on_roster

from . import economy_log
from .trading_action import spend_trading_action, spent_warning

HERO_COUNT = "location_hero_count"


class VisitRefused(ValueError):
    """A hero sent who isn't on the warband's roster."""


def visit_location(warband: Warband, location: CampaignLocation, hero_ids: list[int]) -> dict[str, Any]:
    """Send the heroes, all or nothing: their trading actions spent where the location takes them, and the log
    line written. The heroes as they now stand and the warnings."""
    wanted = list(dict.fromkeys(hero_ids))
    with transaction.atomic():
        rows = on_roster(Hero.objects.filter(warband=warband, id__in=wanted)).select_for_update()
        found = {hero.id: hero for hero in rows.only("id", "name", "trading_action")}
        if set(found) != set(wanted):
            raise VisitRefused("Not a hero on this warband's roster.")
        heroes = [found[hero_id] for hero_id in wanted]
        warnings = _count_warnings(warband, location, len(heroes))
        if location.takes_trading_action:
            warnings += [spent_warning(hero) for hero in heroes if not hero.trading_action]
            spend_trading_action(Hero.objects.filter(id__in=wanted))
        names = [hero.name or f"Hero {hero.id}" for hero in heroes]
        economy_log.write(
            warband,
            "location",
            "visit",
            {"location": location.name, "heroes": names, "trading_action": location.takes_trading_action},
        )
    spent = location.takes_trading_action
    return {
        "heroes": [{"id": hero.id, "trading_action": False if spent else hero.trading_action} for hero in heroes],
        "message": f"{names_text(names)} visited {location.name}.",
        "warnings": warnings,
    }


def _count_warnings(warband: Warband, location: CampaignLocation, sent: int) -> list[dict[str, Any]]:
    """A warning when fewer or more heroes went than the location takes. The roster is counted only for "All"."""
    low, high = location.min_heroes, location.max_heroes
    roster = on_roster(warband.heroes.all()).count() if low is None or high is None else 0
    least = roster if low is None else low
    most = roster if high is None else high
    if least <= sent <= most:
        return []
    went = f"{sent} of {roster}" if low is None else str(sent)
    wording = heroes_text(low, high)
    message = f"{location.name} is for {wording[0].lower()}{wording[1:]}; {went} went."
    return [{"code": HERO_COUNT, "message": message}]
