"""Campaign writes that aren't atomic, and the join race (BUG-76, BUG-49; CAMP-TEST-10, -22).

`TransactionTestCase`: each request commits as it would in production, so what a failed request leaves behind can
be read afterwards, and two requests on two threads (each with its own connection) can race. The join race is held
at `codes.role_ref`, which a join calls after its member and seat checks, as it builds its INSERT. The flush
after each `TransactionTestCase` empties the seeded roles and codes too, so `setUp` seeds them again.
"""

import logging
from typing import Any
from unittest import mock

from django.core.cache import cache
from django.db import DatabaseError
from django.test import TransactionTestCase, override_settings
from rest_framework.test import APIClient

from apps.campaigns.models import (
    Campaign,
    CampaignHouseRule,
    CampaignMembership,
    CampaignMembershipPermission,
    CampaignSettings,
)
from apps.campaigns.services import codes, house_rules
from apps.campaigns.services.codes import seed_roles_and_codes
from apps.core.testing import Rendezvous, run_concurrently
from apps.items.models import Item, ItemAvailability

from .campaign_support import make_user


@override_settings(RATE_LIMIT_ENABLED=False)
class CampaignTransactionTestCase(TransactionTestCase):
    """An owner ("Olga") and a campaign, "Shards", created through the API; each test starts from an empty database."""

    client: APIClient
    client_class = APIClient

    def setUp(self) -> None:
        seed_roles_and_codes()
        cache.clear()
        self.owner = make_user("owner@example.com", "Olga")
        self.campaign = self.create_campaign(max_players=2)

    def create_campaign(self, **fields: Any) -> Campaign:
        self.client.force_authenticate(user=self.owner)
        response = self.client.post("/api/campaigns/", {"name": "Shards", **fields}, format="json")
        assert response.status_code == 201, response.data
        return Campaign.objects.get(id=response.data["id"])

    def answer_errors_with_500(self) -> None:
        """Let the test client return a 500 instead of raising, without logging the traceback."""
        self.client.raise_request_exception = False
        self.quiet_request_errors()

    def quiet_request_errors(self) -> None:
        logger = logging.getLogger("django.request")
        self.addCleanup(setattr, logger, "disabled", logger.disabled)
        logger.disabled = True

    def joiner(self, user: Any) -> Any:
        """A join request for `user` with its own client, to run on another thread."""
        client = APIClient()
        client.raise_request_exception = False
        client.force_authenticate(user=user)
        return lambda: client.post("/api/campaigns/join/", {"join_code": self.campaign.join_code}, format="json")


class CampaignWriteAtomicityTests(CampaignTransactionTestCase):
    def test_a_create_that_fails_part_way_leaves_nothing(self):
        # BUG-76, CAMP-TEST-22: campaign, settings and membership used to be written one by one
        refused = self.client.post("/api/campaigns/", {"name": "Broken", "max_heroes": -1}, format="json")
        self.assertEqual((refused.status_code, list(refused.data)), (400, ["max_heroes"]))
        self.answer_errors_with_500()

        with mock.patch.object(CampaignMembership.objects, "create", side_effect=DatabaseError("insert failed")):
            response = self.client.post("/api/campaigns/", {"name": "Broken"}, format="json")

        self.assertEqual(response.status_code, 500)
        self.assertFalse(Campaign.objects.filter(name="Broken").exists())
        self.assertEqual(CampaignSettings.objects.count(), 1)
        self.assertEqual([row["name"] for row in self.client.get("/api/campaigns/").data], ["Shards"])

    def test_a_patch_is_checked_against_the_columns_and_written_all_or_nothing(self):
        # BUG-76: max_heroes 40000 was a 500 after the start had been saved
        url = f"/api/campaigns/{self.campaign.id}/"
        refused = self.client.patch(url, {"in_progress": True, "max_heroes": 40000}, format="json")
        self.assertEqual((refused.status_code, list(refused.data)), (400, ["max_heroes"]))
        self.answer_errors_with_500()
        failing = mock.patch(
            "apps.campaigns.services.settings.get_valid_campaign_item_settings", side_effect=DatabaseError("boom")
        )

        with failing:
            response = self.client.patch(url, {"in_progress": True, "max_heroes": 4, "item_setting_ids": [1]}, format="json")  # fmt: skip

        self.assertEqual(response.status_code, 500)
        self.campaign.refresh_from_db()
        self.assertFalse(self.campaign.in_progress)
        self.assertEqual(CampaignSettings.objects.get(campaign=self.campaign).max_heroes, 6)

    def test_a_grant_put_that_fails_part_way_keeps_the_old_grants(self):
        # BUG-76: delete, then insert, outside a transaction left the player with no grants
        player = make_user("player@example.com", "Pia")
        self.assertEqual(self.joiner(player)().status_code, 201)
        self.answer_errors_with_500()
        url = f"/api/campaigns/{self.campaign.id}/members/{player.id}/permissions/"
        rows = CampaignMembershipPermission.objects

        with mock.patch.object(rows, "bulk_create", side_effect=DatabaseError("insert failed")):
            response = self.client.put(url, {"permissions": ["edit_catalogue", "delete_catalogue"]}, format="json")

        self.assertEqual(response.status_code, 500)
        self.assertEqual(list(rows.filter(membership__user=player).values_list("permission__code", flat=True)), ["edit_catalogue"])  # fmt: skip


class JoinRaceTests(CampaignTransactionTestCase):
    """Two joins at once (BUG-49): the campaign row's lock makes the second wait for the first, then see it."""

    def hold_joins_before_they_write(self) -> None:
        self.quiet_request_errors()
        rendezvous = Rendezvous()
        patcher = mock.patch.object(codes, "role_ref", side_effect=rendezvous.before(codes.role_ref))
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_two_players_racing_for_the_last_seat_take_it_once(self):
        """They used to both get in: three members of a two-seat campaign."""
        # BUG-49, CAMP-TEST-10
        self.hold_joins_before_they_write()

        results = run_concurrently(
            self.joiner(make_user("pia@example.com", "Pia")), self.joiner(make_user("rex@example.com", "Rex"))
        )

        self.assertEqual(sorted(response.status_code for response in results), [201, 400])
        self.assertEqual(CampaignMembership.objects.filter(campaign=self.campaign).count(), 2)

    def test_one_player_joining_twice_at_once_is_told_they_are_already_a_member(self):
        """The second insert used to hit the unique constraint: a 500."""
        # BUG-49, CAMP-TEST-10
        player = make_user("pia@example.com", "Pia")
        self.hold_joins_before_they_write()

        results = run_concurrently(self.joiner(player), self.joiner(player))

        self.assertEqual(sorted(response.status_code for response in results), [201, 400])
        self.assertIn({"detail": "Already a member"}, [response.json() for response in results])
        self.assertEqual(CampaignMembership.objects.filter(campaign=self.campaign, user=player).count(), 1)


class HouseRuleRaceTests(CampaignTransactionTestCase):
    """The same effect rule posted twice at once (BUG-52, CAMP-TEST-18): both used to make a rule and a clone set."""

    def test_two_posts_of_one_effect_make_one_rule_and_one_clone_set(self):
        armour = Item.objects.create(name="Light Armour", type="Armour", subtype="Armour")
        ItemAvailability.objects.create(item=armour, cost=20, rarity=8)
        rendezvous = Rendezvous()
        patcher = mock.patch.object(
            house_rules, "_rule_with_effect", side_effect=rendezvous.before(house_rules._rule_with_effect)
        )
        patcher.start()
        self.addCleanup(patcher.stop)

        def poster() -> Any:
            client = APIClient()
            client.force_authenticate(user=self.owner)
            body = {"title": "Half price armour", "effect_key": "half_price_armour"}
            return lambda: client.post(f"/api/campaigns/{self.campaign.id}/rules/", body, format="json")

        results = run_concurrently(poster(), poster())

        self.assertEqual(sorted(response.status_code for response in results), [200, 201])
        self.assertEqual(len({response.json()["id"] for response in results}), 1)
        self.assertEqual(CampaignHouseRule.objects.filter(campaign=self.campaign).count(), 1)
        self.assertEqual(Item.objects.filter(campaign=self.campaign, source_item=armour).count(), 1)
