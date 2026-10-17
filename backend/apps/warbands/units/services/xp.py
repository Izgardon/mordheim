"""XP and the level-ups it crosses, counted against the kind's campaign table (BUG-03).

One counting path for the unit PATCH and for postbattle: heroes use the hero table, henchmen groups the
henchmen table, hired swords their own setting (whose defaults are the henchmen table).

Level-ups are awarded only for thresholds above the unit's XP high-water mark (decision 5, BUG-27):
lowering XP never takes level-ups away and raising it again never awards them twice. Thresholds count
whole XP only, so half a point never reaches one (decision 6).
"""

from decimal import Decimal, InvalidOperation
from typing import Any

from apps.campaigns.models import CampaignSettings
from apps.warbands.models import RosterUnit
from apps.warbands.units.kinds import KIND_BY_MODEL, UnitKindSpec

HALF_RATE = Decimal("0.5")
XP_FIELDS = ("xp", "level_up", "xp_high_water")  # what an XP change writes, for save(update_fields=...)


def level_ups_between(kind: UnitKindSpec, previous_xp: Any, next_xp: Any, settings: CampaignSettings | None) -> int:
    """Thresholds crossed from `previous_xp` to `next_xp` in the kind's campaign table (or its default)."""
    thresholds = getattr(settings, kind.thresholds_setting) if settings else None
    return kind.count_level_ups(previous_xp, next_xp, thresholds)


def _as_decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except InvalidOperation:
        return Decimal(0)


def record_xp_change(
    kind: UnitKindSpec, unit: RosterUnit, previous_xp: Any, settings: CampaignSettings | None, *, award: bool
) -> int:
    """After `unit.xp` moved from `previous_xp`: add the level-ups it earned and raise the high-water mark.

    Only thresholds above the high-water mark count (the mark is never below the XP the unit had, so rows
    written before the mark existed behave too). `award=False` (a PATCH that sets `level_up` itself) and
    the kind's `no_level_ups` flag still move the mark but add nothing. Returns the level-ups added; the
    caller saves XP_FIELDS.
    """
    high_water = max(_as_decimal(previous_xp), _as_decimal(unit.xp_high_water))
    awarded = 0
    if award and not (kind.has_no_level_ups and getattr(unit, "no_level_ups", False)):
        awarded = level_ups_between(kind, high_water, unit.xp, settings)
        unit.level_up = (unit.level_up or 0) + awarded
    unit.xp_high_water = max(high_water, _as_decimal(unit.xp))
    return awarded


def apply_xp_gain(unit: RosterUnit, xp_earned: int, settings: CampaignSettings | None) -> bool:
    """Add `xp_earned` battle XP to `unit` and the level-ups it crosses; False if there is nothing to add.

    Half-rate units gain half (decision 6), so an odd award leaves half a point, and a threshold is
    reached only once the whole XP gets there. The caller saves XP_FIELDS.
    """
    gain = Decimal(xp_earned) * HALF_RATE if unit.half_rate else Decimal(xp_earned)
    if gain <= 0:
        return False
    previous_xp = unit.xp or Decimal(0)
    unit.xp = previous_xp + gain
    record_xp_change(KIND_BY_MODEL[type(unit)], unit, previous_xp, settings, award=True)
    return True
