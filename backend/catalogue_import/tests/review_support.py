"""The shared loader for the tests of William's review rulings (12 Nov 2026), in two modules by theme."""

from typing import Any, ClassVar

from django.test import SimpleTestCase

from catalogue_import.common import load_json
from catalogue_import.sources import BACKEND, OUT

SPELL_DATA = BACKEND / "apps" / "spells" / "data"


class ReviewCase(SimpleTestCase):
    """The committed `out/` (which test_build.py pins to a fresh run of build.py)."""

    items: ClassVar[dict[str, dict[str, Any]]]
    skills: ClassVar[dict[str, str]]
    groups: ClassVar[dict[str, list[str]]]
    templates: ClassVar[dict[str, dict[str, Any]]]

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.items = {row["name"]: row for row in load_json(OUT / "items.json")}
        cls.skills = {row["name"]: row["description"] for row in load_json(OUT / "skills.json")}
        cls.groups = {row["name"]: row["skills"] for row in load_json(OUT / "skill-groups.json")}
        cls.templates = {row["slug"]: row for row in load_json(OUT / "warband-templates.json")}

    def rows(self, item: str, slug: str) -> list[tuple[Any, ...]]:
        """An item's price rows a warband type may buy from, as (cost, dice, rarity, note)."""
        return [
            (row["cost"], row["dice"], row["rarity"], row["note"])
            for row in self.items[item]["availabilities"]
            if {"type": slug, "excluded": False} in row["warbands"]
        ]

    def specials(self, slug: str, fighter: str) -> list[tuple[str, str]]:
        found = next(row for row in self.templates[slug]["fighters"] if row["name"] == fighter)
        return [(row["name"], row["type"]) for row in found["specials"]]
