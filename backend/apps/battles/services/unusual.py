"""Unusual postbattle numbers warn, go ahead and are logged; only malformed data is refused (decision 9, SEC-10).

The thresholds are BATL-TWEAK-07's placeholders, to tune in PR C: over 10 XP for one unit, more exploration dice than
the heroes plus one (or more than six), an amount above the exploration chart, finds over 100 gc.
"""

from typing import Any

from .exploration import table_amount
from .warnings import Warning

UNUSUAL_XP = 10
MAX_EXPLORATION_DICE = 6
UNUSUAL_FINDS_GOLD = 100


def _xp_warnings(unit_results: dict[str, dict[str, Any]]) -> list[Warning]:
    warnings: dict[str, Warning] = {}
    for unit_key, result in unit_results.items():
        xp = result.get("xp_earned", 0)
        if xp <= UNUSUAL_XP:
            continue
        name = result.get("group_name") if unit_key.startswith("henchman:") else None
        name = name or result.get("unit_name") or unit_key
        message = f"{name} earned {xp} XP in one battle."
        warnings.setdefault(message, {"code": "unusual_xp", "message": message, "unit_key": unit_key, "xp": xp})
    return list(warnings.values())


def _exploration_warnings(exploration: dict[str, Any], heroes: int) -> list[Warning]:
    dice = exploration.get("dice_values") or []
    warnings: list[Warning] = []
    if len(dice) > min(heroes + 1, MAX_EXPLORATION_DICE):
        message = f"{len(dice)} exploration dice for {heroes} hero{'es' if heroes != 1 else ''}."
        warnings.append({"code": "unusual_exploration_dice", "message": message, "dice": len(dice)})
    override = exploration.get("amount_override")
    if override is not None and override > table_amount(dice):
        message = f"{override} found, more than the exploration chart gives for these dice ({table_amount(dice)})."
        warnings.append({"code": "unusual_exploration_amount", "message": message, "amount": override})
    return warnings


def unusual_value_warnings(postbattle: dict[str, Any]) -> list[Warning]:
    """The warnings for a normalised postbattle: answered with the draft and finalise, logged at finalise."""
    unit_results = postbattle.get("unit_results") or {}
    heroes = sum(1 for unit_key in unit_results if unit_key.startswith("hero:"))
    warnings = _xp_warnings(unit_results) + _exploration_warnings(postbattle.get("exploration") or {}, heroes)
    gold = (postbattle.get("finds") or {}).get("gold_crowns", 0)
    if gold > UNUSUAL_FINDS_GOLD:
        warnings.append({"code": "unusual_finds", "message": f"{gold} gc of finds in one battle.", "gold_crowns": gold})
    return warnings
