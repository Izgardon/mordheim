"""Characterisation: the catalogue seeders on small files (pass 5; BUG-16, BUG-17, BUG-51, SEC-06, CAT-TEST-14).

The upserts in `seed_items`, `seed_skills`, `seed_spells_and_special` and `seed_bestiary`'s Animal items match on name
and type without `campaign IS NULL`, and the restriction and property caches read every campaign's rows (BUG-17).
`seed_races` and `seed_restrictions` scope their upserts to the book; only `seed_bestiary` is atomic. Five seeders'
`--truncate` delete campaign rows too, and everything that references them (BUG-16). The full `seed_all` run on the
committed data is in `test_catalogue_characterisation_seeding.py`.
"""

import json
from collections.abc import Iterator
from contextlib import contextmanager
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any
from unittest import expectedFailure

from django.contrib.auth import get_user_model
from django.core.exceptions import MultipleObjectsReturned
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from apps.bestiary.models import BestiaryEntry, HiredSwordProfile, WarbandBestiaryFavourite
from apps.campaigns.models import Campaign, CampaignSettings
from apps.items.models import Item, ItemAvailability, ItemAvailabilityRestriction, ItemProperty
from apps.items.services import sync_half_price_armour_for_campaign
from apps.races.models import Race
from apps.restrictions.models import Restriction
from apps.restrictions.utils import _RESTRICTION_CORRECTIONS, parse_unique_to
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell
from apps.warbands.models import Hero, Warband, WarbandItem

from .catalogue_support import STATS


@contextmanager
def data_file(rows: list[dict[str, Any]]) -> Iterator[str]:
    """A temporary JSON file holding `rows`, as a path."""
    with TemporaryDirectory() as folder:
        path = Path(folder) / "data.json"
        path.write_text(json.dumps(rows), encoding="utf-8")
        yield str(path)


def run(command: str, **options: Any) -> str:
    output = StringIO()
    call_command(command, stdout=output, **options)
    return output.getvalue()


def seed_items(rows: list[dict[str, Any]], properties: list[dict[str, Any]] | None = None, **options: Any) -> str:
    """seed_items on these item rows and property rows (none by default)."""
    with data_file(rows) as items, data_file(properties or []) as props:
        return run("seed_items", json_path=items, properties_path=props, **options)


def book_item(name: str, cost: int, **fields: Any) -> Item:
    item = Item.objects.create(name=name, **{"type": "Weapon", "subtype": "Melee", **fields})
    ItemAvailability.objects.create(item=item, cost=cost, rarity=2)
    return item


def costs(item: Item) -> list[int]:
    return list(ItemAvailability.objects.filter(item=item).values_list("cost", flat=True))


class SeederTestCase(TestCase):
    campaign: Campaign
    user: Any
    warband: Warband

    @classmethod
    def setUpTestData(cls) -> None:
        cls.campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        CampaignSettings.objects.create(campaign=cls.campaign)
        cls.user = get_user_model().objects.create_user(username="pia@example.com", email="pia@example.com")
        cls.warband = Warband.objects.create(campaign=cls.campaign, user=cls.user, name="Monks", faction="Sisters")

    def junk_restriction(self, restriction_type: str, text: str) -> Restriction:
        """A global restriction added through POST /restrictions/ by any signed-in user (SEC-06)."""
        client = APIClient()
        client.force_authenticate(user=self.user)
        response = client.post("/api/restrictions/", {"type": restriction_type, "restriction": text}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return Restriction.objects.get(id=response.data["id"])


class SeederUpsertTests(SeederTestCase):
    def test_seed_items_stops_at_a_campaign_item_of_a_book_name_and_type_and_keeps_what_it_wrote(self):
        # Characterises current behaviour (BUG-17, pinned; flips in PR A: campaign IS NULL, and atomic)
        club = book_item("Club", 3, description="old")
        book_item("Axe", 5)
        book_item("Axe", 25, campaign=self.campaign)
        rows = [
            {"name": "Club", "type": "Weapon", "cost": 4, "description": "new"},
            {"name": "Axe", "type": "Weapon", "cost": 5},
            {"name": "Zweihander", "type": "Weapon", "cost": 15},
        ]

        with self.assertRaises(MultipleObjectsReturned):
            seed_items(rows)

        club.refresh_from_db()
        self.assertEqual((club.description, costs(club)), ("new", [4]))
        self.assertFalse(Item.objects.filter(name="Zweihander").exists())

    def test_seed_items_rewrites_a_campaign_item_when_the_book_has_none_of_its_name(self):
        # Characterises current behaviour (BUG-17, pinned; flips in PR A: a book Axe is created beside it)
        house_axe = book_item("Axe", 25, campaign=self.campaign, description="House axe")

        seed_items([{"name": "Axe", "type": "Weapon", "cost": 5, "description": "Book axe"}])

        house_axe.refresh_from_db()
        self.assertEqual((house_axe.campaign_id, house_axe.description, costs(house_axe)), (self.campaign.id, "Book axe", [5]))  # fmt: skip
        self.assertFalse(Item.objects.filter(name="Axe", campaign__isnull=True).exists())

    def test_seed_items_stops_at_a_campaign_property_of_a_book_name_and_type(self):
        # Characterises current behaviour (BUG-17, pinned; flips in PR A): a property row without an id is upserted
        # by name and type, whatever its campaign
        ItemProperty.objects.create(name="Parry", type="Weapon")
        ItemProperty.objects.create(name="Parry", type="Weapon", campaign=self.campaign)

        with self.assertRaises(MultipleObjectsReturned):
            seed_items([], properties=[{"name": "Parry", "type": "Weapon", "description": "Parries."}])

    def test_seed_items_links_a_junk_global_restriction_of_the_same_text(self):
        # Characterises current behaviour (SEC-06, BUG-17, pinned; flips in PR A): the restriction cache is keyed by
        # text across every row, and the junk "Warband Group" row is read after the book's "Warband" one
        Restriction.objects.create(type="Warband", restriction="Mercenaries")
        junk = self.junk_restriction("Warband Group", "Mercenaries")

        seed_items([{"name": "Pistol", "type": "Weapon", "cost": 15, "unique_to": "Mercenaries only"}])

        links = ItemAvailabilityRestriction.objects.filter(item_availability__item__name="Pistol")
        self.assertEqual(list(links.values_list("restriction_id", flat=True)), [junk.id])

    def test_seed_restrictions_stops_at_a_junk_global_restriction_of_a_book_text(self):
        # Characterises current behaviour (SEC-06, pinned; flips in PR A: no POST, and nulls_distinct=False)
        Restriction.objects.create(type="Warband", restriction="Mercenaries")
        self.junk_restriction("Warband", "Mercenaries")

        with data_file([{"type": "Warband", "restriction": "Mercenaries"}]) as path:
            with self.assertRaises(MultipleObjectsReturned):
                run("seed_restrictions", json_path=path)

    def test_seed_restrictions_and_seed_races_upsert_the_book_and_leave_campaign_rows_alone(self):
        Restriction.objects.create(type="Warband", restriction="Mercenaries", campaign=self.campaign)
        Race.objects.create(name="Human", campaign=self.campaign, movement=9)

        with data_file([{"type": "Warband", "restriction": "Mercenaries"}]) as path:
            run("seed_restrictions", json_path=path)
        with data_file([{"name": "Human", **STATS}]) as path:
            run("seed_races", json_path=path)

        self.assertCountEqual(Restriction.objects.values_list("campaign_id", flat=True), [None, self.campaign.id])
        self.assertCountEqual(Race.objects.values_list("campaign_id", "movement"), [(None, 4), (self.campaign.id, 9)])

    def test_seed_skills_stops_at_a_campaign_skill_of_a_book_name_and_type(self):
        # Characterises current behaviour (BUG-17, pinned; flips in PR A)
        Skill.objects.create(name="Infiltration", type="Skaven")
        Skill.objects.create(name="Infiltration", type="Skaven", campaign=self.campaign)

        with data_file([{"name": "Infiltration", "type": "Skaven Skills", "description": "Sneaks."}]) as path:
            with self.assertRaises(MultipleObjectsReturned):
                run("seed_skills", json_path=path)

    def test_seed_spells_and_special_stop_at_a_campaign_spell_of_a_book_name_and_type(self):
        # Characterises current behaviour (BUG-17, pinned; flips in PR A); it reads the committed files only
        Spell.objects.create(name="Lifestealer", type="Necromancy")
        Spell.objects.create(name="Lifestealer", type="Necromancy", campaign=self.campaign)

        with self.assertRaises(MultipleObjectsReturned):
            run("seed_spells_and_special")

    def test_seed_bestiary_stops_at_a_campaign_animal_item_and_keeps_nothing_it_wrote(self):
        # Characterises current behaviour (BUG-17, pinned; flips in PR A). seed_bestiary is the one atomic seeder,
        # so the Bear written before the crash is rolled back.
        book_item("Warhound", 15, type="Animal", subtype="Animal")
        book_item("Warhound", 15, type="Animal", subtype="Animal", campaign=self.campaign)
        rows: list[dict[str, Any]] = [
            {"name": "Bear", "type": "Animal", "movement": 6},
            {"name": "Warhound", "type": "Animal", "shop_item": {"availabilities": [{"cost": 15, "rarity": 2}]}},
        ]

        with data_file(rows) as path, self.assertRaises(MultipleObjectsReturned):
            run("seed_bestiary", json_paths=[path])

        self.assertFalse(BestiaryEntry.objects.exists())

    def test_seed_bestiary_matches_entries_in_the_book_only(self):
        house = BestiaryEntry.objects.create(name="Warhound", type="Animal", campaign=self.campaign, movement=9)
        rows = [{"name": "Warhound", "type": "Animal", "movement": 6, "shop_item": {"availabilities": [{"cost": 15}]}}]

        with data_file(rows) as path:
            run("seed_bestiary", json_paths=[path])

        house.refresh_from_db()
        book = BestiaryEntry.objects.get(name="Warhound", campaign__isnull=True)
        self.assertEqual((house.movement, book.movement), (9, 6))
        self.assertEqual(Item.objects.get(name="Warhound", type="Animal").bestiary_entry_id, book.id)


class HouseRuleReseedTests(SeederTestCase):
    """BUG-51 (pass 5 half): clones copy their book armour once; only a sync of the rule copies it again."""

    def setUp(self) -> None:
        super().setUp()
        self.armour = book_item("Heavy Armour", 50, type="Armour", subtype="Armour", save_value="5+")
        sync_half_price_armour_for_campaign(self.campaign.id)
        self.clone = Item.objects.get(campaign=self.campaign, source_item=self.armour)

    @expectedFailure
    def test_a_reseeded_armour_price_reaches_the_half_price_clone(self):
        # BUG-51 (seed_items re-syncs every campaign's rule) after BUG-17 (the reseed stops crashing on the clone)
        seed_items([{"name": "Heavy Armour", "type": "Armour", "subtype": "Armour", "cost": 60}])

        self.assertEqual((costs(self.armour), costs(self.clone)), ([60], [30]))

    def test_the_clone_keeps_its_price_until_the_rule_is_synced_again(self):
        # Characterises current behaviour (BUG-51, pinned; flips in PR A: seed_items ends with the sync)
        ItemAvailability.objects.filter(item=self.armour).update(cost=60)  # what a reseed would write

        self.assertEqual(costs(self.clone), [25])
        sync_half_price_armour_for_campaign(self.campaign.id)
        self.assertEqual(costs(Item.objects.get(campaign=self.campaign, source_item=self.armour)), [30])


class SeederTruncateTests(SeederTestCase):
    """BUG-16's seeder half: `--truncate` deletes campaign rows and, through CASCADE, every copy of them."""

    def setUp(self) -> None:
        super().setUp()
        self.hero = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch")

    def test_seed_items_truncate_deletes_campaign_items_their_copies_and_campaign_properties(self):
        # Characterises current behaviour (BUG-16, pinned; flips in PR A: --truncate goes)
        charm = book_item("Lucky Charm", 25, campaign=self.campaign)
        self.hero.hero_items.create(item=charm, cost=25)
        WarbandItem.objects.create(warband=self.warband, item=charm, quantity=1, cost=25)
        ItemProperty.objects.create(name="Lucky", campaign=self.campaign)

        seed_items([{"name": "Club", "type": "Weapon", "cost": 3}], truncate=True)

        self.assertEqual(list(Item.objects.values_list("name", "campaign_id")), [("Club", None)])
        self.assertEqual((self.hero.hero_items.count(), WarbandItem.objects.count()), (0, 0))
        self.assertFalse(ItemProperty.objects.exists())

    def test_seed_skills_truncate_deletes_campaign_skills_and_the_heroes_who_knew_them_keep_nothing(self):
        # Characterises current behaviour (BUG-16, pinned; flips in PR A)
        skill = Skill.objects.create(name="Ambush", type="Combat", campaign=self.campaign)
        self.hero.hero_skills.create(skill=skill)

        with data_file([{"name": "Sprint", "type": "Speed", "description": "Runs."}]) as path:
            run("seed_skills", json_path=path, truncate=True)

        self.assertEqual(list(Skill.objects.values_list("name", "campaign_id")), [("Sprint", None)])
        self.assertEqual(self.hero.hero_skills.count(), 0)

    def test_seed_spells_and_special_truncate_deletes_campaign_spells_and_specials(self):
        # Characterises current behaviour (BUG-16, pinned; flips in PR A)
        spell = Spell.objects.create(name="Gloom", type="House", campaign=self.campaign)
        special = Special.objects.create(name="Fearsome", type="House", campaign=self.campaign)
        self.hero.hero_spells.create(spell=spell)
        self.hero.hero_specials.create(special=special)

        run("seed_spells_and_special", truncate=True)

        self.assertFalse(Spell.objects.filter(campaign__isnull=False).exists())
        self.assertFalse(Special.objects.filter(campaign__isnull=False).exists())
        self.assertEqual((self.hero.hero_spells.count(), self.hero.hero_specials.count()), (0, 0))

    def test_seed_restrictions_truncate_deletes_campaign_restrictions_their_links_and_the_campaigns_item_settings(self):
        # Characterises current behaviour (BUG-16, pinned; flips in PR A)
        theirs = Restriction.objects.create(type="Warband", restriction="Sisters", campaign=self.campaign)
        setting = Restriction.objects.create(type="Setting", restriction="Lustria Setting")
        CampaignSettings.objects.get(campaign=self.campaign).item_settings.add(setting)
        relic = book_item("Relic", 10)
        ItemAvailabilityRestriction.objects.create(item_availability=relic.availabilities.get(), restriction=theirs)

        with data_file([{"type": "Warband", "restriction": "Mercenaries"}]) as path:
            run("seed_restrictions", json_path=path, truncate=True)

        self.assertEqual(list(Restriction.objects.values_list("restriction", flat=True)), ["Mercenaries"])
        self.assertFalse(ItemAvailabilityRestriction.objects.exists())
        self.assertEqual(CampaignSettings.objects.get(campaign=self.campaign).item_settings.count(), 0)

    def test_seed_bestiary_truncate_deletes_only_book_entries_with_their_profiles_and_favourites(self):
        book = BestiaryEntry.objects.create(name="Ogre", type="Hired Sword")
        HiredSwordProfile.objects.create(bestiary_entry=book, hire_cost=80)
        WarbandBestiaryFavourite.objects.create(warband=self.warband, bestiary_entry=book)
        house = BestiaryEntry.objects.create(name="Warhound", type="Animal", campaign=self.campaign)

        with data_file([{"name": "Bear", "type": "Animal"}]) as path:
            run("seed_bestiary", json_paths=[path], truncate=True)

        self.assertEqual(sorted(BestiaryEntry.objects.values_list("name", flat=True)), ["Bear", "Warhound"])
        self.assertTrue(BestiaryEntry.objects.filter(id=house.id).exists())
        self.assertEqual((HiredSwordProfile.objects.count(), WarbandBestiaryFavourite.objects.count()), (0, 0))


class ParseUniqueToTests(SimpleTestCase):
    """CAT-TEST-14: `parse_unique_to` turns a source "unique to" text into restrictions with notes."""

    def parsed(self, text: str) -> list[tuple[str, str, str]]:
        return [(row["type"], row["restriction"], row["additional_note"]) for row in parse_unique_to(text)]

    def test_the_docstring_examples_and_other_shapes(self):
        cases: list[tuple[str, list[tuple[str, str, str]]]] = [
            ("Goblins only", [("Warband", "Goblins", "")]),
            ("Khemri Setting", [("Setting", "Khemri Setting", "")]),
            ("Shadow Warriors - Shadow Weavers", [("Warband", "Shadow Warriors", "Shadow Weavers")]),
            (
                "Dark Elves, Lizardmen, Norse and Marauders only",
                [
                    ("Warband", "Dark Elves", ""),
                    ("Warband", "Lizardmen", ""),
                    ("Warband", "Norse Explorers", ""),
                    ("Warband", "Marauders of Chaos", ""),
                ],
            ),
            ("Pirates only, one per model", [("Warband", "Pirates", "one per model")]),
            ("Kislev - Heroes only", [("Warband", "Kislev", "Heroes")]),
            (
                "Mercenaries, Witch Hunters, and Sisters of Sigmar only",
                [
                    ("Warband", "Mercenaries", ""),
                    ("Warband", "Witch Hunters", ""),
                    ("Warband", "Sisters of Sigmar", ""),
                ],
            ),
            ("Pirate Gunners only, max one per warband", [("Warband", "Pirates", "Gunners, max one per warband")]),
            ("Skaven (Clan Eshin, Clan Pestilens) only", [("Warband", "Skaven (Clan Eshin, Clan Pestilens)", "")]),
            ("", []),
            ("   ", []),
        ]
        for text, expected in cases:
            with self.subTest(text=text):
                self.assertEqual(self.parsed(text), expected)

    def test_every_correction(self):
        expected = {
            "Battle Monks": ("Battle Monks of Cathay", ""),
            "Bretonnian Warhorses": ("Bretonnia", ""),
            "Dark Elves Beastmaster": ("Dark Elves", "Beastmaster"),
            "Dragon Monks": ("Battle Monks of Cathay", "Dragon Monks"),
            "Forest": ("Forest Goblins", ""),
            "Grave Guards": ("Undead", "Grave Guard"),
            "Hobgoblins": ("Chaos Dwarfs", "Hobgoblins"),
            "Kislevite Heroes": ("Kislev", "Heroes"),
            "Marauders": ("Marauders of Chaos", ""),
            "Marauders of Chaos Heroes with the Chosen of Chaos skill": (
                "Marauders of Chaos",
                "Heroes with the Chosen of Chaos skill",
            ),  # fmt: skip
            "Marauders with Chosen of Chaos skill": ("Marauders of Chaos", "Heroes with the Chosen of Chaos skill"),
            "Necromancer": ("Undead", "Necromancers"),
            "Necromancers": ("Undead", "Necromancers"),
            "Norse": ("Norse Explorers", ""),
            "Outlaws of Stirwood Forest Heroes": ("Outlaws of Stirwood Forest", "Heroes"),
            "Pirate Gunners": ("Pirates", "Gunners"),
            "Pirate Heroes": ("Pirates", "Heroes"),
            "Possessed warbands": ("Possessed", ""),
            "Tomb Guardians Liche Priest": ("Tomb Guardians", "Liche Priest"),
            "Tomb Guardians Tomb Lord": ("Tomb Guardians", "Tomb Lord"),
            "Tomb Guardians Tomb lord": ("Tomb Guardians", "Tomb Lord"),
            "Vampires": ("Undead", "Vampires"),
            "Warrior-Priests": ("Warrior Priests", ""),
        }
        self.assertEqual(set(expected), set(_RESTRICTION_CORRECTIONS))
        for raw, (restriction, note) in expected.items():
            with self.subTest(raw=raw):
                self.assertEqual(self.parsed(f"{raw} only"), [("Warband", restriction, note)])
