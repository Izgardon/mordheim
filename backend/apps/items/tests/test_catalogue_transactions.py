"""Catalogue writes are whole or not at all (pass 5; BUG-53, CAT-TEST-09, CAT-TEST-10).

`TransactionTestCase`: each request commits as it would in production (there is no ATOMIC_REQUESTS), so what a
failed write leaves behind can be read afterwards. Since PR A the input is validated in nested serializers (a 400
with field errors before anything is written) and every item, bestiary and hired-sword write runs in one
transaction; before, a failed write kept the item without its prices, or an entry without its links or profile.
"""

import logging
from typing import Any
from unittest import mock

from django.core.cache import cache
from django.test import TransactionTestCase, override_settings
from rest_framework.test import APIClient

from apps.bestiary.models import BestiaryEntry, HiredSwordProfile
from apps.campaigns.models import Campaign
from apps.campaigns.services.codes import seed_roles_and_codes
from apps.campaigns.tests.campaign_support import make_user
from apps.items.models import Item, ItemAvailability

from .catalogue_support import BESTIARY, HIRED_SWORDS, ITEMS, make_entry


@override_settings(RATE_LIMIT_ENABLED=False)
class CatalogueTransactionTests(TransactionTestCase):
    """An owner ("Olga") and her campaign "Shards", created through the API; each test starts from an empty
    database (the flush after each test empties the seeded roles and codes too, so `setUp` seeds them again)."""

    client: APIClient
    client_class = APIClient

    def setUp(self) -> None:
        seed_roles_and_codes()
        cache.clear()
        self.owner = make_user("owner@example.com", "Olga")
        self.client.force_authenticate(user=self.owner)
        created = self.client.post("/api/campaigns/", {"name": "Shards"}, format="json")
        assert created.status_code == 201, created.data
        self.campaign = Campaign.objects.get(id=created.data["id"])
        self.client.raise_request_exception = False  # a crash answers 500, as in production
        logger = logging.getLogger("django.request")
        self.addCleanup(setattr, logger, "disabled", logger.disabled)
        logger.disabled = True

    def post(self, url: str, body: dict[str, Any]) -> Any:
        return self.client.post(url, {"campaign_id": self.campaign.id, **body}, format="json")

    def test_an_item_with_a_negative_cost_or_rarity_out_of_range_is_refused_with_field_errors(self):
        # BUG-53, CAT-TEST-09 (was pinned: a 500 that kept the item without its availabilities; flipped in PR A)
        cases = {
            "Cursed blade": ({"cost": -5, "rarity": 2}, {"cost": ["Ensure this value is greater than or equal to 0."]}),
            "Rare blade": ({"cost": 5, "rarity": 1}, {"rarity": ["Ensure this value is greater than or equal to 2."]}),
            "Odd blade": ({"cost": "abc"}, {"cost": ["A valid integer is required."]}),
            "Myth blade": ({"rarity": 21}, {"rarity": ["Ensure this value is less than or equal to 20."]}),
        }
        for name, (availability, errors) in cases.items():
            with self.subTest(name=name):
                response = self.post(ITEMS.list_url(), ITEMS.body(name, availabilities=[availability]))

                self.assertEqual((response.status_code, response.json()), (400, {"availabilities": [errors]}))
        self.assertFalse(Item.objects.exists())

    def test_a_failed_item_edit_changes_nothing(self):
        # BUG-53 (was pinned: a 500 that kept the new name and lost the old prices; flipped in PR A)
        item = make_entry(ITEMS, "Flail", campaign=self.campaign, cost=15)

        response = self.client.patch(ITEMS.detail_url(item.id), {"name": "Flail of doom", "availabilities": [{"cost": -1}]}, format="json")  # fmt: skip

        self.assertEqual(response.status_code, 400)
        item.refresh_from_db()
        self.assertEqual((item.name, list(item.availabilities.values_list("cost", flat=True))), ("Flail", [15]))

    def test_an_item_write_failing_after_validation_keeps_nothing(self):
        # BUG-53: the item, its availabilities and its properties are one transaction
        body = ITEMS.body("Halberd", availabilities=[{"cost": 10}], property_ids=[])
        with mock.patch("apps.items.writes._write_properties", side_effect=RuntimeError("disk full")):
            response = self.post(ITEMS.list_url(), body)

        self.assertEqual(response.status_code, 500)
        self.assertEqual((Item.objects.count(), ItemAvailability.objects.count()), (0, 0))

    def test_a_hired_sword_with_an_unknown_skill_is_refused_and_leaves_no_entry(self):
        # BUG-53, CAT-TEST-10 (was pinned: a 500 that left an orphan "Hired Sword" entry no hired-sword list showed;
        # flipped in PR A)
        response = self.post(HIRED_SWORDS.list_url(), HIRED_SWORDS.body("Ghost", skill_ids=[999999]))

        self.assertEqual((response.status_code, list(response.json())), (400, ["skill_ids"]))
        self.assertFalse(BestiaryEntry.objects.exists())
        self.assertEqual(self.client.get(BESTIARY.list_url(self.campaign)).json(), [])

    def test_a_bestiary_entry_with_an_unknown_link_is_refused_and_writes_nothing(self):
        # BUG-53 (was pinned: a 500 that kept the entry with the links before the bad one; flipped in PR A)
        skill = self.client.post("/api/skills/", {"campaign_id": self.campaign.id, "name": "Bite", "type": "Animal", "description": "Bites."}, format="json")  # fmt: skip

        response = self.post(BESTIARY.list_url(), BESTIARY.body("Wolf", skill_ids=[skill.data["id"]], special_ids=[999999]))  # fmt: skip

        self.assertEqual((response.status_code, list(response.json())), (400, ["special_ids"]))
        self.assertFalse(BestiaryEntry.objects.filter(name="Wolf").exists())

    def test_a_hired_sword_edit_with_a_negative_cost_is_a_400(self):
        # BUG-53 (was pinned: a 500; flipped in PR A)
        profile = make_entry(HIRED_SWORDS, "Archer", campaign=self.campaign, hire_cost=40)

        response = self.client.patch(HIRED_SWORDS.detail_url(profile.id), {"hire_cost": -5}, format="json")

        self.assertEqual((response.status_code, list(response.json())), (400, ["hire_cost"]))
        self.assertEqual(HiredSwordProfile.objects.get(id=profile.id).hire_cost, 40)

    def test_a_hired_sword_write_failing_after_validation_keeps_nothing(self):
        # BUG-53: the entry, its links, the profile and its restrictions are one transaction
        body = HIRED_SWORDS.body("Ghost", restriction_ids=[])
        with mock.patch("apps.bestiary.writes._write_restrictions", side_effect=RuntimeError("disk full")):
            response = self.post(HIRED_SWORDS.list_url(), body)

        self.assertEqual(response.status_code, 500)
        self.assertEqual((BestiaryEntry.objects.count(), HiredSwordProfile.objects.count()), (0, 0))
