"""Campaign writes that aren't atomic, and the join race (BUG-76, BUG-49; CAMP-TEST-10, -22).

`TransactionTestCase`: each request commits as it would in production, so what a failed request leaves behind can
be read afterwards, and two requests on two threads (each with its own connection) can race. The join race is held
at `codes.role_ref`, which a join calls after its member and seat checks, as it builds its INSERT. The flush
after each `TransactionTestCase` empties the seeded roles and codes too, so `setUp` seeds them again.
"""

import logging
import unittest
from typing import Any
from unittest import mock

from django.core.cache import cache
from django.db import DatabaseError
from django.test import TransactionTestCase, override_settings
from rest_framework.test import APIClient

from apps.campaigns.models import Campaign, CampaignMembership, CampaignMembershipPermission, CampaignSettings
from apps.campaigns.services import codes
from apps.campaigns.services.codes import seed_roles_and_codes
from apps.core.testing import Rendezvous, run_concurrently

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
    def test_a_create_with_a_negative_max_heroes_leaves_a_campaign_without_settings_or_members(self):
        # Characterises current behaviour (BUG-76, CAMP-TEST-22, pinned; flips in PR A: 400 and nothing written)
        self.answer_errors_with_500()

        response = self.client.post("/api/campaigns/", {"name": "Broken", "max_heroes": -1}, format="json")

        self.assertEqual(response.status_code, 500)
        orphan = Campaign.objects.get(name="Broken")
        self.assertFalse(CampaignSettings.objects.filter(campaign=orphan).exists())
        self.assertFalse(CampaignMembership.objects.filter(campaign=orphan).exists())
        self.assertEqual([row["name"] for row in self.client.get("/api/campaigns/").data], ["Shards"])

    def test_a_patch_over_the_smallint_ceiling_answers_500_after_saving_the_start(self):
        # Characterises current behaviour (BUG-76, pinned; flips in PR A: a 400, and the PATCH is atomic)
        self.answer_errors_with_500()

        response = self.client.patch(
            f"/api/campaigns/{self.campaign.id}/", {"in_progress": True, "max_heroes": 40000}, format="json"
        )

        self.assertEqual(response.status_code, 500)
        self.campaign.refresh_from_db()
        self.assertTrue(self.campaign.in_progress)
        self.assertEqual(CampaignSettings.objects.get(campaign=self.campaign).max_heroes, 6)

    def test_a_grant_put_that_fails_after_its_delete_leaves_the_player_with_no_grants(self):
        # Characterises current behaviour (BUG-76, pinned; flips in PR A): delete, then insert, outside a transaction
        player = make_user("player@example.com", "Pia")
        self.assertEqual(self.joiner(player)().status_code, 201)
        self.answer_errors_with_500()
        url = f"/api/campaigns/{self.campaign.id}/members/{player.id}/permissions/"
        rows = CampaignMembershipPermission.objects

        with mock.patch.object(rows, "bulk_create", side_effect=DatabaseError("insert failed")):
            response = self.client.put(url, {"permissions": ["add_custom", "manage_items"]}, format="json")

        self.assertEqual(response.status_code, 500)
        self.assertFalse(rows.filter(membership__user=player).exists())


class JoinRaceTests(CampaignTransactionTestCase):
    """Two joins that both pass the checks before either writes (BUG-49). Today's outcome is in each docstring."""

    def hold_joins_before_they_write(self) -> None:
        self.quiet_request_errors()
        rendezvous = Rendezvous()
        patcher = mock.patch.object(codes, "role_ref", side_effect=rendezvous.before(codes.role_ref))
        patcher.start()
        self.addCleanup(patcher.stop)

    @unittest.expectedFailure
    def test_two_players_racing_for_the_last_seat_take_it_once(self):
        """Today both are let in: three members of a two-seat campaign."""
        # BUG-49, CAMP-TEST-10 (expected failure until PR A locks the campaign row)
        self.hold_joins_before_they_write()

        results = run_concurrently(
            self.joiner(make_user("pia@example.com", "Pia")), self.joiner(make_user("rex@example.com", "Rex"))
        )

        self.assertEqual(sorted(response.status_code for response in results), [201, 400])
        self.assertEqual(CampaignMembership.objects.filter(campaign=self.campaign).count(), 2)

    @unittest.expectedFailure
    def test_one_player_joining_twice_at_once_is_told_they_are_already_a_member(self):
        """Today the second insert hits the unique constraint: a 500."""
        # BUG-49, CAMP-TEST-10 (expected failure until PR A turns the IntegrityError into 400 "Already a member")
        player = make_user("pia@example.com", "Pia")
        self.hold_joins_before_they_write()

        results = run_concurrently(self.joiner(player), self.joiner(player))

        self.assertEqual(sorted(response.status_code for response in results), [201, 400])
