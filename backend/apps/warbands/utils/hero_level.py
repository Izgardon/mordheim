from decimal import Decimal, InvalidOperation

HERO_LEVEL_THRESHOLDS = (
    2,
    4,
    6,
    8,
    11,
    14,
    17,
    20,
    24,
    28,
    32,
    36,
    41,
    46,
    51,
    56,
    62,
    68,
    74,
    80,
    87,
    94,
    101,
    108,
    116,
    124,
    132,
    140,
    149,
    158,
    167,
    176,
    186,
    196,
    206,
    216,
    227,
    238,
    249,
    260,
    272,
    284,
    296,
    308,
    321,
    334,
    347,
    360,
    374,
    388,
)

def get_default_hero_level_thresholds():
    return list(HERO_LEVEL_THRESHOLDS)


def _to_decimal(value) -> Decimal:
    if value is None:
        return Decimal(0)
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal(0)


def _parse_threshold(value) -> int:
    decimal_value = _to_decimal(value)
    if decimal_value % 1 != 0:
        raise ValueError("Thresholds must be whole numbers.")
    int_value = int(decimal_value)
    if int_value <= 0:
        raise ValueError("Thresholds must be positive.")
    return int_value


def normalize_hero_level_thresholds(values, fallback=None):
    if values is None:
        if fallback is None:
            raise ValueError("Thresholds are required.")
        return list(fallback)
    cleaned = sorted({ _parse_threshold(value) for value in values })
    if not cleaned:
        if fallback is None:
            raise ValueError("At least one threshold is required.")
        return list(fallback)
    return cleaned


def resolve_hero_level_thresholds(values, fallback=HERO_LEVEL_THRESHOLDS):
    try:
        return normalize_hero_level_thresholds(values, fallback=fallback)
    except ValueError:
        return list(fallback)


def _decimal_thresholds(values):
    return tuple(Decimal(str(value)) for value in values)


def count_level_thresholds(xp_value, thresholds=None) -> int:
    xp = _to_decimal(xp_value)
    if xp < 0:
        xp = Decimal(0)
    resolved = resolve_hero_level_thresholds(thresholds)
    decimal_thresholds = _decimal_thresholds(resolved)
    return sum(1 for threshold in decimal_thresholds if xp >= threshold)


def count_new_level_ups(previous_xp, next_xp, thresholds=None) -> int:
    prev = _to_decimal(previous_xp)
    nxt = _to_decimal(next_xp)
    if prev < 0:
        prev = Decimal(0)
    if nxt < 0:
        nxt = Decimal(0)
    if nxt <= prev:
        return 0
    resolved = resolve_hero_level_thresholds(thresholds)
    decimal_thresholds = _decimal_thresholds(resolved)
    return sum(1 for threshold in decimal_thresholds if prev < threshold <= nxt)
