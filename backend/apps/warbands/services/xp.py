"""XP gains from battles, counted against the campaign's level tables (BUG-03)."""

from decimal import Decimal

from apps.campaigns.models import CampaignSettings
from apps.warbands.models import HenchmenGroup, Hero, HiredSword
from apps.warbands.utils.henchmen_level import count_new_henchmen_level_ups
from apps.warbands.utils.hero_level import count_new_level_ups

RosterUnit = Hero | HenchmenGroup | HiredSword

HALF_RATE = Decimal("0.5")


def level_ups_between(
    unit: RosterUnit, previous_xp: Decimal, next_xp: Decimal, settings: CampaignSettings | None
) -> int:
    """Thresholds `unit` crosses from `previous_xp` to `next_xp` in its kind's campaign table.

    The same tables the unit PATCH uses: heroes the hero table, henchmen groups the henchmen table,
    hired swords their own setting (whose defaults are the henchmen table).
    """
    if isinstance(unit, Hero):
        return count_new_level_ups(previous_xp, next_xp, settings.hero_level_thresholds if settings else None)
    if isinstance(unit, HenchmenGroup):
        thresholds = settings.henchmen_level_thresholds if settings else None
    else:
        thresholds = settings.hired_sword_level_thresholds if settings else None
    return count_new_henchmen_level_ups(previous_xp, next_xp, thresholds)


def apply_xp_gain(unit: RosterUnit, xp_earned: int, settings: CampaignSettings | None) -> bool:
    """Add `xp_earned` battle XP to `unit` and the level-ups it crosses; False if there is nothing to add.

    Half-rate units gain half (decision 6), so an odd award leaves half a point, and a threshold is
    reached only once the whole XP gets there. The caller saves `xp` and `level_up`.
    """
    gain = Decimal(xp_earned) * HALF_RATE if unit.half_rate else Decimal(xp_earned)
    if gain <= 0:
        return False
    previous_xp = unit.xp or Decimal(0)
    unit.xp = previous_xp + gain
    unit.level_up += level_ups_between(unit, previous_xp, unit.xp, settings)
    return True
