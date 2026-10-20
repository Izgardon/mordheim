"""Catalogue writes that fail part-way keep what they wrote (pass 5; BUG-53, CAT-TEST-09, CAT-TEST-10).

`TransactionTestCase`: each request commits as it would in production (there is no ATOMIC_REQUESTS), so what a
failed write leaves behind can be read afterwards. Item writes save the item, then its availabilities from the raw
request; bestiary and hired-sword writes save the entry, then its links one by one, then the profile. PR A validates
the input in nested serializers (a 400 before anything is written) and wraps every write in a transaction.
"""

import logging
from typing import Any

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

    def test_an_item_with_a_negative_cost_or_rarity_out_of_range_is_saved_without_availabilities(self):
        # Characterises current behaviour (BUG-53, CAT-TEST-09, pinned; flips in PR A: 400 with field errors, no item)
        cases = {"Cursed blade": {"cost": -5, "rarity": 2}, "Rare blade": {"cost": 5, "rarity": 1}, "Odd blade": {"cost": "abc"}}  # fmt: skip
        for name, availability in cases.items():
            with self.subTest(name=name):
                response = self.post(ITEMS.list_url(), ITEMS.body(name, availabilities=[availability]))

                self.assertEqual(response.status_code, 500)
                item = Item.objects.get(name=name)
                self.assertEqual((item.campaign_id, item.availabilities.count()), (self.campaign.id, 0))
        listed = self.client.get(ITEMS.list_url(self.campaign)).json()
        self.assertEqual(sorted(row["name"] for row in listed), ["Cursed blade", "Odd blade", "Rare blade"])

    def test_a_failed_item_edit_keeps_the_new_name_and_loses_the_old_prices(self):
        # Characterises current behaviour (BUG-53, pinned; flips in PR A: nothing changes)
        item = make_entry(ITEMS, "Flail", campaign=self.campaign, cost=15)

        response = self.client.patch(ITEMS.detail_url(item.id), {"name": "Flail of doom", "availabilities": [{"cost": -1}]}, format="json")  # fmt: skip

        self.assertEqual(response.status_code, 500)
        item.refresh_from_db()
        self.assertEqual((item.name, ItemAvailability.objects.filter(item=item).count()), ("Flail of doom", 0))

    def test_a_hired_sword_with_an_unknown_skill_leaves_an_entry_without_a_profile(self):
        # Characterises current behaviour (BUG-53, CAT-TEST-10, pinned; flips in PR A: 400, no orphan entry)
        response = self.post(HIRED_SWORDS.list_url(), HIRED_SWORDS.body("Ghost", skill_ids=[999999]))

        self.assertEqual(response.status_code, 500)
        orphan = BestiaryEntry.objects.get(name="Ghost")
        self.assertEqual((orphan.type, orphan.campaign_id), ("Hired Sword", self.campaign.id))
        self.assertFalse(HiredSwordProfile.objects.filter(bestiary_entry=orphan).exists())
        hired_swords = self.client.get(HIRED_SWORDS.list_url(self.campaign)).json()
        self.assertEqual(hired_swords, [])  # nothing lists it, so nothing can edit or delete it
        bestiary = self.client.get(BESTIARY.list_url(self.campaign)).json()
        self.assertEqual([(row["name"], row["type"]) for row in bestiary], [("Ghost", "Hired Sword")])

    def test_a_bestiary_entry_with_an_unknown_link_is_saved_with_the_links_before_it(self):
        # Characterises current behaviour (BUG-53, pinned; flips in PR A)
        skill = self.client.post("/api/skills/", {"campaign_id": self.campaign.id, "name": "Bite", "type": "Animal", "description": "Bites."}, format="json")  # fmt: skip

        response = self.post(BESTIARY.list_url(), BESTIARY.body("Wolf", skill_ids=[skill.data["id"]], special_ids=[999999]))  # fmt: skip

        self.assertEqual(response.status_code, 500)
        wolf = BestiaryEntry.objects.get(name="Wolf")
        self.assertEqual((list(wolf.skills.values_list("name", flat=True)), wolf.specials.count()), (["Bite"], 0))

    def test_a_hired_sword_edit_with_a_negative_cost_is_a_500(self):
        # Characterises current behaviour (BUG-53, pinned; flips in PR A: a 400)
        profile = make_entry(HIRED_SWORDS, "Archer", campaign=self.campaign, hire_cost=40)

        response = self.client.patch(HIRED_SWORDS.detail_url(profile.id), {"hire_cost": -5}, format="json")

        self.assertEqual(response.status_code, 500)
        self.assertEqual(HiredSwordProfile.objects.get(id=profile.id).hire_cost, 40)
