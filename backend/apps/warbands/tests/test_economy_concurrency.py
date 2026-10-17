"""Concurrency: two stash writes at once (pass 2, step 0; ECON-TEST-05, BUG-36).

Two real requests run on two threads (two database connections) and are held at a `Rendezvous` patched
in between the request's read of the stash row and its write, so both read before either writes. Today
stash writes are read-modify-write: two sales of the last copy both succeed and both credit the gold, and
two first additions of an item both insert a row, so the second breaks `unique_warband_item` (500). These
are expected failures that PR A's guarded stash service flips. If PR A stops calling the patched method,
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


class StashConcurrencyTests(TransactionTestCase):
    def setUp(self) -> None:
        role = CampaignRole.objects.get_or_create(slug="player", defaults={"name": "Player"})[0]
        campaign = Campaign.objects.create(name="Shards", join_code="RACE02")
        self.player = get_user_model().objects.create_user(username="p@example.com", email="p@example.com")
        CampaignMembership.objects.create(campaign=campaign, user=self.player, role=role)
        self.warband = Warband.objects.create(campaign=campaign, user=self.player, name="Monks", faction="Any")
        self.sword = Item.objects.create(name="Sword", type="Melee")

    def _post(self, path: str, body: dict[str, Any]) -> Any:
        def call() -> int:
            client = APIClient(raise_request_exception=False)  # a crash answers 500 like production
            client.force_authenticate(user=self.player)
            return client.post(f"/api/warbands/{self.warband.id}/{path}", body, format="json").status_code

        return call

    @unittest.expectedFailure
    def test_only_one_of_two_sales_of_the_last_copy_succeeds(self):
        # ECON-TEST-05: both read quantity 1; both delete the row and write a "Sold" row
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=1, cost=10)
        sale = {"source_type": "stash", "item_id": self.sword.id, "quantity": 1, "price": 5}
        rendezvous = Rendezvous()
        real_delete = WarbandItem.delete

        with mock.patch.object(WarbandItem, "delete", autospec=True, side_effect=rendezvous.before(real_delete)):
            statuses = run_concurrently(self._post("item-sales/", sale), self._post("item-sales/", sale))

        self.assertEqual(sorted(statuses), [200, 400])
        self.assertEqual(WarbandTrade.objects.filter(warband=self.warband, action="Sold").count(), 1)
        self.assertEqual(warband_gold(self.warband.id), 5)
        self.assertFalse(WarbandItem.objects.filter(warband=self.warband).exists())

    @unittest.expectedFailure
    def test_two_first_additions_of_an_item_both_count(self):
        # BUG-36: both find no stash row for the item and both create one
        rendezvous = Rendezvous()
        manager = WarbandItem.objects
        real_create = manager.create
        add = {"item_id": self.sword.id, "quantity": 1, "cost": 10}

        with mock.patch.object(manager, "create", side_effect=rendezvous.before(real_create)):
            statuses = run_concurrently(self._post("items/", add), self._post("items/", add))

        self.assertEqual(statuses, [201, 201])
        self.assertEqual(WarbandItem.objects.get(warband=self.warband).quantity, 2)
