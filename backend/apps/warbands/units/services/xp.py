"""XP and the level-ups it crosses, counted against the kind's campaign table (BUG-03).

One counting path for the unit PATCH and for postbattle: heroes use the hero table, henchmen groups the
henchmen table, hired swords their own setting (whose defaults are the henchmen table).
"""

from decimal import Decimal
from typing import Any

from apps.campaigns.models import CampaignSettings
from apps.warbands.models import RosterUnit
from apps.warbands.units.kinds import KIND_BY_MODEL, UnitKindSpec

HALF_RATE = Decimal("0.5")


def level_ups_between(kind: UnitKindSpec, previous_xp: Any, next_xp: Any, settings: CampaignSettings | None) -> int:
    """Thresholds crossed from `previous_xp` to `next_xp` in the kind's campaign table (or its default)."""
    thresholds = getattr(settings, kind.thresholds_setting) if settings else None
    return kind.count_level_ups(previous_xp, next_xp, thresholds)


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
    unit.level_up += level_ups_between(KIND_BY_MODEL[type(unit)], previous_xp, unit.xp, settings)
    return True
