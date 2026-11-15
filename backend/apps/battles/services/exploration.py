"""Exploration in the postbattle draft (decision 9, BUG-71, BATL-TWEAK-07).

The draft keeps the roll (`dice_values`), the resource it goes to and any `amount_override`, so a reload shows it
and can't be used for a free re-roll; the server computes the `amount` from its table and the `places` the
multiples found from its chart, and keeps both with the draft, so what a warband found is a record and not the
browser's (a chart that changes later doesn't change what was found). Changing dice that were already saved is a
re-roll: it goes ahead, comes back as a warning, and the earlier dice are kept in
`previous_rolls` (server-kept; a client can't erase them) for the finalise log.

The chart itself is the server's too: the income table (`_TABLE`) and the multiples' thirty places (`_PLACES`),
both served with the postbattle rules (services/postbattle/suggested.py). They are the rulebook's own; a campaign
that replaces the chart replaces them here, so no client ever carries a copy.
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
    dice = kept.get("dice_values") or []
    return {**kept, "amount": exploration_amount(kept), "places": places_found(dice)}, warnings


def exploration_table() -> list[dict[str, int | None]]:
    """The chart as postbattle shows it (IMP-52): the shards for a dice total up to `max_total` (None: any more)."""
    rows: list[dict[str, int | None]] = [{"max_total": highest, "amount": amount} for highest, amount in _TABLE]
    return [*rows, {"max_total": None, "amount": 7}]


# The exploration chart's multiples: the place each count of a face finds, by the face shown (index 0 is a 1).
# The rulebook's own thirty; a campaign that replaces the chart replaces this list, which is why the places are
# served with the rest of the postbattle rules and never worked out by a client.
_PLACES: tuple[tuple[int, str, tuple[str, ...]], ...] = (
    (2, "Doubles", ("Well", "Shop", "Corpse", "Straggler", "Overturned Cart", "Ruined Hovels")),
    (3, "Triples", ("Tavern", "Smithy", "Prisoners", "Fletcher", "Market Hall", "Returning a Favour")),
    (4, "Four of a kind", ("Gunsmith", "Shrine", "Townhouse", "Armourer", "Graveyard", "Catacombs")),
    (
        5,
        "Five of a kind",
        (
            "Moneylender's House",
            "Alchemist's Laboratory",
            "Jewelsmith",
            "Merchant's House",
            "Shattered Building",
            "Entrance to the Catacombs",
        ),
    ),
    (
        6,
        "Six of a kind",
        (
            "The Pit",
            "Hidden Treasure",
            "Dwarf Smithy",
            "Slaughtered Warband",
            "Fighting Arena",
            "Noble's Villa",
        ),
    ),
)
MOST_OF_A_KIND = _PLACES[-1][0]


def exploration_multiples() -> list[dict[str, Any]]:
    """The chart's multiples as postbattle serves them: each count of a face, its label and the six places."""
    return [{"count": count, "label": label, "places": list(places)} for count, label, places in _PLACES]


def places_found(dice_values: list[int]) -> list[dict[str, Any]]:
    """Each face rolled two or more times among the chosen dice, with the place it finds: the most of a kind
    first, then the highest face, as the page lists them."""
    counts: dict[int, int] = {}
    for value in dice_values:
        counts[value] = counts.get(value, 0) + 1
    found = sorted(
        ((face, count) for face, count in counts.items() if count >= 2),
        key=lambda entry: (-entry[1], -entry[0]),
    )
    rows = []
    for face, count in found:
        _, label, places = _PLACES[min(count, MOST_OF_A_KIND) - 2]
        rows.append({"face": face, "count": count, "label": label, "place": places[face - 1]})
    return rows
