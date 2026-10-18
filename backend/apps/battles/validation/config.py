"""A participant's battle configuration (`config/`): selected units, unit information, custom units, the declared
rating and battle notes. Only the fields a request sends are written (BUG-44)."""

from typing import Any

from ..models import BattleParticipant
from ..services.errors import field_error
from ..services.unit_information import (
    ARMOUR_SAVE_STAT_KEY,
    NUMERIC_STAT_KEYS,
    apply_patch,
    apply_whole_map,
    clean_editable_fields,
    is_empty,
)
from .unit_keys import TEMPORARY_PREFIXES


def normalize_unit_keys(raw_value: Any) -> list[str]:
    if raw_value is None:
        return []
    if not isinstance(raw_value, list):
        raise ValueError("selected_unit_keys_json must be a list")
    normalized = []
    for entry in raw_value:
        if not isinstance(entry, str):
            raise ValueError("selected_unit_keys_json must contain only strings")
        key = entry.strip()
        if key:
            normalized.append(key)
    return list(dict.fromkeys(normalized))


def normalize_battle_notes(raw_value: Any) -> str:
    if raw_value is None:
        return ""
    return str(raw_value).strip()


def normalize_unit_information(raw_value: Any) -> dict[str, dict]:
    """A stored unit information map with every entry's fields filled in (services/unit_information.py)."""
    if raw_value is None:
        return {}
    if not isinstance(raw_value, dict):
        raise ValueError("unit_information_json must be an object")
    normalized = {}
    for unit_key, info in raw_value.items():
        if not isinstance(unit_key, str):
            raise ValueError("unit_information_json keys must be strings")
        if not isinstance(info, dict):
            raise ValueError("Each unit information entry must be an object")
        normalized_unit_key = unit_key.strip()
        if not normalized_unit_key:
            continue
        try:
            kill_count = int(info.get("kill_count", 0))
        except (TypeError, ValueError):
            raise ValueError("unit information kill_count must be an integer") from None
        normalized[normalized_unit_key] = {
            **clean_editable_fields(info),
            "out_of_action": bool(info.get("out_of_action", False)),
            "kill_count": max(0, min(9999, kill_count)),
        }
    return normalized


def _required_text(entry: dict, field: str, message: str) -> str:
    value = entry.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(message)
    return value.strip()


def _custom_unit_stats(stats: Any) -> dict[str, int | str]:
    if not isinstance(stats, dict):
        raise ValueError("custom unit stats must be an object")
    cleaned: dict[str, int | str] = {}
    for stat_key in NUMERIC_STAT_KEYS:
        try:
            parsed = int(stats.get(stat_key, 0))
        except (TypeError, ValueError):
            raise ValueError(f"custom unit stat '{stat_key}' must be an integer") from None
        cleaned[stat_key] = max(0, min(10, parsed))
    armour_save = stats.get(ARMOUR_SAVE_STAT_KEY, "")
    armour_save = "" if armour_save is None else str(armour_save).strip()
    if len(armour_save) > 20:
        raise ValueError("custom unit armour_save must be at most 20 characters")
    cleaned[ARMOUR_SAVE_STAT_KEY] = armour_save
    return cleaned


def _custom_unit(entry: Any, seen_keys: set[str]) -> dict:
    if not isinstance(entry, dict):
        raise ValueError("Each custom unit must be an object")
    key = _required_text(entry, "key", "custom unit key is required")
    if not key.startswith(TEMPORARY_PREFIXES):
        raise ValueError("custom unit key must start with 'custom:' or 'bestiary:'")
    if key in seen_keys:
        raise ValueError("custom unit keys must be unique")
    seen_keys.add(key)
    name = _required_text(entry, "name", "custom unit name is required")
    if len(name) > 120:
        raise ValueError("custom unit name must be at most 120 characters")
    unit_type = _required_text(entry, "unit_type", "custom unit unit_type is required")
    if len(unit_type) > 120:
        raise ValueError("custom unit unit_type must be at most 120 characters")
    try:
        rating = int(entry.get("rating", 0))
    except (TypeError, ValueError):
        raise ValueError("custom unit rating must be an integer") from None
    stats = _custom_unit_stats(entry.get("stats"))
    return {"key": key, "name": name, "unit_type": unit_type, "rating": max(0, min(9999, rating)), "stats": stats}


def normalize_custom_units(raw_value: Any) -> list[dict]:
    if raw_value is None:
        return []
    if not isinstance(raw_value, list):
        raise ValueError("custom_units_json must be a list")
    seen_keys: set[str] = set()
    return [_custom_unit(entry, seen_keys) for entry in raw_value]


def declared_rating(raw_value: Any) -> int | None:
    """A whole number from 0 to 9999, or None; a field error otherwise (BUG-125: "x" answered int()'s message)."""
    if raw_value in ("", None):
        return None
    message = "Enter a whole number from 0 to 9999, or leave it empty."
    try:
        rating = int(raw_value)
    except (TypeError, ValueError):
        raise field_error("declared_rating", "declared_rating must be a whole number", message) from None
    if rating < 0 or rating > 9999:
        raise field_error("declared_rating", "declared_rating must be between 0 and 9999", message)
    return rating


def _unit_information_change(data: Any, participant: BattleParticipant) -> dict | None:
    """The participant's unit information after a config save, or None when the save doesn't touch it: a patch, or
    an older client's whole map, merged into what is stored (services/unit_information.py, BUG-44)."""
    has_patch, has_whole_map = "unit_information_patch" in data, "unit_information_json" in data
    if has_patch and has_whole_map:
        raise ValueError("Send unit_information_patch or unit_information_json, not both")
    if not (has_patch or has_whole_map):
        return None
    stored = normalize_unit_information(participant.unit_information_json)
    if has_patch:
        return apply_patch(stored, data.get("unit_information_patch"))
    return apply_whole_map(stored, data.get("unit_information_json"))


def config_changes(data: Any, participant: BattleParticipant) -> dict:
    """The participant fields a config save sets: only those the request sends (ValueError when one is invalid,
    BattleError for a bad declared rating)."""
    changes: dict = {}
    if "selected_unit_keys_json" in data:
        changes["selected_unit_keys_json"] = normalize_unit_keys(data.get("selected_unit_keys_json"))
    unit_information = _unit_information_change(data, participant)
    if unit_information is not None:
        changes["unit_information_json"] = unit_information
    if "custom_units_json" in data:
        changes["custom_units_json"] = normalize_custom_units(data.get("custom_units_json"))
    if "declared_rating" in data:
        changes["declared_rating"] = declared_rating(data.get("declared_rating"))
    if "battle_notes" in data:
        changes["battle_notes"] = normalize_battle_notes(data.get("battle_notes"))
    return changes


def _without_notes(unit_information: dict) -> dict:
    stripped = {key: {**entry, "notes": ""} for key, entry in (unit_information or {}).items()}
    return {key: entry for key, entry in stripped.items() if not is_empty(entry)}


def changes_others_see(participant: BattleParticipant, changes: dict) -> bool:
    """Whether a config save changes anything but notes (battle notes and unit notes are the player's own)."""
    for field, value in changes.items():
        before = getattr(participant, field)
        if field == "battle_notes" or before == value:
            continue
        if field == "unit_information_json" and _without_notes(before) == _without_notes(value):
            continue
        return True
    return False
