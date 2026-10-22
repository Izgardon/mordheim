"""Shared fixtures for the rate-limit tests at lowered rates (`test_rate_limiting.py` for auth and feedback,
`test_rate_limiting_writes.py` for chat, battle and trade writes): three players in a campaign, each with a warband,
the owner and the player in an active battle, and a client that names its forwarded address."""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase

from apps.battles.models import Battle, BattleParticipant
from apps.campaigns.models import Campaign, CampaignMembership, CampaignRole
from apps.warbands.models import Warband


def rest_framework_with_rates(**overrides):
    return {
        **settings.REST_FRAMEWORK,
        "NUM_PROXIES": 1,
        "DEFAULT_THROTTLE_RATES": {
            **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
            **overrides,
        },
    }


class RateLimitTestCase(APITestCase):
    client: APIClient

    def setUp(self):
        self.client = APIClient()
        cache.clear()

        self.user_model = get_user_model()
        self.password = "testpass123"

        self.owner_role = CampaignRole.objects.get(slug="owner")
        self.player_role = CampaignRole.objects.get(slug="player")
        self.admin_role = CampaignRole.objects.get(slug="admin")

        self.owner = self._create_user("owner@example.com", "Owner")
        self.player = self._create_user("player@example.com", "Player")
        self.third = self._create_user("third@example.com", "Third")

        self._create_campaign()

    def _create_campaign(self):
        """Shadows Over Mordheim: the three players, a warband each, and the owner and player in an active battle."""
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
