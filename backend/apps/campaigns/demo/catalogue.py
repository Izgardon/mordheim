"""The book entries the demo warbands use, found by name (ids differ between databases).

A name the catalogue no longer has is skipped, with a note in `missing`, so a renamed item costs the demo one
purchase rather than the whole seed. Only the warband types are required: without them there are no warbands.
"""

from django.core.management.base import CommandError

from apps.hirelings.models import HiredSword
from apps.items.models import Item
from apps.skills.models import Skill
from apps.spells.models import Spell
from apps.warbands.models import WarbandType


def catalogue_loaded() -> bool:
    """The test seed_catalogue_if_empty uses: the hired swords are seeded last, so one means the rest are there."""
    return HiredSword.objects.filter(campaign__isnull=True).exists()


class Book:
    """Lookups of book entries by name, remembering what wasn't found."""

    def __init__(self) -> None:
        self.missing: list[str] = []

    def _first(self, model, label: str, **lookup) -> int | None:
        found = model.objects.filter(campaign__isnull=True, archived_at__isnull=True, **lookup).order_by("id").first()
        if found is None:
            self.missing.append(f"{label} {lookup}")
            return None
        return int(found.pk)

    def warband_type(self, slug: str) -> int:
        found = WarbandType.objects.filter(slug=slug).values_list("id", flat=True).first()
        if found is None:
            raise CommandError(f"The catalogue has no warband type {slug!r}: run `manage.py seed_all` first.")
        return int(found)

    def item(self, name: str) -> int | None:
        return self._first(Item, "item", name=name)

    def skill(self, name: str) -> int | None:
        return self._first(Skill, "skill", name=name)

    def spell(self, name: str, school: str) -> int | None:
        return self._first(Spell, "spell", name=name, type=school)

    def hired_sword(self, name: str) -> int | None:
        return self._first(HiredSword, "hired sword", name=name)
