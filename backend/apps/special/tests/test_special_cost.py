"""A special's price (`Special.cost`, gold crowns; null: none): the mutations a list sells carry it, the catalogue rows
show it, a custom special or a campaign's version sets its own, and seed_spells_and_special writes a shared special's
price and setting from the catalogue import's out/shared-specials.json. Nothing charges it."""

from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from apps.campaigns.models import CampaignType
from apps.special.models import Special
from apps.warbands.tests.roster_support import RosterTestCase

SEEDER = "apps.spells.management.commands.seed_spells_and_special.read_shared"


def shared(*specials: dict) -> dict:
    return {"specials": list(specials), "apart": []}


class SharedCostSeedTests(TestCase):
    def test_a_shared_special_takes_its_price_and_setting_and_one_not_seeded_reads_as_none(self):
        mim = CampaignType.objects.create(slug="mutiny-in-marienburg", name="Mutiny in Marienburg")
        beak = {"name": "Beak", "type": "Favour of Tchar", "description": "A bite.", "aliases": []}
        spines = {"name": "Spines", "type": "Mutation", "description": "Spines.", "aliases": []}
        rows = shared(
            {**beak, "cost": 35, "setting": "mutiny-in-marienburg"},
            {"name": "Warts", "type": "Mutation", "description": "Warts.", "aliases": []},
            {**spines, "cost": 35, "setting": "sartosa"},
        )
        with patch(SEEDER, return_value=rows):
            call_command("seed_spells_and_special", stdout=StringIO())
        found = {row.name: (row.cost, row.campaign_type_id) for row in Special.objects.filter(campaign=None)}
        self.assertEqual(found["Beak"], (35, mim.id))
        self.assertEqual(found["Warts"], (None, None))
        self.assertEqual(found["Spines"], (35, None))  # Sartosa isn't seeded: Mordheim's until it is


class SpecialCostApiTests(RosterTestCase):
    def test_the_rows_carry_the_price_and_a_custom_special_or_a_version_sets_its_own(self):
        book = Special.objects.create(name="Great Claw", type="Mutation", cost=50)
        self.client.force_authenticate(user=self.campaign_owner)

        listed = self.client.get(f"/api/special/?campaign_id={self.campaign.id}").json()
        self.assertEqual({row["name"]: row["cost"] for row in listed}["Great Claw"], 50)

        body = {"campaign_id": self.campaign.id, "name": "Third Eye", "type": "House rule", "cost": 25}
        made = self.client.post("/api/special/", body, format="json")
        self.assertEqual((made.status_code, made.json()["cost"]), (201, 25))
        plain = self.client.post("/api/special/", {**body, "name": "Banner", "cost": None}, format="json")
        self.assertIsNone(plain.json()["cost"])

        edited = self.client.patch(
            f"/api/special/{book.id}/", {"campaign_id": self.campaign.id, "cost": 45}, format="json"
        )
        self.assertEqual(edited.status_code, 200, edited.data)
        version = Special.objects.get(campaign=self.campaign, replaces=book)
        book.refresh_from_db()
        self.assertEqual((version.cost, book.cost), (45, 50))  # the house version's own; the book's stays
        kept = self.client.patch(
            f"/api/special/{version.id}/", {"campaign_id": self.campaign.id, "description": "A claw."}, format="json"
        )
        self.assertEqual(kept.status_code, 200, kept.data)
        version.refresh_from_db()
        self.assertEqual((version.description, version.cost), ("A claw.", 45))
