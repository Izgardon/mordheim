"""Exploration in the postbattle draft (decision 9, BUG-71, BATL-TWEAK-07).

The draft keeps the roll (`dice_values`), the resource it goes to and any `amount_override`, so a reload shows it
and can't be used for a free re-roll; the server computes the `amount` from the chart's income table and the
`places` the multiples found, and keeps both with the draft, so what a warband found is a record and not the
browser's (a chart edited later doesn't change what was found: each place is kept by name and by `place_id`).
A die already saved whose value changes is a re-roll: it goes ahead, comes back as a warning, and the earlier dice
are kept in `previous_rolls` (server-kept; a client can't erase them) for the finalise log.

The chart is catalogue data now (apps/exploration): the campaign picks one, and every function here is handed the
chart it read (`exploration.selectors.chart_for`) rather than closing over the rulebook's own. No client carries a
copy, and nothing below applies a place: William's ruling (12 Nov 2026) is that a place is rules text the player
reads and gives himself.
"""

from typing import Any

from apps.exploration.chart import Chart
from apps.exploration.payload import income_payload

from .warnings import Warning

EXPLORATION_REROLLED = "exploration_rerolled"


def table_amount(dice_values: list[int], chart: Chart) -> int:
    """Shards found for the dice total, as the chart's income table gives them."""
    total = sum(dice_values)
    for band in chart.income:
        if band.max_total is None or total <= band.max_total:
            return band.amount
    return 0


def exploration_amount(exploration: dict[str, Any], chart: Chart) -> int:
    override = exploration.get("amount_override")
    return override if override is not None else table_amount(exploration.get("dice_values") or [], chart)


def _is_reroll(before: list[int], after: list[int]) -> bool:
    """A die already saved that shows a different value (William, 12 Nov 2026). Only the dice the two rolls have in
    common are compared, so adding dice after them is no re-roll, and neither is taking one away: a player who
    over-counted his heroes and corrects three dice to two has re-rolled nothing."""
    shared = min(len(before), len(after))
    return before[:shared] != after[:shared]


def keep_exploration(stored: Any, exploration: dict[str, Any], chart: Chart) -> tuple[dict[str, Any], list[Warning]]:
    """The exploration to store (normalised `exploration` plus the amount, the places found and the re-roll history,
    against what was `stored`), and a warning when the dice were re-rolled."""
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
    return {**kept, "amount": exploration_amount(kept, chart), "places": places_found(dice, chart)}, warnings


def exploration_table(chart: Chart) -> list[dict[str, int | None]]:
    """The income table as postbattle shows it (IMP-52): the shards for a total up to `max_total` (None: any more)."""
    return income_payload(chart)


def places_found(dice_values: list[int], chart: Chart) -> list[dict[str, Any]]:
    """Each face rolled two or more times among the chosen dice, with the place it finds: the most of a kind
    first, then the highest face, as the page lists them. A place is kept by `place_id` and by name, so a later
    edit to the chart can't change what the warband found."""
    counts: dict[int, int] = {}
    for value in dice_values:
        counts[value] = counts.get(value, 0) + 1
    found = sorted(
        ((face, count) for face, count in counts.items() if count >= 2),
        key=lambda entry: (-entry[1], -entry[0]),
    )
    rows = []
    for face, count in found:
        place = chart.place(count, face)
        if place is None:
            continue
        rows.append({"face": face, "count": count, "label": place.label, "place": place.name, "place_id": place.id})
    return rows
