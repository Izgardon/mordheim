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

DECIMAL_THRESHOLDS = tuple(Decimal(str(value)) for value in HERO_LEVEL_THRESHOLDS)


def _to_decimal(value) -> Decimal:
    if value is None:
        return Decimal(0)
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal(0)


def count_level_thresholds(xp_value) -> int:
    xp = _to_decimal(xp_value)
    if xp < 0:
        xp = Decimal(0)
    return sum(1 for threshold in DECIMAL_THRESHOLDS if xp >= threshold)


def count_new_level_ups(previous_xp, next_xp) -> int:
    prev = _to_decimal(previous_xp)
    nxt = _to_decimal(next_xp)
    if prev < 0:
        prev = Decimal(0)
    if nxt < 0:
        nxt = Decimal(0)
    if nxt <= prev:
        return 0
    return sum(1 for threshold in DECIMAL_THRESHOLDS if prev < threshold <= nxt)
