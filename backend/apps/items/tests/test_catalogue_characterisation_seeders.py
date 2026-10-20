"""The catalogue seeders on small files (pass 5; BUG-16, BUG-17, BUG-51, SEC-06, CAT-TEST-14).

Since PR A every seeder reads and writes the book only (`campaign IS NULL`, no add-on), matches restrictions by text
and type, and runs in one transaction; none takes `--truncate` (BUG-16: it deleted campaign rows and every copy of
them). The full `seed_all` run on the committed data is in `test_catalogue_characterisation_seeding.py`.
"""

import json
from collections.abc import Iterator
from contextlib import contextmanager
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction
from django.test import SimpleTestCase, TestCase

from apps.bestiary.models import BestiaryEntry
from apps.campaigns.models import Campaign, CampaignHouseRule, CampaignSettings
from apps.items.models import Item, ItemAvailability, ItemAvailabilityRestriction, ItemProperty
from apps.items.services import HALF_PRICE_ARMOUR_EFFECT_KEY, sync_half_price_armour_for_campaign
from apps.races.models import Race
from apps.restrictions.models import Restriction
from apps.restrictions.utils import _RESTRICTION_CORRECTIONS, parse_unique_to
from apps.skills.models import Skill
from apps.spells.models import Spell
from apps.warbands.models import Hero, Warband

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
        """A global restriction like the ones POST /restrictions/ let any signed-in user add before PR A removed it
        (SEC-06); a database that kept them holds them still."""
        return Restriction.objects.create(type=restriction_type, restriction=text)


class SeederUpsertTests(SeederTestCase):
    def test_seed_items_updates_the_book_item_beside_a_campaign_item_of_its_name_and_type(self):
        # BUG-17 (was pinned: seed_items stopped at the campaign's Axe and kept what it had written; flipped in PR A:
        # the upsert matches the book only)
        club = book_item("Club", 3, description="old")
        axe = book_item("Axe", 5)
        house_axe = book_item("Axe", 25, campaign=self.campaign, description="House axe")
        rows = [
            {"name": "Club", "type": "Weapon", "cost": 4, "description": "new"},
            {"name": "Axe", "type": "Weapon", "cost": 6, "description": "Book axe"},
            {"name": "Zweihander", "type": "Weapon", "cost": 15},
        ]

        seed_items(rows)

        club.refresh_from_db()
        axe.refresh_from_db()
        house_axe.refresh_from_db()
        self.assertEqual((club.description, costs(club)), ("new", [4]))
        self.assertEqual((axe.description, costs(axe)), ("Book axe", [6]))
        self.assertEqual((house_axe.campaign_id, house_axe.description, costs(house_axe)), (self.campaign.id, "House axe", [25]))  # fmt: skip
        self.assertTrue(Item.objects.filter(name="Zweihander", campaign__isnull=True).exists())

    def test_seed_items_creates_a_book_item_beside_a_campaign_item_of_its_name(self):
        # BUG-17 (was pinned: the campaign's Axe was rewritten into the book's; flipped in PR A)
        house_axe = book_item("Axe", 25, campaign=self.campaign, description="House axe")

        seed_items([{"name": "Axe", "type": "Weapon", "cost": 5, "description": "Book axe"}])

        house_axe.refresh_from_db()
        self.assertEqual((house_axe.campaign_id, house_axe.description, costs(house_axe)), (self.campaign.id, "House axe", [25]))  # fmt: skip
        book = Item.objects.get(name="Axe", campaign__isnull=True)
        self.assertEqual((book.description, costs(book)), ("Book axe", [5]))

    def test_seed_items_updates_the_book_property_and_leaves_the_campaign_property_alone(self):
        # BUG-17 (was pinned: a property row without an id stopped at a campaign property of its name and type)
        book = ItemProperty.objects.create(name="Parry", type="Weapon")
        house = ItemProperty.objects.create(name="Parry", type="Weapon", campaign=self.campaign, description="House")

        seed_items([], properties=[{"name": "Parry", "type": "Weapon", "description": "Parries."}])

        book.refresh_from_db()
        house.refresh_from_db()
        self.assertEqual((book.description, house.description), ("Parries.", "House"))

    def test_seed_items_refuses_a_property_id_a_campaign_property_holds(self):
        house = ItemProperty.objects.create(name="Lucky", type="Weapon", campaign=self.campaign)

        with self.assertRaisesMessage(CommandError, f"Property id {house.id} (Parry) belongs to a campaign's property"):
            seed_items([], properties=[{"id": house.id, "name": "Parry", "type": "Weapon"}])

        house.refresh_from_db()
        self.assertEqual((house.name, house.campaign_id), ("Lucky", self.campaign.id))

    def test_seed_items_links_the_book_restriction_of_the_same_text_and_type(self):
        # SEC-06, BUG-17 (was pinned: the restriction cache was keyed by text across every row, so the junk "Warband
        # Group" row read last was linked; flipped in PR A: the book only, by text and type)
        book = Restriction.objects.create(type="Warband", restriction="Mercenaries")
        self.junk_restriction("Warband Group", "Mercenaries")
        Restriction.objects.create(type="Warband", restriction="Mercenaries", campaign=self.campaign)

        seed_items([{"name": "Pistol", "type": "Weapon", "cost": 15, "unique_to": "Mercenaries only"}])

        links = ItemAvailabilityRestriction.objects.filter(item_availability__item__name="Pistol")
        self.assertEqual(list(links.values_list("restriction_id", flat=True)), [book.id])
        self.assertEqual(Restriction.objects.filter(restriction="Mercenaries").count(), 3)

    def test_no_junk_global_restriction_can_share_a_book_text_and_type(self):
        # SEC-06 (was pinned: a junk global row of a book text stopped seed_restrictions; flipped in PR A: no POST,
        # and nulls_distinct=False keeps the book to one row per text and type)
        Restriction.objects.create(type="Warband", restriction="Mercenaries")

        with self.assertRaises(IntegrityError), transaction.atomic():
            self.junk_restriction("Warband", "Mercenaries")
        with data_file([{"type": "Warband", "restriction": "Mercenaries"}]) as path:
            run("seed_restrictions", json_path=path)

        self.assertEqual(Restriction.objects.filter(restriction="Mercenaries").count(), 1)

    def test_a_group_restriction_the_book_holds_once_is_linked_whatever_its_type(self):
        # restrictions.json types 18 group restrictions "Warband Group" while "unique to" texts parse as "Warband"
        group = Restriction.objects.create(type="Warband Group", restriction="Skaven")
        Restriction.objects.create(type="Warband", restriction="Skaven", campaign=self.campaign)

        seed_items([{"name": "Warplock", "type": "Weapon", "cost": 15, "unique_to": "Skaven only"}])

        links = ItemAvailabilityRestriction.objects.filter(item_availability__item__name="Warplock")
        self.assertEqual(list(links.values_list("restriction_id", flat=True)), [group.id])
        self.assertEqual(Restriction.objects.filter(restriction="Skaven", campaign__isnull=True).count(), 1)

    def test_seed_restrictions_and_seed_races_upsert_the_book_and_leave_campaign_rows_alone(self):
        Restriction.objects.create(type="Warband", restriction="Mercenaries", campaign=self.campaign)
        Race.objects.create(name="Human", campaign=self.campaign, movement=9)

        with data_file([{"type": "Warband", "restriction": "Mercenaries"}]) as path:
            run("seed_restrictions", json_path=path)
        with data_file([{"name": "Human", **STATS}]) as path:
            run("seed_races", json_path=path)

        self.assertCountEqual(Restriction.objects.values_list("campaign_id", flat=True), [None, self.campaign.id])
        self.assertCountEqual(Race.objects.values_list("campaign_id", "movement"), [(None, 4), (self.campaign.id, 9)])

    def test_seed_skills_updates_the_book_skill_beside_a_campaign_skill_of_its_name_and_type(self):
        # BUG-17 (was pinned: seed_skills stopped at the campaign's skill; flipped in PR A)
        book = Skill.objects.create(name="Infiltration", type="Skaven")
        house = Skill.objects.create(name="Infiltration", type="Skaven", campaign=self.campaign, description="House")

        with data_file([{"name": "Infiltration", "type": "Skaven Skills", "description": "Sneaks."}]) as path:
            run("seed_skills", json_path=path)

        book.refresh_from_db()
        house.refresh_from_db()
        self.assertEqual((book.description, house.description), ("Sneaks.", "House"))

    def test_seed_spells_and_special_update_the_book_beside_a_campaign_spell_of_its_name_and_type(self):
        # BUG-17 (was pinned: they stopped at the campaign's spell; flipped in PR A); it reads the committed files
        book = Spell.objects.create(name="Lifestealer", type="Necromancy")
        house = Spell.objects.create(name="Lifestealer", type="Necromancy", campaign=self.campaign, description="House")

        run("seed_spells_and_special")

        book.refresh_from_db()
        house.refresh_from_db()
        self.assertNotEqual(book.description, "")
        self.assertEqual(house.description, "House")

    def test_seed_bestiary_writes_the_book_animal_item_beside_a_campaign_one(self):
        # BUG-17 (was pinned: seed_bestiary stopped at the campaign's Warhound item and kept nothing; flipped in PR A)
        house = book_item("Warhound", 15, type="Animal", subtype="Animal", campaign=self.campaign)
        shop = {"availabilities": [{"cost": 20, "rarity": 2}]}
        rows: list[dict[str, Any]] = [
            {"name": "Bear", "type": "Animal", **STATS},
            {"name": "Warhound", "type": "Animal", **STATS, "shop_item": shop},
        ]

        with data_file(rows) as path:
            run("seed_bestiary", json_paths=[path])

        book = Item.objects.select_related("bestiary_entry").get(name="Warhound", type="Animal", campaign__isnull=True)
        self.assertEqual((costs(book), book.bestiary_entry.name if book.bestiary_entry else None), ([20], "Warhound"))
        house.refresh_from_db()
        self.assertEqual((costs(house), house.bestiary_entry_id), ([15], None))
        self.assertEqual(sorted(BestiaryEntry.objects.values_list("name", flat=True)), ["Bear", "Warhound"])

    def test_seed_bestiary_matches_entries_in_the_book_only(self):
        house = BestiaryEntry.objects.create(name="Warhound", type="Animal", campaign=self.campaign, movement=9)
        shop = {"availabilities": [{"cost": 15}]}
        rows = [{"name": "Warhound", "type": "Animal", **STATS, "movement": 6, "shop_item": shop}]

        with data_file(rows) as path:
            run("seed_bestiary", json_paths=[path])

        house.refresh_from_db()
        book = BestiaryEntry.objects.get(name="Warhound", campaign__isnull=True)
        self.assertEqual((house.movement, book.movement), (9, 6))
        self.assertEqual(Item.objects.get(name="Warhound", type="Animal").bestiary_entry_id, book.id)


class SeederAtomicityTests(SeederTestCase):
    """BUG-17: each seeder writes everything or nothing."""

    def test_seed_items_failing_part_way_keeps_nothing(self):
        rows: list[dict[str, Any]] = [
            {"name": "Club", "type": "Weapon", "cost": 3},
            {"name": "Axe", "type": "Weapon", "properties": [999]},
        ]

        with self.assertRaisesMessage(CommandError, "Unknown property id 999 for item 'Axe'"):
            seed_items(rows)

        self.assertFalse(Item.objects.exists())

    def test_seed_races_failing_part_way_keeps_nothing(self):
        rows = [{"name": "Human", **STATS}, {"name": "Elf", **STATS, "movement": "fast"}]

        with data_file(rows) as path, self.assertRaises((CommandError, ValueError)):
            run("seed_races", json_path=path)

        self.assertFalse(Race.objects.exists())


class HouseRuleReseedTests(SeederTestCase):
    """BUG-51 (pass 5 half): clones copy their book armour once, so `seed_items` ends by syncing every campaign's
    rule again, through pass 4's one repricing path."""

    def setUp(self) -> None:
        super().setUp()
        self.armour = book_item("Heavy Armour", 50, type="Armour", subtype="Armour", save_value="5+")
        CampaignHouseRule.objects.create(campaign=self.campaign, title="Half price", effect_key=HALF_PRICE_ARMOUR_EFFECT_KEY)  # fmt: skip
        sync_half_price_armour_for_campaign(self.campaign.id)
        self.clone = Item.objects.get(campaign=self.campaign, source_item=self.armour)

    def test_a_reseeded_armour_price_reaches_the_half_price_clone(self):
        # BUG-51 (seed_items re-syncs every campaign's rule) after BUG-17 (the reseed stops crashing on the clone)
        seed_items([{"name": "Heavy Armour", "type": "Armour", "subtype": "Armour", "cost": 60}])

        self.assertEqual((costs(self.armour), costs(self.clone)), ([60], [30]))

    def test_a_reseed_reprices_every_campaigns_clone_and_copies_keep_what_was_paid(self):
        # BUG-51 (was pinned: the clone kept its price until the rule was synced by hand; flipped in PR A)
        other = Campaign.objects.create(name="Elsewhere", join_code="ELSEWH")
        CampaignHouseRule.objects.create(campaign=other, title="Half price", effect_key=HALF_PRICE_ARMOUR_EFFECT_KEY)
        sync_half_price_armour_for_campaign(other.id)
        hero = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch")
        hero.hero_items.create(item=self.clone, cost=25)

        output = seed_items([{"name": "Heavy Armour", "type": "Armour", "subtype": "Armour", "cost": 60}])

        clones = Item.objects.filter(source_item=self.armour).order_by("campaign_id")
        self.assertEqual([(clone.campaign_id, costs(clone)) for clone in clones], [(self.campaign.id, [30]), (other.id, [30])])  # fmt: skip
        self.assertEqual(list(hero.hero_items.values_list("item_id", "cost")), [(self.clone.id, 25)])
        self.assertIn("house rules synced: 2", output)


class SeederTruncateTests(SeederTestCase):
    """BUG-16's seeder half: `--truncate` deleted campaign rows and, through CASCADE, every copy of them. PR A
    removed it from every seeder; a wipe replaces it."""

    def test_no_seeder_takes_truncate_and_campaign_rows_and_their_copies_stay(self):
        # BUG-16 (was pinned: seed_items, seed_skills, seed_spells_and_special and seed_restrictions --truncate
        # deleted campaign rows, their copies, links and item settings; flipped in PR A)
        hero = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch")
        charm = book_item("Lucky Charm", 25, campaign=self.campaign)
        hero.hero_items.create(item=charm, cost=25)
        skill = Skill.objects.create(name="Ambush", type="Combat", campaign=self.campaign)
        hero.hero_skills.create(skill=skill)
        commands = ("seed_items", "seed_skills", "seed_spells_and_special", "seed_races", "seed_restrictions")
        for command in (*commands, "seed_bestiary"):
            with self.subTest(command=command):
                with self.assertRaisesMessage(TypeError, f"Unknown option(s) for {command} command: truncate."):
                    call_command(command, truncate=True, stdout=StringIO())

        self.assertEqual((hero.hero_items.count(), hero.hero_skills.count()), (1, 1))


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
