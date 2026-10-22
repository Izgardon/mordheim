"""Unit keys: how a battle names a unit (`<type>:<id>`, or a custom or bestiary unit's own key)."""

from typing import Any

UNIT_TYPES = {"hero", "henchman", "hireling", "custom", "bestiary"}
TEMPORARY_PREFIXES = ("custom:", "bestiary:")


def is_temporary(unit_key: str) -> bool:
    """A custom or bestiary unit: in the battle only, never on a warband."""
    return unit_key.startswith(TEMPORARY_PREFIXES)


def parse_unit_key(unit_key: Any) -> dict[str, Any]:
    """`{unit_key, unit_type, unit_id, custom_key}` for a key, or ValueError."""
    if not isinstance(unit_key, str):
        raise ValueError("unit_key must be a string")
    normalized = unit_key.strip()
    if not normalized:
        raise ValueError("unit_key is required")
    if ":" not in normalized:
        raise ValueError("unit_key must use <type>:<id> format")

    unit_type, raw_identifier = normalized.split(":", 1)
    unit_type = unit_type.strip().lower()
    raw_identifier = raw_identifier.strip()
    if not unit_type or not raw_identifier:
        raise ValueError("unit_key must use <type>:<id> format")
    if unit_type not in UNIT_TYPES:
        raise ValueError("unit_key type is invalid")

    if unit_type in ("custom", "bestiary"):
        return {"unit_key": normalized, "unit_type": unit_type, "unit_id": None, "custom_key": normalized}

    try:
        unit_id = int(raw_identifier)
    except (TypeError, ValueError):
        raise ValueError("unit_key id must be an integer") from None
    if unit_id <= 0:
        raise ValueError("unit_key id must be an integer")
    return {"unit_key": normalized, "unit_type": unit_type, "unit_id": unit_id, "custom_key": None}
