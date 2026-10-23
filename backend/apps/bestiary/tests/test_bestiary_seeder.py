"""seed_bestiary on small files (the bestiary rewrite step 3): each row names its kind, and a row without a known kind
stops the run with nothing kept. The committed data's full run is in test_catalogue_characterisation_seeding.py.
"""

from typing import Any

from django.core.management.base import CommandError
from django.test import TestCase

from apps.bestiary.models import BestiaryEntry
from apps.items.models import Item
from apps.items.tests.catalogue_support import STATS
from apps.items.tests.test_catalogue_characterisation_seeders import data_file, run

SHOP = {"grade": "1a", "availabilities": [{"cost": 80, "rarity": 11, "unique_to": "Humans only"}]}


def seed(rows: list[dict[str, Any]]) -> str:
    with data_file(rows) as path:
        return run("seed_bestiary", json_paths=[path])


class BestiarySeederKindTests(TestCase):
    def test_each_row_takes_its_kind_and_the_item_says_it(self):
        seed([{"name": "Warhorse", "kind": "Mount", **STATS, "shop_item": SHOP}, {"name": "Bear", "kind": "creature", **STATS}])  # fmt: skip

        self.assertEqual(
            sorted(BestiaryEntry.objects.values_list("name", "kind")), [("Bear", "creature"), ("Warhorse", "mount")]
        )
        self.assertEqual(Item.objects.get(name="Warhorse", type="Animal").subtype, "Mount")

    def test_a_row_without_a_known_kind_stops_the_run_and_keeps_nothing(self):
        for kind in (None, "Attack"):
            with self.subTest(kind=kind):
                rows: list[dict[str, Any]] = [{"name": "Mule", "kind": "mount", **STATS}, {"name": "Rat", "kind": kind, **STATS}]  # fmt: skip
                with self.assertRaisesMessage(CommandError, "Bestiary entry 'Rat' needs a kind"):
                    seed(rows)
                self.assertFalse(BestiaryEntry.objects.exists())
