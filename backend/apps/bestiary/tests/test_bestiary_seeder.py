"""seed_bestiary (the bestiary rewrite step 3): `bestiary.json` and, for the first time, Mutiny in Marienburg's
`mim-bestiary.json`.

Each row names its kind, whether it has a profile (off: the stats are kept at 0 and the save empty), what it adds to a
rider's rating and whether the shop sells it; every beast gets its Animal item, listed when it is sold, with the
grade and prices of its `shop_item`. A row without a known kind, or with a rating bonus that isn't a whole number from
0, stops the run with nothing kept. The whole catalogue's run is in test_catalogue_characterisation_seeding.py.
"""

from collections import Counter
from typing import Any

from django.core.management.base import CommandError
from django.test import TestCase

from apps.bestiary.models import BestiaryEntry
from apps.items.models import Item
from apps.items.tests.catalogue_support import STATS
from apps.items.tests.test_catalogue_characterisation_seeders import data_file, run

SHOP = {"grade": "1a", "availabilities": [{"cost": 80, "rarity": 11, "unique_to": "Humans only"}]}
GRADES = {"1a", "1b", "1c", "2a", "2b", "3"}


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


class BestiarySeederBeastTests(TestCase):
    def test_a_row_takes_the_beast_fields_and_every_beast_gets_its_item(self):
        seed(
            [
                {
                    "name": "Warhorse",
                    "kind": "mount",
                    "rating_bonus": 5,
                    "available_in_shop": True,
                    **STATS,
                    "shop_item": SHOP,
                },  # fmt: skip
                {
                    "name": "Wyvern",
                    "kind": "creature",
                    "gains_xp": True,
                    **STATS,
                    "shop_item": {"grade": "2b", "availabilities": []},
                },  # fmt: skip
            ]
        )

        beasts = {beast.name: beast for beast in BestiaryEntry.objects.select_related("animal_item")}
        self.assertEqual(
            {name: (b.has_profile, b.gains_xp, b.rating_bonus, b.available_in_shop) for name, b in beasts.items()},
            {"Warhorse": (True, False, 5, True), "Wyvern": (True, True, None, False)},
        )
        items = {name: beast.animal_item for name, beast in beasts.items()}
        self.assertEqual(
            {name: (item.campaign_id, item.subtype, item.grade, item.listed) for name, item in items.items()},
            {"Warhorse": (None, "Mount", "1a", True), "Wyvern": (None, "Creature", "2b", False)},
        )
        self.assertEqual(list(items["Warhorse"].availabilities.values_list("cost", "rarity")), [(80, 11)])
        self.assertEqual(list(items["Wyvern"].availabilities.all()), [])

    def test_a_beast_without_a_profile_is_stored_at_zero(self):
        seed([{"name": "Raven", "kind": "pet", "has_profile": False, **STATS, "armour_save": "6+"}])

        raven = BestiaryEntry.objects.get(name="Raven")
        self.assertEqual((raven.has_profile, raven.movement, raven.wounds, raven.armour_save), (False, 0, 0, None))

    def test_a_rating_bonus_must_be_a_whole_number_from_zero(self):
        for bonus in (-1, "lots", 2.5):
            with self.subTest(bonus=bonus):
                with self.assertRaisesMessage(CommandError, "Bestiary entry 'Rhinox': rating_bonus"):
                    seed([{"name": "Rhinox", "kind": "mount", "rating_bonus": bonus, **STATS}])
                self.assertFalse(BestiaryEntry.objects.exists())


class CommittedBestiaryTests(TestCase):
    """The committed files: 31 beasts, each with its Animal item."""

    @classmethod
    def setUpTestData(cls) -> None:
        run("seed_bestiary")

    def beasts(self) -> dict[str, BestiaryEntry]:
        return {beast.name: beast for beast in BestiaryEntry.objects.select_related("animal_item")}

    def test_the_book_holds_14_mounts_6_pets_and_11_creatures_each_with_its_item(self):
        beasts = self.beasts()

        self.assertEqual(Counter(beast.kind for beast in beasts.values()), {"mount": 14, "creature": 11, "pet": 6})
        self.assertEqual(Item.objects.filter(type="Animal").count(), 31)
        self.assertEqual({beast.animal_item.subtype for beast in beasts.values() if beast.kind == "pet"}, {"Pet"})
        self.assertIn("Wardogs", beasts)
        self.assertNotIn("Wardog", beasts)  # Mutiny in Marienburg's duplicate with an empty profile

    def test_the_shop_sells_all_but_three_marienburg_creatures(self):
        unsold = sorted(name for name, beast in self.beasts().items() if not beast.available_in_shop)

        self.assertEqual(unsold, ["Giant Rat", "Wild Dog", "Wyvern"])
        self.assertEqual(Item.objects.filter(type="Animal", listed=True).count(), 28)
        rat = self.beasts()["Giant Rat"].animal_item
        self.assertEqual(list(rat.availabilities.values_list("cost", "rarity", "variable_cost")), [(0, 9, "15 warptokens")])  # fmt: skip

    def test_the_pets_and_the_wild_boar_have_no_profile(self):
        without = sorted(name for name, beast in self.beasts().items() if not beast.has_profile)

        self.assertEqual(
            without,
            [
                "Giant Rat",
                "Lizard-Hawk",
                "Pelican",
                "Polecat",
                "Raven",
                "Sacrificial Goat/Sheep",
                "Snake",
                "Wild Boar/Pig",
            ],  # fmt: skip
        )

    def test_mounts_add_their_rating_bonus(self):
        bonuses = {name: beast.rating_bonus for name, beast in self.beasts().items() if beast.rating_bonus is not None}

        self.assertEqual(bonuses, {"Riding/Draft Horse": 3, "Warhorse": 5, "Rhinox": 20, "Temple Dog": 20})

    def test_every_grade_is_one_of_ours_and_marienburgs_higher_ones_are_2b(self):
        grades = {name: beast.animal_item.grade for name, beast in self.beasts().items()}

        self.assertLessEqual(set(grades.values()), GRADES)
        self.assertEqual({grades[name] for name in ("Dragon Turtle", "Geckamand", "Lizard-Hawk", "Tiger", "Wyvern")}, {"2b"})  # fmt: skip

    def test_a_second_run_updates_the_same_rows(self):
        before = sorted(Item.objects.filter(type="Animal").values_list("id", "bestiary_entry_id"))

        output = run("seed_bestiary")

        self.assertIn("Entries created: 0, updated: 31. Items created: 0, updated: 31.", output)
        self.assertEqual(sorted(Item.objects.filter(type="Animal").values_list("id", "bestiary_entry_id")), before)
