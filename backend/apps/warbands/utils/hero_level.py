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


def count_level_thresholds(xp_value: int) -> int:
    xp = max(0, int(xp_value or 0))
    return sum(1 for threshold in HERO_LEVEL_THRESHOLDS if xp >= threshold)


def count_new_level_ups(previous_xp: int, next_xp: int) -> int:
    prev = max(0, int(previous_xp or 0))
    nxt = max(0, int(next_xp or 0))
    if nxt <= prev:
        return 0
    return sum(1 for threshold in HERO_LEVEL_THRESHOLDS if prev < threshold <= nxt)
