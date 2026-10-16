from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient, APITestCase

from apps.battles.models import Battle, BattleParticipant
from apps.campaigns.models import Campaign, CampaignMembership, CampaignRole
from apps.warbands.models import Warband


class CampaignBattleListTests(APITestCase):
    """GET /campaigns/:id/battles/ is polled by every campaign page, so its cost must stay flat."""

    client: APIClient

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(username="owner@example.com", password="x", first_name="Owner")
        self.player = user_model.objects.create_user(username="player@example.com", password="x", first_name="Player")
        role = CampaignRole.objects.create(slug="player", name="Player")
        self.campaign = Campaign.objects.create(name="Shards", join_code="ABC123")
        self.warbands = {}
        for user in (self.owner, self.player):
            CampaignMembership.objects.create(campaign=self.campaign, user=user, role=role)
            self.warbands[user.id] = Warband.objects.create(
                campaign=self.campaign, user=user, name=f"{user.first_name} band", faction="Mercenaries"
            )
        self.url = f"/api/campaigns/{self.campaign.id}/battles/"
        self.client.force_authenticate(user=self.owner)

    def _battle(self, status):
        battle = Battle.objects.create(
            campaign=self.campaign, created_by_user=self.owner, status=status, scenario=f"{status} battle"
        )
        for user in (self.owner, self.player):
            BattleParticipant.objects.create(battle=battle, user=user, warband=self.warbands[user.id])
        return battle

    def _count_queries(self, url):
        with CaptureQueriesContext(connection) as captured:
            response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        return len(captured), response

    def test_query_count_does_not_grow_with_battle_history(self):
        self._battle(Battle.STATUS_ENDED)
        few, _ = self._count_queries(self.url)

        for _ in range(10):
            self._battle(Battle.STATUS_ENDED)
        many, response = self._count_queries(self.url)

        self.assertEqual(len(response.data), 11)
        self.assertEqual(few, many)

    def test_snapshot_shape_is_unchanged(self):
        battle = self._battle(Battle.STATUS_ACTIVE)
        response = self.client.get(self.url)
        snapshot = response.data[0]
        self.assertEqual(snapshot["battle"]["id"], battle.id)
        self.assertEqual(snapshot["battle"]["channel"], f"private-battle-{battle.id}")
        self.assertEqual(
            [participant["user"]["id"] for participant in snapshot["participants"]],
            [self.owner.id, self.player.id],
        )
        self.assertEqual(snapshot["participants"][0]["warband"]["name"], "Owner band")

    def test_open_filter_skips_finished_battles(self):
        self._battle(Battle.STATUS_ENDED)
        self._battle(Battle.STATUS_CANCELED)
        open_battle = self._battle(Battle.STATUS_PREBATTLE)

        response = self.client.get(f"{self.url}?open=1")

        self.assertEqual([snapshot["battle"]["id"] for snapshot in response.data], [open_battle.id])
        self.assertEqual(len(self.client.get(self.url).data), 3)

    def test_other_users_battles_are_not_listed(self):
        self._battle(Battle.STATUS_ACTIVE)
        outsider = get_user_model().objects.create_user(username="outsider@example.com", password="x")
        CampaignMembership.objects.create(
            campaign=self.campaign, user=outsider, role=CampaignRole.objects.get(slug="player")
        )
        self.client.force_authenticate(user=outsider)

        self.assertEqual(self.client.get(self.url).data, [])
