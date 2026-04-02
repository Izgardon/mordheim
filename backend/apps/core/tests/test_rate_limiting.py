from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.cache import cache
from django.test import override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.battles.models import Battle, BattleParticipant
from apps.campaigns.models import Campaign, CampaignMembership, CampaignRole
from apps.warbands.models import Warband


def _rest_framework_with_rates(**overrides):
    return {
        **settings.REST_FRAMEWORK,
        "NUM_PROXIES": 1,
        "DEFAULT_THROTTLE_RATES": {
            **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
            **overrides,
        },
    }


class RateLimitingApiTests(APITestCase):
    client: APIClient

    def setUp(self):
        self.client = APIClient()
        cache.clear()

        self.user_model = get_user_model()
        self.password = "testpass123"

        self.owner_role = CampaignRole.objects.create(slug="owner", name="Owner")
        self.player_role = CampaignRole.objects.create(slug="player", name="Player")
        self.admin_role = CampaignRole.objects.create(slug="admin", name="Admin")

        self.owner = self._create_user("owner@example.com", "Owner")
        self.player = self._create_user("player@example.com", "Player")
        self.third = self._create_user("third@example.com", "Third")

        self.campaign = Campaign.objects.create(name="Shadows Over Mordheim", join_code="ABC123")
        CampaignMembership.objects.create(campaign=self.campaign, user=self.owner, role=self.owner_role)
        CampaignMembership.objects.create(campaign=self.campaign, user=self.player, role=self.player_role)
        CampaignMembership.objects.create(campaign=self.campaign, user=self.third, role=self.player_role)

        self.owner_warband = Warband.objects.create(
            campaign=self.campaign,
            user=self.owner,
            name="Iron Vultures",
            faction="Mercenaries",
        )
        self.player_warband = Warband.objects.create(
            campaign=self.campaign,
            user=self.player,
            name="Night Razors",
            faction="Skaven",
        )
        self.third_warband = Warband.objects.create(
            campaign=self.campaign,
            user=self.third,
            name="Ash Hounds",
            faction="Witch Hunters",
        )

        self.active_battle = Battle.objects.create(
            campaign=self.campaign,
            created_by_user=self.owner,
            scenario="Street Fight",
            status=Battle.STATUS_ACTIVE,
        )
        BattleParticipant.objects.create(
            battle=self.active_battle,
            user=self.owner,
            warband=self.owner_warband,
            status=BattleParticipant.STATUS_IN_BATTLE,
            selected_unit_keys_json=["hero:11"],
            unit_information_json={},
        )
        BattleParticipant.objects.create(
            battle=self.active_battle,
            user=self.player,
            warband=self.player_warband,
            status=BattleParticipant.STATUS_IN_BATTLE,
            selected_unit_keys_json=["hero:22"],
            unit_information_json={},
        )

    def _create_user(self, email, name=""):
        return self.user_model.objects.create_user(
            username=email,
            email=email,
            password=self.password,
            first_name=name,
        )

    def _login_payload(self):
        return {"email": self.owner.email, "password": "wrong-password"}

    def _set_forwarded_ip(self, ip: str):
        self.client.credentials(HTTP_X_FORWARDED_FOR=ip)

    def _auth_client(self, user, ip="198.51.100.10"):
        self.client.force_authenticate(user=user)
        self._set_forwarded_ip(ip)

    def test_rate_limit_settings_match_expected_defaults(self):
        self.assertTrue(settings.RATE_LIMIT_ENABLED)
        self.assertEqual(
            settings.CACHES["default"]["BACKEND"],
            "django.core.cache.backends.locmem.LocMemCache",
        )
        self.assertEqual(settings.CACHES["default"]["LOCATION"], "rate-limit")
        self.assertEqual(
            settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
            {
                "auth_login_minute": "5/min",
                "auth_login_hour": "30/hour",
                "auth_register_hour": "3/hour",
                "auth_register_day": "10/day",
                "auth_password_reset_hour": "3/hour",
                "auth_password_reset_day": "10/day",
                "auth_password_reset_confirm_hour": "10/hour",
                "auth_refresh_minute": "30/min",
                "campaign_chat_user": "12/min",
                "campaign_chat_ip": "60/min",
                "campaign_ping_user": "30/min",
                "campaign_ping_ip": "120/min",
                "battle_write_user": "60/min",
                "battle_write_ip": "240/min",
                "trade_write_user": "20/min",
                "trade_write_ip": "60/min",
            },
        )

    @override_settings(REST_FRAMEWORK=_rest_framework_with_rates(auth_login_minute="2/min"))
    def test_login_is_rate_limited_by_forwarded_ip_and_returns_retry_after(self):
        self._set_forwarded_ip("198.51.100.10")

        for _ in range(2):
            response = self.client.post("/api/auth/login/", self._login_payload(), format="json")
            self.assertEqual(response.status_code, 400)

        response = self.client.post("/api/auth/login/", self._login_payload(), format="json")
        self.assertEqual(response.status_code, 429)
        self.assertIn("Retry-After", response.headers)

    @override_settings(REST_FRAMEWORK=_rest_framework_with_rates(auth_login_minute="1/min"))
    def test_login_rate_limit_does_not_leak_between_ips(self):
        self._set_forwarded_ip("198.51.100.10")
        response = self.client.post("/api/auth/login/", self._login_payload(), format="json")
        self.assertEqual(response.status_code, 400)

        response = self.client.post("/api/auth/login/", self._login_payload(), format="json")
        self.assertEqual(response.status_code, 429)

        self._set_forwarded_ip("198.51.100.11")
        response = self.client.post("/api/auth/login/", self._login_payload(), format="json")
        self.assertEqual(response.status_code, 400)

    @override_settings(REST_FRAMEWORK=_rest_framework_with_rates(auth_register_hour="1/hour"))
    def test_register_is_rate_limited_by_ip(self):
        self._set_forwarded_ip("198.51.100.20")

        response = self.client.post(
            "/api/auth/register/",
            {"email": "new-user@example.com", "password": self.password, "name": "New User"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        response = self.client.post(
            "/api/auth/register/",
            {"email": "another-user@example.com", "password": self.password, "name": "Another User"},
            format="json",
        )
        self.assertEqual(response.status_code, 429)

    @override_settings(REST_FRAMEWORK=_rest_framework_with_rates(auth_password_reset_hour="1/hour"))
    def test_password_reset_request_is_rate_limited_by_ip(self):
        self._set_forwarded_ip("198.51.100.30")

        response = self.client.post(
            "/api/auth/password-reset/",
            {"email": self.owner.email},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            "/api/auth/password-reset/",
            {"email": self.owner.email},
            format="json",
        )
        self.assertEqual(response.status_code, 429)

    @override_settings(REST_FRAMEWORK=_rest_framework_with_rates(auth_password_reset_confirm_hour="1/hour"))
    def test_password_reset_confirm_is_rate_limited_by_ip(self):
        self._set_forwarded_ip("198.51.100.31")
        uid = urlsafe_base64_encode(force_bytes(self.owner.pk))
        token = PasswordResetTokenGenerator().make_token(self.owner)

        response = self.client.post(
            "/api/auth/password-reset-confirm/",
            {"uid": uid, "token": token, "new_password": "newpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            "/api/auth/password-reset-confirm/",
            {"uid": uid, "token": token, "new_password": "newpass456"},
            format="json",
        )
        self.assertEqual(response.status_code, 429)

    @override_settings(REST_FRAMEWORK=_rest_framework_with_rates(auth_refresh_minute="2/min"))
    def test_refresh_is_rate_limited_by_ip(self):
        self._set_forwarded_ip("198.51.100.40")
        refresh = str(RefreshToken.for_user(self.owner))

        for _ in range(2):
            response = self.client.post("/api/auth/refresh/", {"refresh": refresh}, format="json")
            self.assertEqual(response.status_code, 200)

        response = self.client.post("/api/auth/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(response.status_code, 429)

    @override_settings(
        REST_FRAMEWORK=_rest_framework_with_rates(campaign_chat_user="2/min", campaign_chat_ip="10/min")
    )
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

    @override_settings(
        REST_FRAMEWORK=_rest_framework_with_rates(campaign_chat_user="10/min", campaign_chat_ip="2/min")
    )
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

    @override_settings(
        REST_FRAMEWORK=_rest_framework_with_rates(campaign_ping_user="2/min", campaign_ping_ip="10/min")
    )
    def test_campaign_ping_post_is_rate_limited(self):
        self._auth_client(self.owner)

        for _ in range(2):
            response = self.client.post(
                f"/api/campaigns/{self.campaign.id}/pings/",
                {"payload": {"kind": "ready-check"}},
                format="json",
            )
            self.assertIn(response.status_code, {200, 503})

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/pings/",
            {"payload": {"kind": "ready-check"}},
            format="json",
        )
        self.assertEqual(response.status_code, 429)

    @override_settings(REST_FRAMEWORK=_rest_framework_with_rates(battle_write_user="2/min", battle_write_ip="10/min"))
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

    @override_settings(REST_FRAMEWORK=_rest_framework_with_rates(battle_write_user="10/min", battle_write_ip="2/min"))
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

    @override_settings(REST_FRAMEWORK=_rest_framework_with_rates(trade_write_user="2/min", trade_write_ip="10/min"))
    def test_trade_write_endpoints_enforce_user_or_ip_limit(self):
        self._auth_client(self.owner)

        for _ in range(2):
            response = self.client.post(
                f"/api/campaigns/{self.campaign.id}/trade-requests/",
                {"target_user_id": self.player.id},
                format="json",
            )
            self.assertEqual(response.status_code, 201)

        response = self.client.post(
            f"/api/campaigns/{self.campaign.id}/trade-requests/",
            {"target_user_id": self.player.id},
            format="json",
        )
        self.assertEqual(response.status_code, 429)

    @override_settings(REST_FRAMEWORK=_rest_framework_with_rates(trade_write_user="10/min", trade_write_ip="2/min"))
    def test_trade_write_endpoints_enforce_ip_backstop(self):
        self._auth_client(self.owner)

        for _ in range(2):
            response = self.client.post(
                f"/api/campaigns/{self.campaign.id}/trade-requests/",
                {"target_user_id": self.player.id},
                format="json",
            )
            self.assertEqual(response.status_code, 201)

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

        self.client.force_authenticate(user=smoke_owner)
        battle_response = self.client.post(
            f"/api/campaigns/{smoke_campaign.id}/battles/",
            {"participant_user_ids": [smoke_owner.id, smoke_player.id], "scenario": "Smoke Test"},
            format="json",
        )
        self.assertEqual(battle_response.status_code, 201)
        battle_id = battle_response.data["battle"]["id"]

        response = self.client.post(
            f"/api/campaigns/{smoke_campaign.id}/battles/{battle_id}/join/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=smoke_player)
        response = self.client.post(
            f"/api/campaigns/{smoke_campaign.id}/battles/{battle_id}/join/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=smoke_owner)
        response = self.client.post(
            f"/api/campaigns/{smoke_campaign.id}/battles/{battle_id}/config/",
            {"selected_unit_keys_json": ["hero:11"], "custom_units_json": []},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=smoke_player)
        response = self.client.post(
            f"/api/campaigns/{smoke_campaign.id}/battles/{battle_id}/config/",
            {"selected_unit_keys_json": ["hero:22"], "custom_units_json": []},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=smoke_owner)
        response = self.client.post(
            f"/api/campaigns/{smoke_campaign.id}/battles/{battle_id}/ready/",
            {"ready": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=smoke_player)
        response = self.client.post(
            f"/api/campaigns/{smoke_campaign.id}/battles/{battle_id}/ready/",
            {"ready": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.client.force_authenticate(user=smoke_owner)
        response = self.client.post(
            f"/api/campaigns/{smoke_campaign.id}/battles/{battle_id}/start/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/api/campaigns/{smoke_campaign.id}/battles/{battle_id}/unit-ooa/",
            {"unit_key": "hero:11", "out_of_action": True},
            format="json",
        )
        self.assertIn(response.status_code, {200, 201})
