"""Costs, dice and rarity, from mordheimer's structured cost and our MiM list's free-text extras."""

import re
from typing import Any, TypedDict

from catalogue_import.text import clean_inline


class Cost(TypedDict):
    cost: int | None
    dice: int | None
    dice_multiplier: int | None
    cost_note: str


_DICE = re.compile(r"^\+?\s*(\d*)\s*D6(?:\s*[x×]\s*(\d+))?\s*(?:gc)?$", re.I)


def parse_dice(text: str) -> tuple[int, int | None] | None:
    """Dice in a cost string: "+2D6 gc" is (2, None), "+D6x25 gc" is (1, 25), "1/3 of the boat price" is None."""
    match = _DICE.match(text.strip())
    if not match:
        return None
    count = int(match.group(1)) if match.group(1) else 1
    multiplier = int(match.group(2)) if match.group(2) else None
    return count, multiplier


def _note(*parts: object) -> str:
    texts = [clean_inline(part).strip(" /()") for part in parts if isinstance(part, str)]
    return "; ".join(text for text in texts if text)


def mordheimer_cost(cost: dict[str, Any] | None) -> Cost:
    """mordheimer's cost object: base plus ``numD6`` dice, or plus D6 × ``d6TimesNum``, with any odd wording kept."""
    cost = cost or {}
    base = cost.get("cost")
    dice: int | None = cost.get("numD6")
    multiplier: int | None = None
    if cost.get("d6TimesNum"):
        dice, multiplier = 1, int(cost["d6TimesNum"])
    note = _note(cost.get("costPrefix"), cost.get("costMod"), cost.get("costSuffix"))
    return {
        "cost": int(base) if isinstance(base, int | float) else None,
        "dice": int(dice) if dice else None,
        "dice_multiplier": multiplier,
        "cost_note": note,
    }


def mim_cost(base: object, variable: object) -> Cost:
    """Our MiM rows: a base cost and an optional ``variable_cost`` string ("+D6x10 gc")."""
    parsed = parse_dice(variable) if isinstance(variable, str) else None
    note = "" if parsed or not isinstance(variable, str) else clean_inline(variable)
    return {
        "cost": int(base) if isinstance(base, int | float) else None,
        "dice": parsed[0] if parsed else None,
        "dice_multiplier": parsed[1] if parsed else None,
        "cost_note": note,
    }


def parse_rarity(value: object) -> tuple[int | None, str]:
    """(rarity, note). 0 and "Common" are Common (None). Odd values ("Common?", "Special", "") say so in the note."""
    if isinstance(value, bool):
        return None, ""
    if isinstance(value, int | float):
        return (None, "") if int(value) == 0 else (int(value), "")
    text = str(value or "").strip()
    if not text:
        return None, "No rarity in the source"
    if text.isdigit():
        return parse_rarity(int(text))
    if text.lower() == "common":
        return None, ""
    return None, f"Rarity in the source: {text}"
