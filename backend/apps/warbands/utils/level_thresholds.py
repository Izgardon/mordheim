"""Level-threshold parsing shared by the hero and henchmen tables (BUG-95, BUG-97)."""

from decimal import Decimal, InvalidOperation


def parse_level_threshold(value: object) -> int:
    """Parse one level threshold: a positive whole number of XP.

    3, 3.0, "3" and "3.0" all mean 3, like the campaign settings API accepts them. Fractions,
    booleans, non-numbers and anything below 1 raise ValueError.
    """
    if isinstance(value, bool):
        raise ValueError("Thresholds must be whole numbers.")
    try:
        number = Decimal(str(value))
    except InvalidOperation:
        raise ValueError("Thresholds must be whole numbers.") from None
    if not number.is_finite() or number != number.to_integral_value():
        raise ValueError("Thresholds must be whole numbers.")
    if number <= 0:
        raise ValueError("Thresholds must be positive.")
    return int(number)


def parse_level_thresholds(values: object) -> list[int]:
    """Parse a threshold table: a list of thresholds, returned de-duplicated and sorted.

    A table stored as anything but a list (an int or a string set through the admin, say) raises
    ValueError like a bad threshold does, so the resolvers fall back to the default table (BUG-97).
    """
    if not isinstance(values, list | tuple):
        raise ValueError("Thresholds must be a list.")
    return sorted({parse_level_threshold(value) for value in values})
