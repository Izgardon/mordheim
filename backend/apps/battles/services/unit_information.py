"""A battle participant's live unit information, and what a config save may change in it (BUG-44).

`BattleParticipant.unit_information_json` maps unit keys to `{stats_override, notes, current_wounds,
out_of_action, kill_count}`. A config save changes only the first three (the editable fields), merged into what is
stored under the participant's lock; `out_of_action` and `kill_count` change only through their own endpoints, so a
save built before a kill or an out-of-action tap can't undo it, even from an older client sending the whole map.
"""

from typing import Any

from apps.warbands.utils.armour_save import ARMOUR_SAVE_ERROR, parse_armour_save

NUMERIC_STAT_KEYS = {
    "movement",
    "weapon_skill",
    "ballistic_skill",
    "strength",
    "toughness",
    "wounds",
    "initiative",
    "attacks",
    "leadership",
}
ARMOUR_SAVE_STAT_KEY = "armour_save"
ALL_OVERRIDE_STAT_KEYS = NUMERIC_STAT_KEYS | {ARMOUR_SAVE_STAT_KEY}
EDITABLE_FIELDS = ("stats_override", "notes", "current_wounds")


def clean_armour_save(value: Any) -> str:
    """An override armour save parsed as every unit write parses it (BUG-123), kept as text: "N+", or "" / "-" for
    no save. ValueError (ARMOUR_SAVE_ERROR) for anything else, so a typo is refused here, not at finalise."""
    text = "" if value is None else str(value).strip()
    if text in ("", "-"):
        return text
    try:
        save = parse_armour_save(value if isinstance(value, int | float) else text)
    except ValueError:
        raise ValueError(f"unit information armour_save: {ARMOUR_SAVE_ERROR}") from None
    return "" if save is None else f"{save}+"


def _clean_stats_override(stats_override: Any) -> dict[str, int | str]:
    if stats_override is None:
        return {}
    if not isinstance(stats_override, dict):
        raise ValueError("unit information stats_override must be an object")
    cleaned: dict[str, int | str] = {}
    for stat_key, stat_value in stats_override.items():
        if not isinstance(stat_key, str):
            raise ValueError("unit information stat keys must be strings")
        key = stat_key.strip()
        if key not in ALL_OVERRIDE_STAT_KEYS:
            raise ValueError(f"Unsupported unit information stat key '{key}'")
        if key == ARMOUR_SAVE_STAT_KEY:
            cleaned[key] = clean_armour_save(stat_value)
            continue
        try:
            value = int(stat_value)
        except (TypeError, ValueError):
            raise ValueError(f"unit information stat '{key}' must be an integer") from None
        cleaned[key] = max(0, min(10, value))
    return cleaned


def _clean_notes(notes: Any) -> str:
    if notes is None:
        return ""
    if not isinstance(notes, str):
        raise ValueError("unit information notes must be a string")
    cleaned = notes.strip()
    if len(cleaned) > 500:
        raise ValueError("unit information notes must be at most 500 characters")
    return cleaned


def _clean_current_wounds(current_wounds: Any) -> int | None:
    if current_wounds is None or current_wounds == "":
        return None
    try:
        value = int(current_wounds)
    except (TypeError, ValueError):
        raise ValueError("unit information current_wounds must be an integer") from None
    return max(0, min(10, value))


_CLEANERS = {"stats_override": _clean_stats_override, "notes": _clean_notes, "current_wounds": _clean_current_wounds}


def clean_editable_fields(info: dict[str, Any], *, only_present: bool = False) -> dict[str, Any]:
    """The editable fields of one unit's entry, validated (ValueError otherwise). Absent fields get their empty
    value, or are left out with `only_present`."""
    return {field: clean(info.get(field)) for field, clean in _CLEANERS.items() if not only_present or field in info}


def is_empty(entry: dict[str, Any]) -> bool:
    """An entry that says nothing: no override, notes or wounds, not out of action and no kills."""
    return not (
        entry.get("stats_override")
        or entry.get("notes")
        or entry.get("current_wounds") is not None
        or entry.get("out_of_action")
        or entry.get("kill_count")
    )


def _new_entry() -> dict[str, Any]:
    return {"stats_override": {}, "notes": "", "current_wounds": None, "out_of_action": False, "kill_count": 0}


def _entries(raw: Any, field_name: str) -> list[tuple[str, dict[str, Any]]]:
    if raw is None:
        return []
    if not isinstance(raw, dict):
        raise ValueError(f"{field_name} must be an object")
    entries = []
    for unit_key, info in raw.items():
        if not isinstance(unit_key, str):
            raise ValueError(f"{field_name} keys must be strings")
        if not isinstance(info, dict):
            raise ValueError("Each unit information entry must be an object")
        if unit_key.strip():
            entries.append((unit_key.strip(), info))
    return entries


def _without_empty(unit_information: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {key: entry for key, entry in unit_information.items() if not is_empty(entry)}


def apply_patch(stored: dict[str, dict[str, Any]], patch: Any) -> dict[str, dict[str, Any]]:
    """`unit_information_patch` ({unit_key: {current_wounds?, notes?, stats_override?}}) merged into `stored` (a
    normalised map): each field it names is replaced for that unit; every other field and unit is kept."""
    merged = {key: dict(entry) for key, entry in stored.items()}
    for unit_key, info in _entries(patch, "unit_information_patch"):
        entry = merged.setdefault(unit_key, _new_entry())
        entry.update(clean_editable_fields(info, only_present=True))
    return _without_empty(merged)


def apply_whole_map(stored: dict[str, dict[str, Any]], whole: Any) -> dict[str, dict[str, Any]]:
    """An older client's whole `unit_information_json`: it replaces every unit's editable fields (a unit it leaves
    out loses them), while each unit's stored `out_of_action` and `kill_count` stay as they are."""
    merged = {key: {**entry, **clean_editable_fields({})} for key, entry in stored.items()}
    for unit_key, info in _entries(whole, "unit_information_json"):
        entry = merged.setdefault(unit_key, _new_entry())
        entry.update(clean_editable_fields(info))
    return _without_empty(merged)


def unit_entry(unit_information: dict[str, dict[str, Any]], unit_key: str) -> dict[str, Any]:
    """The unit's entry in a normalised map, added (with what was stored for it) when it isn't there yet; a kill
    or out-of-action tap changes it in place."""
    existing = unit_information.get(unit_key, {})
    if not isinstance(existing, dict):
        existing = {}
    try:
        existing_kill_count = int(existing.get("kill_count", 0) or 0)
    except (TypeError, ValueError):
        existing_kill_count = 0
    entry = {
        "stats_override": existing.get("stats_override", {}),
        "notes": existing.get("notes", ""),
        "current_wounds": existing.get("current_wounds", None),
        "out_of_action": bool(existing.get("out_of_action", False)),
        "kill_count": max(0, existing_kill_count),
    }
    unit_information[unit_key] = entry
    return entry


def parse_armour_save_override(value: Any) -> int | None:
    """A kept override's armour save for the unit's record: as every unit write parses it (decision 11), "-" is
    none."""
    if value is None:
        return None
    cleaned = str(value).strip()
    if cleaned == "-":
        return None
    try:
        return parse_armour_save(cleaned)
    except ValueError:
        raise ValueError(f"unit information armour_save: {ARMOUR_SAVE_ERROR}") from None
