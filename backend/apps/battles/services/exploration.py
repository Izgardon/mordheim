"""Exploration in the postbattle draft (decision 9, BUG-71, BATL-TWEAK-07).

The draft keeps the roll (`dice_values`), the resource it goes to and any `amount_override`, so a reload shows it
and can't be used for a free re-roll; the server computes the `amount` from its table. Changing dice that were
already saved is a re-roll: it goes ahead, comes back as a warning, and the earlier dice are kept in
`previous_rolls` (server-kept; a client can't erase them) for the finalise log.
"""

from typing import Any

from .warnings import Warning

EXPLORATION_REROLLED = "exploration_rerolled"
_TABLE = ((0, 0), (5, 1), (11, 2), (17, 3), (24, 4), (30, 5), (35, 6))  # (highest total, shards)


def table_amount(dice_values: list[int]) -> int:
    """Shards found for the dice total, as the exploration chart gives them."""
    total = sum(dice_values)
    return next((amount for highest, amount in _TABLE if total <= highest), 7)


def exploration_amount(exploration: dict[str, Any]) -> int:
    override = exploration.get("amount_override")
    return override if override is not None else table_amount(exploration.get("dice_values") or [])


def _is_reroll(before: list[int], after: list[int]) -> bool:
    """Dice already saved that are changed or taken away; adding dice after them isn't a re-roll."""
    return bool(before) and after[: len(before)] != before


def keep_exploration(stored: Any, exploration: dict[str, Any]) -> tuple[dict[str, Any], list[Warning]]:
    """The exploration to store (normalised `exploration` plus the amount and the re-roll history, against what
    was `stored`), and a warning when the dice were re-rolled."""
    stored = stored if isinstance(stored, dict) else {}
    before = [value for value in stored.get("dice_values") or [] if isinstance(value, int)]
    previous = [roll for roll in stored.get("previous_rolls") or [] if isinstance(roll, list)]
    after = list(exploration.get("dice_values") or [])
    warnings: list[Warning] = []
    if _is_reroll(before, after):
        previous = [*previous, before]
        was = ", ".join(str(value) for value in before)
        message = f"Exploration was re-rolled (it was {was}); the re-roll is logged."
        warnings.append({"code": EXPLORATION_REROLLED, "message": message, "previous": before})
    kept = {**exploration, "previous_rolls": previous}
    return {**kept, "amount": exploration_amount(kept)}, warnings
