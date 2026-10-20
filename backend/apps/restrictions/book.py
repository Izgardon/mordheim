"""The book's restrictions as the seeders find them (BUG-17): never a campaign's or an add-on's row.

A "unique to" text is matched by text and type. `parse_unique_to` types most texts "Warband" while
`restrictions.json` types its group restrictions "Warband Group" (Chaos, Skaven, Undead and 15 more), so a text the
book holds once is that row whatever its type; anything else is created as parsed.
"""

from collections import defaultdict

from .models import Restriction
from .utils import parse_unique_to


class BookRestrictions:
    """A seeder run's cache of the book's restrictions (one query to build)."""

    def __init__(self) -> None:
        self.by_key: dict[tuple[str, str], Restriction] = {}
        self.by_text: dict[str, list[Restriction]] = defaultdict(list)
        for row in Restriction.objects.filter(campaign__isnull=True, campaign_type__isnull=True):
            self._remember(row)

    def _remember(self, row: Restriction) -> None:
        self.by_key[(row.restriction, row.type)] = row
        self.by_text[row.restriction].append(row)

    def get(self, text: str, restriction_type: str) -> Restriction:
        found = self.by_key.get((text, restriction_type))
        if found is not None:
            return found
        same_text = self.by_text.get(text, [])
        if len(same_text) == 1:
            return same_text[0]
        created = Restriction.objects.create(restriction=text, type=restriction_type)
        self._remember(created)
        return created

    def resolve(self, unique_to_text: str) -> list[tuple[Restriction, str]]:
        """Each restriction a "unique to" text names, with its note (created in the book when missing)."""
        return [
            (self.get(entry["restriction"], entry["type"]), entry["additional_note"])
            for entry in parse_unique_to(unique_to_text)
        ]
