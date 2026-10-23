"""Unit keys: how a battle names a unit (`<type>:<id>`, or a custom or bestiary unit's own key).

A pet with a profile fights as its own model (the bestiary rewrite step 5): `pet:<owner kind>:<item row id>`, the
owner kind naming the table of the row (a hero's, a hired sword's or a henchmen group's item).
"""

from typing import Any

UNIT_TYPES = {"hero", "henchman", "hireling", "custom", "bestiary", "pet"}
TEMPORARY_PREFIXES = ("custom:", "bestiary:")
PET_PREFIX = "pet:"
PET_OWNERS = ("hero", "hireling", "henchmen_group")


def is_temporary(unit_key: str) -> bool:
    """A custom or bestiary unit: in the battle only, never on a warband."""
    return unit_key.startswith(TEMPORARY_PREFIXES)


def is_pet(unit_key: str) -> bool:
    """A pet fighting as its own model: it follows its owner after the battle and has no result of its own."""
    return unit_key.startswith(PET_PREFIX)


def _positive_id(raw: str) -> int:
    try:
        unit_id = int(raw)
    except (TypeError, ValueError):
        raise ValueError("unit_key id must be an integer") from None
    if unit_id <= 0:
        raise ValueError("unit_key id must be an integer")
    return unit_id


def _pet(unit_key: str, identifier: str) -> dict[str, Any]:
    owner, _, row_id = identifier.partition(":")
    if owner not in PET_OWNERS:
        raise ValueError("unit_key pet owner is invalid")
    parsed = {"unit_key": unit_key, "unit_type": "pet", "unit_id": _positive_id(row_id), "custom_key": None}
    return {**parsed, "owner_type": owner}


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
    if unit_type == "pet":
        return _pet(normalized, raw_identifier)
    return {"unit_key": normalized, "unit_type": unit_type, "unit_id": _positive_id(raw_identifier), "custom_key": None}
