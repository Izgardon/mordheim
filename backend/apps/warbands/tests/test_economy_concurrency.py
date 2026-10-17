"""Concurrency: two stash writes at once (pass 2; ECON-TEST-05, BUG-36).

Two real requests run on two threads (two database connections) and are held at a `Rendezvous` patched
in between the request's read of the stash row and its write. Stash writes used to be read-modify-write:
two sales of the last copy both succeeded and both credited the gold, and two first additions of an item
both inserted a row, so the second broke `unique_warband_item` (500). `services/stash.py` locks the row it
takes copies from (the second sale waits at the lock while the first holds the rendezvous, which then gives
up after its timeout) and turns a lost first-insert race into an increment.
"""

from typing import Any
from unittest import mock

from django.contrib.auth import get_user_model
from django.db.models.query import QuerySet
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from apps.campaigns.models import Campaign, CampaignMembership, CampaignRole
from apps.core.testing import Rendezvous, run_concurrently
from apps.items.models import Item
from apps.warbands.models import Hero, HeroItem, Warband, WarbandItem, WarbandTrade
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

    def test_only_one_of_two_sales_of_the_last_copy_succeeds(self):
        # ECON-TEST-05: the second sale waits for the first's row lock, then finds no copy left (400)
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

    def test_two_first_additions_of_an_item_both_count(self):
        # BUG-36: both find no stash row and both insert one; the loser of the insert adds to the winner's row
        rendezvous = Rendezvous()
        manager = WarbandItem.objects
        real_create = manager.create
        add = {"item_id": self.sword.id, "quantity": 1, "cost": 10}

        with mock.patch.object(manager, "create", side_effect=rendezvous.before(real_create)):
            statuses = run_concurrently(self._post("items/", add), self._post("items/", add))

        self.assertEqual(statuses, [201, 201])
        self.assertEqual(WarbandItem.objects.get(warband=self.warband).quantity, 2)

    def test_only_one_of_two_sales_of_a_units_last_copy_succeeds(self):
        # BUG-36: both pick the hero's copy, then both delete it; the second deletes nothing and must not sell
        hero = Hero.objects.create(warband=self.warband, name="Haggler", unit_type="Champion")
        HeroItem.objects.create(hero=hero, item=self.sword, cost=10)
        sale = {"source_type": "hero", "source_id": hero.id, "item_id": self.sword.id, "quantity": 1, "price": 5}
        rendezvous = Rendezvous()
        real_delete = QuerySet.delete

        with mock.patch.object(QuerySet, "delete", autospec=True, side_effect=rendezvous.before(real_delete)):
            statuses = run_concurrently(self._post("item-sales/", sale), self._post("item-sales/", sale))

        self.assertEqual(sorted(statuses), [200, 400])
        self.assertEqual(WarbandTrade.objects.filter(warband=self.warband, action="Sold").count(), 1)
        self.assertFalse(HeroItem.objects.filter(hero=hero).exists())
