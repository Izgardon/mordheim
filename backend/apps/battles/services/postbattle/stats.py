"""Battle stat changes made permanent at finalise, only when the player ticks Keep (decision 6, SEC-10)."""

from typing import Any

from ...validation.coerce import coerce_int
from ..unit_information import ARMOUR_SAVE_STAT_KEY, NUMERIC_STAT_KEYS, parse_armour_save_override


def apply_stats_override(unit: Any, stats_override: dict[str, int | str]) -> list[str]:
    """Set the unit's characteristics to the override's; returns the fields that changed. A number kept for a
    written stat without one replaces its text ("D6" rolled as 4 stays 4); one with a number keeps what follows it
    ("1(2)" kept as 3 is "3(2)", apps/warbands/utils/stats.py)."""
    update_fields: list[str] = []
    for stat_key in NUMERIC_STAT_KEYS:
        if stat_key not in stats_override:
            continue
        next_value = coerce_int(stats_override.get(stat_key), field_name=stat_key, minimum=0, maximum=10)
        previous = getattr(unit, stat_key)
        if previous != next_value:
            setattr(unit, stat_key, next_value)
            update_fields.append(stat_key)
            written = unit.written_stats or {}
            if previous is None and stat_key in written:
                unit.written_stats = {field: text for field, text in written.items() if field != stat_key}
                if "written_stats" not in update_fields:
                    update_fields.append("written_stats")
    if ARMOUR_SAVE_STAT_KEY in stats_override:
        next_armour_save = parse_armour_save_override(stats_override.get(ARMOUR_SAVE_STAT_KEY))
        if getattr(unit, ARMOUR_SAVE_STAT_KEY) != next_armour_save:
            setattr(unit, ARMOUR_SAVE_STAT_KEY, next_armour_save)
            update_fields.append(ARMOUR_SAVE_STAT_KEY)
    return update_fields


def kept_stats(unit: Any, stats_override: dict[str, int | str], unit_name: str, stat_logs: list[dict]) -> list[str]:
    """Make a unit's battle stat changes permanent and log them with before and after; returns the changed
    fields."""
    before = {key: getattr(unit, key) for key in (*NUMERIC_STAT_KEYS, ARMOUR_SAVE_STAT_KEY)}
    fields = apply_stats_override(unit, stats_override)
    if fields:
        changes = {
            field: {"before": before[field], "after": getattr(unit, field)} for field in fields if field in before
        }
        stat_logs.append({"unit_name": unit_name, "changes": changes})
    return fields
