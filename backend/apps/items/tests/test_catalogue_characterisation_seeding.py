"""Characterisation: the catalogue seeders on the committed data (pass 5; BUG-17, BUG-51, BUG-54, CAT-TEST-12, -13).

`seed_all` runs `seed_races`, `seed_restrictions`, `seed_items`, `seed_skills`, `seed_spells_and_special`, then
`seed_bestiary`, each upserting the book by name (and type), and `seed_catalogue_if_empty` runs it on a wiped
production database. Only `seed_bestiary` is atomic. On an empty database it works and can run again; once a campaign
holds an entry of a book entry's name and type (a custom override, a house-rule clone, and every version PR C's
copy-on-write makes), the upserts find two rows and crash (BUG-17). Small, file-driven seeder cases are in
`test_catalogue_characterisation_seeders.py`.
"""

from contextlib import redirect_stdout
from io import StringIO
from unittest import expectedFailure

from django.contrib.auth import get_user_model
from django.core.exceptions import MultipleObjectsReturned
from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.bestiary.models import BestiaryEntry, HiredSwordProfile
from apps.campaigns.models import Campaign
from apps.items.models import Item, ItemAvailability, ItemProperty
from apps.items.services import sync_half_price_armour_for_campaign
from apps.races.models import Race
from apps.restrictions.models import Restriction
from apps.skills.models import Skill
from apps.special.models import Special
from apps.spells.models import Spell

BOOK_MODELS = (Race, Restriction, Item, ItemProperty, Skill, Spell, Special, BestiaryEntry, HiredSwordProfile)

# The links seed_bestiary can't resolve on the committed data (BUG-54): the review's 14 (CAT-BUG-06) plus the
# Hobgoblin Scout's Giant Wolf and the Freelancer's Warhorse (no item of either name).
UNRESOLVED_TODAY = [
    "Equipment 'Giant Wolf' not found for 'Hobgoblin Scout'",
    "Equipment 'Horse' not found for 'Highwayman'",
    "Equipment 'Horse' not found for 'Roadwarden'",
    "Equipment 'Scythe' not found for 'Priest of Morr'",
    "Equipment 'Thief's Cloak' not found for 'Thief'",
    "Equipment 'Warhorse' not found for 'Freelancer'",
    "Equipment 'Warpfire Thrower' not found for 'Clan Skryre Rat Ogre'",
    "Skill 'Leap of Faith' not found for 'Ninja'",
    "Skill 'Lightning Speed' not found for 'Ninja'",
    "Skill 'Ride Warhorse' not found for 'Knight of the White Wolf'",
    "Spell '1 - Banishment' not found for 'Dark Mage'",
    "Spell '2 - Soul Render' not found for 'Dark Mage'",
    "Spell '3 - Shade Mount' not found for 'Dark Mage'",
    "Spell '4 - Jozun" + chr(0x2019) + "s Decay' not found for 'Dark Mage'",  # a curly apostrophe in the data
    "Spell '5 - Cowel of Pain' not found for 'Dark Mage'",
    "Spell '6 - Doom & Dark' not found for 'Dark Mage'",
]


def seed_all() -> str:
    """Run seed_all and return everything it and its seeders printed (they write to sys.stdout)."""
    output = StringIO()
    with redirect_stdout(output):
        call_command("seed_all")
    return output.getvalue()


def counts() -> dict[str, int]:
    return {model.__name__: model.objects.count() for model in BOOK_MODELS}


class SeedAllTests(TestCase):
    """`seed_all` once on an empty database (class data); each test may seed again inside its own transaction."""

    output: str
    seeded: dict[str, int]

    @classmethod
    def setUpTestData(cls) -> None:
        cls.output = seed_all()
        cls.seeded = counts()

    def unresolved(self, output: str) -> list[str]:
        return sorted(line.strip() for line in output.splitlines() if "not found for" in line)

    def test_an_empty_database_gets_the_whole_book_and_nothing_else(self):
        # CAT-TEST-12 (first half): the run gunicorn's seed_catalogue_if_empty starts on a wiped database
        self.assertIn("All seed commands completed successfully!", self.output)
        self.assertEqual(
            self.seeded,
            {
                "Race": 26,
                "Restriction": 133,
                "Item": 230,
                "ItemProperty": 240,
                "Skill": 252,
                "Spell": 183,
                "Special": 186,
                "BestiaryEntry": 86,
                "HiredSwordProfile": 72,
            },
        )
        for model in BOOK_MODELS:
            if hasattr(model, "campaign"):
                with self.subTest(model=model.__name__):
                    self.assertFalse(model.objects.filter(campaign__isnull=False).exists())

    def test_a_second_run_changes_no_book_row_but_rewrites_every_availability(self):
        items = set(Item.objects.values_list("id", "name", "type"))
        availabilities = set(ItemAvailability.objects.values_list("id", flat=True))

        output = seed_all()

        self.assertIn("All seed commands completed successfully!", output)
        self.assertEqual(counts(), self.seeded)
        self.assertEqual(set(Item.objects.values_list("id", "name", "type")), items)
        # every availability is deleted and written again under a new id (CAT-BUG-08's id churn)
        self.assertEqual(set(ItemAvailability.objects.values_list("id", flat=True)) & availabilities, set())

    def test_the_links_seed_bestiary_cannot_resolve(self):
        # Characterises current behaviour (BUG-54, pinned; flips in PR A: prefixes stripped, aliases added)
        self.assertEqual(self.unresolved(self.output), sorted(UNRESOLVED_TODAY))

    def test_the_seeded_bounty_hunter_details_cost_today(self):
        # Characterises current behaviour (PERF-46, CAT-TEST-08, pinned; flips in PR A: at most 12)
        client = APIClient()
        client.force_authenticate(user=get_user_model().objects.create_user(username="reader@example.com"))
        profile = HiredSwordProfile.objects.select_related("bestiary_entry").get(bestiary_entry__name="Bounty Hunter")
        counts = []
        for url in (f"/api/bestiary/{profile.bestiary_entry_id}/", f"/api/hired-swords/{profile.id}/"):
            with CaptureQueriesContext(connection) as captured:
                self.assertEqual(client.get(url).status_code, 200)
            counts.append(len(captured))
        self.assertEqual(counts, [43, 45])  # bestiary entry, hired sword: 8 items, each read on its own

    @expectedFailure
    def test_every_seeded_link_resolves(self):
        # BUG-54, CAT-TEST-13 (the Giant Spider's S0 is set aside, decision 8)
        self.assertEqual(self.unresolved(self.output), [])

    @expectedFailure
    def test_the_dark_mage_knows_his_six_spells(self):
        # BUG-54, CAT-TEST-13: the "1 - " to "6 - " prefixes keep his spells from matching
        self.assertEqual(BestiaryEntry.objects.get(name="Dark Mage").spells.count(), 6)

    def _campaign_with_an_axe_and_half_price_armour(self) -> tuple[Campaign, Item]:
        campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        axe = Item.objects.create(name="Axe", type="Weapon", subtype="Melee", campaign=campaign)
        ItemAvailability.objects.create(item=axe, cost=25, rarity=2)
        sync_half_price_armour_for_campaign(campaign.id)
        return campaign, axe

    @expectedFailure
    def test_reseeding_with_a_campaign_axe_and_half_price_armour_leaves_the_campaign_rows_alone(self):
        # BUG-17, CAT-TEST-12: the second run must update the book, keep the campaign's rows and add no duplicates
        campaign, axe = self._campaign_with_an_axe_and_half_price_armour()
        campaign_rows = set(Item.objects.filter(campaign=campaign).values_list("id", "name"))

        output = seed_all()

        self.assertIn("All seed commands completed successfully!", output)
        self.assertEqual(Item.objects.filter(campaign__isnull=True).count(), self.seeded["Item"])
        self.assertEqual(set(Item.objects.filter(campaign=campaign).values_list("id", "name")), campaign_rows)
        self.assertEqual(axe.availabilities.get().cost, 25)

    def test_a_reseed_with_a_same_named_campaign_item_crashes_in_seed_items(self):
        # Characterises current behaviour (BUG-17, pinned; flips in PR A): the Axe, the first item in
        # standard-items.json, matches the book Axe and the campaign's, so seed_items stops before writing any item
        self._campaign_with_an_axe_and_half_price_armour()
        output = StringIO()

        with redirect_stdout(output), self.assertRaises(MultipleObjectsReturned):
            call_command("seed_all")

        self.assertIn("seed_restrictions completed", output.getvalue())
        self.assertIn("seed_items failed: get() returned more than one Item -- it returned 2!", output.getvalue())
        self.assertNotIn("seed_skills", output.getvalue())

    def test_a_reseed_with_only_half_price_armour_crashes_on_the_first_cloned_armour(self):
        # Characterises current behaviour (BUG-17, pinned; flips in PR A): every clone shares its book armour's name
        # and type. seed_items is not atomic, so the items before the first armour are already written.
        campaign = Campaign.objects.create(name="Shards", join_code="SHARDS")
        sync_half_price_armour_for_campaign(campaign.id)
        Item.objects.filter(campaign__isnull=True, name__in=["Axe", "Wyrdstone Pendulum"]).update(description="stale")

        with redirect_stdout(StringIO()), self.assertRaises(MultipleObjectsReturned):
            call_command("seed_all")

        self.assertNotEqual(Item.objects.get(name="Axe").description, "stale")  # before the armour: written again
        self.assertEqual(Item.objects.get(name="Wyrdstone Pendulum").description, "stale")  # after: not
