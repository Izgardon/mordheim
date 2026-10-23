"""The chat, battle and trade write throttles at lowered rates, the probes' freedom from them, and a whole battle
flow well under the configured limits (`rate_limit_support`)."""

from django.test import override_settings

from apps.campaigns.models import Campaign, CampaignMembership
from apps.warbands.models import Warband

from .rate_limit_support import RateLimitTestCase, rest_framework_with_rates


class WriteRateLimitingApiTests(RateLimitTestCase):
    @override_settings(REST_FRAMEWORK=rest_framework_with_rates(campaign_chat_user="2/min", campaign_chat_ip="10/min"))
    def test_campaign_messages_post_enforces_user_or_ip_limit(self):
        self._auth_client(self.owner)

        for _ in range(2):
            response = self.client.post(
                f"/api/campaigns/{self.campaign.id}/messages/",
                {"body": "For Mordheim!"},
                format="json",
            )
            self.assertEqual(response.status_code, 201)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/messages/",
            {"body": "For Mordheim!"},
            format="json",
        )
        self.assertEqual(response.status_code, 429)

    @override_settings(REST_FRAMEWORK=rest_framework_with_rates(campaign_chat_user="10/min", campaign_chat_ip="2/min"))
    def test_campaign_messages_post_enforces_ip_backstop(self):
        self._auth_client(self.owner)

        for _ in range(2):
            response = self.client.post(
                f"/api/campaigns/{self.campaign.id}/messages/",
                {"body": "Hold the line."},
                format="json",
            )
            self.assertEqual(response.status_code, 201)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/messages/",
            {"body": "Hold the line."},
            format="json",
        )
        self.assertEqual(response.status_code, 429)

    @override_settings(REST_FRAMEWORK=rest_framework_with_rates(battle_write_user="2/min", battle_write_ip="10/min"))
    def test_battle_write_endpoints_enforce_user_or_ip_limit(self):
        self._auth_client(self.owner)

        for _ in range(2):
            response = self.client.post(
                f"/api/campaigns/{self.campaign.id}/battles/{self.active_battle.id}/unit-ooa/",
                {"unit_key": "hero:11", "out_of_action": True},
                format="json",
            )
            self.assertEqual(response.status_code, 201 if _ == 0 else 200)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{self.active_battle.id}/unit-ooa/",
            {"unit_key": "hero:11", "out_of_action": True},
            format="json",
        )
        self.assertEqual(response.status_code, 429)

    @override_settings(REST_FRAMEWORK=rest_framework_with_rates(battle_write_user="10/min", battle_write_ip="2/min"))
    def test_battle_write_endpoints_enforce_ip_backstop(self):
        self._auth_client(self.owner)

        for _ in range(2):
            response = self.client.post(
                f"/api/campaigns/{self.campaign.id}/battles/{self.active_battle.id}/unit-ooa/",
                {"unit_key": "hero:11", "out_of_action": False},
                format="json",
            )
            self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/battles/{self.active_battle.id}/unit-ooa/",
            {"unit_key": "hero:11", "out_of_action": False},
            format="json",
        )
        self.assertEqual(response.status_code, 429)

    @override_settings(REST_FRAMEWORK=rest_framework_with_rates(trade_write_user="2/min", trade_write_ip="10/min"))
    def test_trade_write_endpoints_enforce_user_or_ip_limit(self):
        self._auth_client(self.owner)

        for expected in (201, 409):  # the second is refused (one open trade per pair, BUG-114) but still counts
            response = self.client.post(
                f"/api/campaigns/{self.campaign.id}/trade-requests/",
                {"target_user_id": self.player.id},
                format="json",
            )
            self.assertEqual(response.status_code, expected)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/trade-requests/",
            {"target_user_id": self.player.id},
            format="json",
        )
        self.assertEqual(response.status_code, 429)

    @override_settings(REST_FRAMEWORK=rest_framework_with_rates(trade_write_user="10/min", trade_write_ip="2/min"))
    def test_trade_write_endpoints_enforce_ip_backstop(self):
        self._auth_client(self.owner)

        for expected in (201, 409):  # the second is refused (one open trade per pair, BUG-114) but still counts
            response = self.client.post(
                f"/api/campaigns/{self.campaign.id}/trade-requests/",
                {"target_user_id": self.player.id},
                format="json",
            )
            self.assertEqual(response.status_code, expected)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/trade-requests/",
            {"target_user_id": self.player.id},
            format="json",
        )
        self.assertEqual(response.status_code, 429)

    def test_health_and_keep_awake_are_not_rate_limited(self):
        self._set_forwarded_ip("198.51.100.90")

        for _ in range(5):
            health = self.client.get("/api/health/")
            self.assertEqual(health.status_code, 200)

            keep_awake = self.client.head("/api/keep-awake/")
            self.assertEqual(keep_awake.status_code, 204)

    def _post_as(self, user, path, body=None):
        """POST `body` to `path` as JSON, signed in as `user`."""
        self.client.force_authenticate(user=user)
        return self.client.post(path, body, format="json")

    def test_normal_battle_flow_stays_well_below_default_limits(self):
        smoke_owner = self._create_user("smoke-owner@example.com", "Smoke Owner")
        smoke_player = self._create_user("smoke-player@example.com", "Smoke Player")
        smoke_campaign = Campaign.objects.create(name="Smoke Campaign", join_code="SMOKE1")
        CampaignMembership.objects.create(campaign=smoke_campaign, user=smoke_owner, role=self.owner_role)
        CampaignMembership.objects.create(campaign=smoke_campaign, user=smoke_player, role=self.player_role)
        Warband.objects.create(
            campaign=smoke_campaign,
            user=smoke_owner,
            name="Smoke Ravens",
            faction="Mercenaries",
        )
        Warband.objects.create(
            campaign=smoke_campaign,
            user=smoke_player,
            name="Smoke Claws",
            faction="Skaven",
        )

        battles = f"/api/campaigns/{smoke_campaign.id}/battles/"
        participants = {"participant_user_ids": [smoke_owner.id, smoke_player.id], "scenario": "Smoke Test"}
        battle_response = self._post_as(smoke_owner, battles, participants)
        self.assertEqual(battle_response.status_code, 201)
        battle = f"{battles}{battle_response.data['battle']['id']}"

        self.assertEqual(self._post_as(smoke_owner, f"{battle}/join/").status_code, 200)
        self.assertEqual(self._post_as(smoke_player, f"{battle}/join/").status_code, 200)
        owner_config = {"selected_unit_keys_json": ["hero:11"], "custom_units_json": []}
        self.assertEqual(self._post_as(smoke_owner, f"{battle}/config/", owner_config).status_code, 200)
        player_config = {"selected_unit_keys_json": ["hero:22"], "custom_units_json": []}
        self.assertEqual(self._post_as(smoke_player, f"{battle}/config/", player_config).status_code, 200)
        self.assertEqual(self._post_as(smoke_owner, f"{battle}/ready/", {"ready": True}).status_code, 200)
        self.assertEqual(self._post_as(smoke_player, f"{battle}/ready/", {"ready": True}).status_code, 200)
        self.assertEqual(self._post_as(smoke_owner, f"{battle}/start/").status_code, 200)

        response = self._post_as(smoke_owner, f"{battle}/unit-ooa/", {"unit_key": "hero:11", "out_of_action": True})
        self.assertIn(response.status_code, {200, 201})
