"""Loose input coercion shared by the battle normalisers."""

from typing import Any


def coerce_bool(value: Any, *, field_name: str) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes"}:
            return True
        if lowered in {"false", "0", "no"}:
            return False
    raise ValueError(f"{field_name} must be true or false")


def coerce_int(value: Any, *, field_name: str, minimum: int = 0, maximum: int | None = None) -> int:
    """A whole number clamped to [minimum, maximum]; ValueError when it isn't one."""
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be an integer") from None
    parsed = max(minimum, parsed)
    if maximum is not None:
        parsed = min(maximum, parsed)
    return parsed


def optional_cost(value: Any, *, field_name: str) -> int | None:
    """A cost in gold crowns (0 to 999,999), or None when it is left empty."""
    if value in ("", None):
        return None
    return coerce_int(value, field_name=field_name, minimum=0, maximum=999999)
