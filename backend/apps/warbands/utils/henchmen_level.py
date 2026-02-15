HENCHMEN_LEVEL_THRESHOLDS = (2, 5, 9, 14)


def count_henchmen_level_thresholds(xp_value) -> int:
    xp = int(xp_value or 0)
    if xp < 0:
        xp = 0
    return sum(1 for threshold in HENCHMEN_LEVEL_THRESHOLDS if xp >= threshold)


def count_new_henchmen_level_ups(previous_xp, next_xp) -> int:
    prev = int(previous_xp or 0)
    nxt = int(next_xp or 0)
    if prev < 0:
        prev = 0
    if nxt < 0:
        nxt = 0
    if nxt <= prev:
        return 0
    return sum(1 for threshold in HENCHMEN_LEVEL_THRESHOLDS if prev < threshold <= nxt)
