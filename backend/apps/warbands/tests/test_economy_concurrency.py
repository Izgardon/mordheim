"""Concurrency: two sales of the last stash copy at once (pass 2, step 0; ECON-TEST-05, BUG-36).

Two real requests run on two threads (two database connections) and are held at a `Rendezvous` patched
in between the sale's read of the stash row and its write, so both see the last copy before either
removes it. Today the removal is read-modify-write, so both sales succeed and both credit the gold: an
expected failure that PR A's guarded stash service flips. If PR A stops calling `WarbandItem.delete`,
move the rendezvous to the new read-to-write gap.
"""

import unittest
from typing import Any
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from apps.campaigns.models import Campaign, CampaignMembership, CampaignRole
from apps.core.testing import Rendezvous, run_concurrently
from apps.items.models import Item
from apps.warbands.models import Warband, WarbandItem, WarbandTrade
from apps.warbands.services.summary import warband_gold


class StashSaleConcurrencyTests(TransactionTestCase):
    def setUp(self) -> None:
        role = CampaignRole.objects.get_or_create(slug="player", defaults={"name": "Player"})[0]
        campaign = Campaign.objects.create(name="Shards", join_code="RACE02")
        self.player = get_user_model().objects.create_user(username="p@example.com", email="p@example.com")
        CampaignMembership.objects.create(campaign=campaign, user=self.player, role=role)
        self.warband = Warband.objects.create(campaign=campaign, user=self.player, name="Monks", faction="Any")
        self.sword = Item.objects.create(name="Sword", type="Melee")
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=1, cost=10)

    def _sell(self) -> tuple[int, Any]:
        client = APIClient()
        client.force_authenticate(user=self.player)
        body = {"source_type": "stash", "item_id": self.sword.id, "quantity": 1, "price": 5}
        response = client.post(f"/api/warbands/{self.warband.id}/item-sales/", body, format="json")
        return response.status_code, response.json()

    @unittest.expectedFailure
    def test_only_one_of_two_sales_of_the_last_copy_succeeds(self):
        rendezvous = Rendezvous()
        real_delete = WarbandItem.delete

        with mock.patch.object(WarbandItem, "delete", autospec=True, side_effect=rendezvous.before(real_delete)):
            results = run_concurrently(self._sell, self._sell)

        self.assertEqual(sorted(status for status, _ in results), [200, 400])
        self.assertEqual(WarbandTrade.objects.filter(warband=self.warband, action="Sold").count(), 1)
        self.assertEqual(warband_gold(self.warband.id), 5)
        self.assertFalse(WarbandItem.objects.filter(warband=self.warband).exists())
