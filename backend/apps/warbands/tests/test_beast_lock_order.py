"""The warband's row is locked before a henchmen group's (the bestiary rewrite step 4's found lock order).

A group PATCH that recruits members charges them, so it locks the warband (the ledger's balance) as well as the
group; a purchase recruiting creatures into the same group does too. If one locked the group first and the other
the warband first, two such requests at the same moment could each wait on the other's row, and Postgres would
abort one. Every path takes the warband first, as the roster batch does (`lock_warband`): the PATCH (when it sends
members), recruiting into a group, a purchase recruiting into one and members going back to the item.

Like the battle writes' lock-order test, this reads the SQL a request runs: a row is locked by `SELECT ... FOR
UPDATE` or by an `UPDATE` of its table.
"""

import re
from typing import Any
from unittest import mock

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TransactionTestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.campaigns.models import Campaign, CampaignMembership, CampaignRole
from apps.core.testing import Rendezvous, run_concurrently
from apps.warbands.models import LedgerAction, Warband, WarbandItem
from apps.warbands.services import ledger
from apps.warbands.units import hooks
from apps.warbands.units.services import beasts

from .beast_support import beast, wardogs
from .roster_support import HENCHMEN, RosterTestCase, make_unit, unit_url

UPDATED = re.compile(r'^UPDATE "(\w+)"')
LOCKED_OF = re.compile(r'FOR UPDATE OF "(\w+)"')
SELECTED = re.compile(r'^SELECT .*? FROM "(\w+)"', re.DOTALL)


def locked_table(sql: str) -> str | None:
    """The table whose rows a statement locks: an UPDATE's, or a SELECT ... FOR UPDATE's (OF it, else its own)."""
    if updated := UPDATED.match(sql):
        return updated.group(1)
    if "FOR UPDATE" not in sql:
        return None
    found = LOCKED_OF.search(sql) or SELECTED.match(sql)
    return found.group(1) if found else None


def lock_order(captured: CaptureQueriesContext) -> list[str]:
    """The tables a request locks rows of, in the order it first locks each."""
    order: list[str] = []
    for query in captured.captured_queries:
        table = locked_table(query["sql"])
        if table and table not in order:
            order.append(table)
    return order


class LockOrderTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.dogs = wardogs()
        self.kennel = make_unit(
            HENCHMEN, self.warband, members=("Rex", "Fang"), price=25, source_beast=beast(self.dogs)
        )
        ledger.record(self.warband, LedgerAction.REWARD, 500, "Purse")

    def locks(self, method: str, path: str, body: dict[str, Any]) -> list[str]:
        with CaptureQueriesContext(connection) as captured:
            response = getattr(self.client, method)(path, body, format="json")
        self.assertIn(response.status_code, (200, 201), getattr(response, "data", None))
        return lock_order(captured)

    def assert_warband_first(self, order: list[str]) -> None:
        self.assertIn("henchmen_group", order)
        self.assertIn("warband", order, f"the warband isn't locked: {order}")
        self.assertLess(order.index("warband"), order.index("henchmen_group"), order)

    def test_a_group_patch_recruiting_members_locks_the_warband_before_the_group(self):
        members = [{"id": member.id, "name": member.name} for member in self.kennel.henchmen.order_by("id")]
        body = {"henchmen": [*members, {"name": "Grip", "cost": 25}]}

        self.assert_warband_first(self.locks("patch", unit_url(HENCHMEN, self.warband.id, self.kennel.id), body))

    def test_a_purchase_recruiting_into_a_group_locks_the_warband_before_the_group(self):
        body = {"item_id": self.dogs.id, "price": 25, "target_type": "stash", "recruit": {"group_id": self.kennel.id}}

        self.assert_warband_first(self.locks("post", f"/api/warbands/{self.warband.id}/purchases/", body))

    def test_recruiting_into_a_group_locks_the_warband_before_the_group(self):
        WarbandItem.objects.create(warband=self.warband, item=self.dogs, quantity=1, cost=25)
        body = {"source": {"type": "stash", "item_id": self.dogs.id}, "target": {"group_id": self.kennel.id}}

        self.assert_warband_first(self.locks("post", f"/api/warbands/{self.warband.id}/beasts/recruit/", body))

    def test_back_to_item_locks_the_warband_before_the_group(self):
        path = f"/api/warbands/{self.warband.id}/henchmen-groups/{self.kennel.id}/back-to-item/"

        self.assert_warband_first(self.locks("post", path, {"count": 1}))


class LockOrderConcurrencyTests(TransactionTestCase):
    """Two real requests on two threads: a group PATCH recruiting a member and a purchase recruiting into the same
    group, each held at a `Rendezvous` once it has taken its first lock. Locked in opposite orders they deadlocked
    and Postgres aborted one (a 500); with the warband first, the second waits for the first and both go through."""

    def setUp(self) -> None:
        role = CampaignRole.objects.get_or_create(slug="player", defaults={"name": "Player"})[0]
        campaign = Campaign.objects.create(name="Shards", join_code="RACE04")
        self.player = get_user_model().objects.create_user(username="p@example.com", email="p@example.com")
        CampaignMembership.objects.create(campaign=campaign, user=self.player, role=role)
        self.warband = Warband.objects.create(campaign=campaign, user=self.player, name="Kennelmen", faction="Any")
        self.dogs = wardogs()
        self.kennel = make_unit(HENCHMEN, self.warband, members=("Rex",), price=25, source_beast=beast(self.dogs))

    def _call(self, method: str, path: str, body: dict[str, Any]) -> Any:
        def call() -> int:
            client = APIClient(raise_request_exception=False)  # a crash answers 500 like production
            client.force_authenticate(user=self.player)
            response = getattr(client, method)(f"/api/warbands/{self.warband.id}/{path}", body, format="json")
            return int(response.status_code)

        return call

    def test_a_group_patch_and_a_purchase_recruiting_into_the_group_both_go_through(self):
        rex = self.kennel.henchmen.get()
        patch = {"henchmen": [{"id": rex.id, "name": "Rex"}, {"name": "Grip", "cost": 25}]}
        purchase = {
            "item_id": self.dogs.id,
            "price": 25,
            "target_type": "stash",
            "recruit": {"group_id": self.kennel.id},
        }
        rendezvous = Rendezvous()

        with (
            mock.patch.object(hooks, "sync_members", side_effect=rendezvous.before(hooks.sync_members)),
            mock.patch.object(beasts, "lock_group", side_effect=rendezvous.before(beasts.lock_group)),
        ):
            statuses = run_concurrently(
                self._call("patch", f"henchmen-groups/{self.kennel.id}/", patch),
                self._call("post", "purchases/", purchase),
            )

        self.assertEqual(statuses, [200, 201])
        self.assertEqual(self.kennel.henchmen.filter(dismissed_at__isnull=True).count(), 3)
