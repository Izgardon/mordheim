"""seed_bestiary (the bestiary rewrite step 3): `bestiary.json` and, for the first time, Mutiny in Marienburg's
`mim-bestiary.json`; Border Town Burning's Beasts of the East (`btb-bestiary.json`) since 7 Nov 2026.

Each row names its kind, whether it has a profile (off: the stats are kept at 0 and the save empty), what it adds to a
rider's rating and whether the shop sells it; every beast gets its Animal item, listed when it is sold, with the
prices of its `shop_item` (or, once the settings and warband types are seeded, the catalogue import's entry of its
name). A row without a known kind, or with a rating bonus that isn't a whole number from 0, stops the run with nothing
kept. The whole catalogue's run is in test_catalogue_characterisation_seeding.py.
"""

from collections import Counter
from typing import Any

from django.core.management.base import CommandError
from django.test import TestCase

from apps.bestiary.models import BestiaryEntry
from apps.campaigns.models import CampaignType
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

    def test_a_book_item_of_the_beasts_name_becomes_its_item(self):
        # the Magic Carpet was a Miscellaneous item of the catalogue import's until the Khemri equipment page made
        # it a mount (11 Nov 2026): the beast takes that row rather than a second item of the same name
        held = Item.objects.create(name="Magic Carpet", type="Miscellaneous")

        seed([{"name": "Magic Carpet", "kind": "mount", **STATS, "shop_item": SHOP}])

        [item] = Item.objects.filter(name="Magic Carpet")
        beast = BestiaryEntry.objects.get(name="Magic Carpet")
        self.assertEqual((item.pk, item.type, item.subtype, item.bestiary_entry_id), (held.pk, "Animal", "Mount", beast.pk))  # fmt: skip

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
            {name: (item.campaign_id, item.subtype, item.listed) for name, item in items.items()},
            {"Warhorse": (None, "Mount", True), "Wyvern": (None, "Creature", False)},
        )
        self.assertEqual(
            list(items["Warhorse"].availabilities.values_list("cost", "rarity", "for_everyone", "note")),
            [(80, 11, True, "Humans only")],  # the settings aren't seeded: the shop data, its "unique to" as the note
        )
        self.assertEqual(list(items["Wyvern"].availabilities.all()), [])

    def test_a_beast_without_a_profile_is_stored_at_zero(self):
        seed([{"name": "Raven", "kind": "pet", "has_profile": False, **STATS, "armour_save": "6+"}])

        raven = BestiaryEntry.objects.get(name="Raven")
        self.assertEqual((raven.has_profile, raven.movement, raven.wounds, raven.armour_save), (False, 0, 0, None))

    def test_a_stat_is_kept_as_the_book_writes_it(self):
        # Border Town Burning's beasts (William, 7 Nov 2026): a rooted plant's "-", the Hydra's "5*", the Giant's
        # "special"
        seed([{"name": "Hydra", "kind": "creature", **STATS, "movement": "-", "attacks": "5*", "leadership": "special"}])  # fmt: skip

        hydra = BestiaryEntry.objects.get(name="Hydra")
        self.assertEqual((hydra.movement, hydra.attacks, hydra.leadership), (None, 5, None))
        self.assertEqual(hydra.written_stats, {"movement": "-", "attacks": "*", "leadership": "special"})

    def test_a_beasts_own_setting_is_its_items(self):
        run("seed_settings")
        seed([{"name": "Ymir", "kind": "creature", **STATS, "setting": "border-town-burning", "shop_item": SHOP}])

        item = BestiaryEntry.objects.select_related("animal_item__campaign_type").get(name="Ymir").animal_item
        self.assertEqual(item.campaign_type_id, CampaignType.objects.get(slug="border-town-burning").id)  # not 1a

    def test_a_rating_bonus_must_be_a_whole_number_from_zero(self):
        for bonus in (-1, "lots", 2.5):
            with self.subTest(bonus=bonus):
                with self.assertRaisesMessage(CommandError, "Bestiary entry 'Rhinox': rating_bonus"):
                    seed([{"name": "Rhinox", "kind": "mount", "rating_bonus": bonus, **STATS}])
                self.assertFalse(BestiaryEntry.objects.exists())


class CommittedBestiaryTests(TestCase):
    """The committed files: 63 beasts, each with its Animal item."""

    @classmethod
    def setUpTestData(cls) -> None:
        run("seed_settings")
        run("seed_warband_types")
        run("seed_bestiary")

    def beasts(self) -> dict[str, BestiaryEntry]:
        return {beast.name: beast for beast in BestiaryEntry.objects.select_related("animal_item")}

    def test_the_book_holds_15_mounts_12_pets_and_39_creatures_each_with_its_item(self):
        beasts = self.beasts()

        self.assertEqual(Counter(beast.kind for beast in beasts.values()), {"mount": 15, "creature": 39, "pet": 12})
        self.assertEqual(Item.objects.filter(type="Animal").count(), 66)
        self.assertEqual({beast.animal_item.subtype for beast in beasts.values() if beast.kind == "pet"}, {"Pet"})
        self.assertIn("Wardogs", beasts)
        self.assertNotIn("Wardog", beasts)  # Mutiny in Marienburg's duplicate with an empty profile

    def test_the_shop_sells_all_but_three_marienburg_creatures_and_the_sorcerous_societys_familiars(self):
        unsold = sorted(name for name, beast in self.beasts().items() if not beast.available_in_shop)

        # the familiars come as the Sorcerous Society's Familiar (Sorcerous Society) item (William, 6 Nov 2026)
        familiars = ["Cat Familiar", "Dog Familiar", "Raven Familiar", "Viper Familiar"]
        # Border Town Burning's Beasts of the East are met in battle, never bought
        bordertown = CampaignType.objects.get(slug="border-town-burning").id
        beasts_of_the_east = [name for name, beast in self.beasts().items() if beast.animal_item.campaign_type_id == bordertown]  # fmt: skip
        self.assertEqual(len(beasts_of_the_east), 28)
        self.assertEqual(unsold, sorted(["Giant Rat", "Wild Dog", "Wyvern", *familiars, *beasts_of_the_east]))
        self.assertEqual(Item.objects.filter(type="Animal", listed=True).count(), 31)
        rat = self.beasts()["Giant Rat"].animal_item
        self.assertEqual(list(rat.availabilities.values_list("cost", "rarity", "cost_note")), [(0, 9, "15 warptokens")])  # fmt: skip

    def test_the_pets_and_the_wild_boar_have_no_profile(self):
        without = sorted(name for name, beast in self.beasts().items() if not beast.has_profile)

        self.assertEqual(
            without,
            [
                "Falcon/Hawk",
                "Giant Rat",
                "Lizard-Hawk",
                "Owl",
                "Pelican",
                "Polecat",
                "Raven",
                "Sacrificial Goat/Sheep",
                "Wild Boar/Pig",
            ],  # fmt: skip
        )

    def test_mounts_add_their_rating_bonus(self):
        bonuses = {name: beast.rating_bonus for name, beast in self.beasts().items() if beast.rating_bonus is not None}

        self.assertEqual(bonuses, {"Riding/Draft Horse": 3, "Warhorse": 5, "Rhinox": 20, "Temple Dog": 20})

    def test_every_item_has_its_setting_the_imports_animals_theirs_and_marienburgs_beasts_marienburg(self):
        settings = {name: beast.animal_item.campaign_type.slug for name, beast in self.beasts().items() if beast.animal_item.campaign_type}  # fmt: skip

        self.assertEqual(len(settings), 66)
        self.assertEqual({settings[name] for name in ("Dragon Turtle", "Geckamand", "Lizard-Hawk", "Tiger", "Wyvern")}, {"mutiny-in-marienburg"})  # fmt: skip
        self.assertEqual((settings["Warhorse"], settings["Chaos Steed"]), ("mordheim", "mordheim-1b"))
        self.assertEqual(settings["Viper Familiar"], "mordheim-2a")
        steed = self.beasts()["Chaos Steed"].animal_item
        self.assertTrue(steed.rule_links.exists())
        self.assertEqual(steed.subtype, "Mount")

    def test_a_second_run_updates_the_same_rows(self):
        before = sorted(Item.objects.filter(type="Animal").values_list("id", "bestiary_entry_id"))

        output = run("seed_bestiary")

        self.assertIn("Entries created: 0, updated: 66. Items created: 0, updated: 66.", output)
        self.assertEqual(sorted(Item.objects.filter(type="Animal").values_list("id", "bestiary_entry_id")), before)
