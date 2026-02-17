HENCHMEN_LEVEL_THRESHOLDS = (2, 5, 9, 14)


def get_default_henchmen_level_thresholds():
    return list(HENCHMEN_LEVEL_THRESHOLDS)


def _parse_threshold(value) -> int:
    try:
        int_value = int(value)
    except (TypeError, ValueError):
        raise ValueError("Thresholds must be integers.")
    if int_value <= 0:
        raise ValueError("Thresholds must be positive.")
    if str(value).strip() != str(int_value):
        raise ValueError("Thresholds must be whole numbers.")
    return int_value


def normalize_henchmen_level_thresholds(values, fallback=None):
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


def resolve_henchmen_level_thresholds(values, fallback=HENCHMEN_LEVEL_THRESHOLDS):
    try:
        return normalize_henchmen_level_thresholds(values, fallback=fallback)
    except ValueError:
        return list(fallback)


def count_henchmen_level_thresholds(xp_value, thresholds=None) -> int:
    xp = int(xp_value or 0)
    if xp < 0:
        xp = 0
    resolved = resolve_henchmen_level_thresholds(thresholds)
    return sum(1 for threshold in resolved if xp >= threshold)


def count_new_henchmen_level_ups(previous_xp, next_xp, thresholds=None) -> int:
    prev = int(previous_xp or 0)
    nxt = int(next_xp or 0)
    if prev < 0:
        prev = 0
    if nxt < 0:
        nxt = 0
    if nxt <= prev:
        return 0
    resolved = resolve_henchmen_level_thresholds(thresholds)
    return sum(1 for threshold in resolved if prev < threshold <= nxt)
