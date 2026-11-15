"""An exploration chart read once, as the post-game reads it (apps/battles/services/exploration.py).

The battles code never touches the models: it is handed a `Chart`, read from the campaign's chart row and its places
in one go (selectors.py), so the income table and the thirty places cost the same whatever the chart holds. A
campaign with no chart seeded at all reads as `Chart.empty()`: no income and no places, with the model's own dice
defaults, so the post-game still works on a database the catalogue hasn't been seeded into.
"""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any

from .models import (
    DEFAULT_DICE_FOR_WIN,
    DEFAULT_DICE_PER_HERO,
    DEFAULT_MAX_CHOSEN,
    DEFAULT_MAX_DICE,
    MOST_OF_A_KIND,
    MULTIPLE_LABELS,
    ExplorationChart,
    ExplorationPlace,
)


@dataclass(frozen=True)
class Place:
    id: int | None
    count: int
    face: int
    name: str
    rules: str

    @property
    def label(self) -> str:
        return MULTIPLE_LABELS.get(self.count, f"{self.count} of a kind")


@dataclass(frozen=True)
class Band:
    """One line of the income table: `amount` shards for a total up to `max_total` (None: any higher total)."""

    max_total: int | None
    amount: int


@dataclass(frozen=True)
class Chart:
    id: int | None
    name: str
    summary: str = ""
    dice_per_hero: int = DEFAULT_DICE_PER_HERO
    dice_for_win: int = DEFAULT_DICE_FOR_WIN
    max_dice: int = DEFAULT_MAX_DICE
    max_chosen: int = DEFAULT_MAX_CHOSEN
    income: tuple[Band, ...] = ()
    income_note: str = ""
    places: Mapping[tuple[int, int], Place] = field(default_factory=dict)

    @property
    def most_of_a_kind(self) -> int:
        """The largest multiple the chart names places for; more of a kind reads as this many."""
        counts = {count for count, _face in self.places}
        return max(counts) if counts else MOST_OF_A_KIND

    def place(self, count: int, face: int) -> Place | None:
        return self.places.get((min(count, self.most_of_a_kind), face))

    def multiples(self) -> list[tuple[int, list[Place]]]:
        """Each multiple the chart names places for, lowest first, with its places by face."""
        counts = sorted({count for count, _face in self.places})
        return [
            (count, [place for (own, _face), place in sorted(self.places.items()) if own == count]) for count in counts
        ]


def _band(row: Any) -> Band | None:
    if not isinstance(row, dict):
        return None
    total, amount = row.get("max_total"), row.get("amount")
    if not isinstance(amount, int) or isinstance(amount, bool):
        return None
    return Band(total if isinstance(total, int) and not isinstance(total, bool) else None, amount)


def read_chart(row: ExplorationChart, places: Iterable[ExplorationPlace]) -> Chart:
    """The chart row and its places as the post-game reads them; a malformed income line is left out."""
    bands = [band for band in (_band(line) for line in row.income or []) if band is not None]
    return Chart(
        id=row.pk,
        name=row.name,
        summary=row.summary,
        dice_per_hero=row.dice_per_hero,
        dice_for_win=row.dice_for_win,
        max_dice=row.max_dice,
        max_chosen=row.max_chosen,
        income=tuple(bands),
        income_note=row.income_note,
        places={
            (place.count, place.face): Place(place.pk, place.count, place.face, place.name, place.rules)
            for place in places
        },
    )


def empty_chart() -> Chart:
    """No chart seeded: nothing to find and nothing to earn, on the model's own dice defaults."""
    row = ExplorationChart(name="")
    return read_chart(row, ())
