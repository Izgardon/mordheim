from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.campaigns.models import CampaignMembership, CampaignRole, CampaignType


class CampaignApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_model = get_user_model()
        self.password = "testpass123"
        self.campaign_type = CampaignType.objects.create(
            code="standard", name="Standard"
        )

    def _create_user(self, email, name=""):
        return self.user_model.objects.create_user(
            username=email,
            email=email,
            password=self.password,
            first_name=name,
        )

    def _create_campaign(self, user, name="Shards of the Comet", max_players=6):
        self.client.force_authenticate(user=user)
        response = self.client.post(
            "/api/campaigns/",
            {
                "name": name,
                "campaign_type": "standard",
                "max_players": max_players,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        return response.data

    def test_create_campaign_creates_owner_membership(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)

        membership = CampaignMembership.objects.get(
            campaign_id=campaign["id"], user=owner
        )
        self.assertEqual(membership.role.slug, "owner")
        self.assertEqual(len(campaign["join_code"]), 6)

    def test_list_campaigns_returns_only_user_campaigns(self):
        owner = self._create_user("owner@example.com", "Owner")
        second_owner = self._create_user("second@example.com", "Second")
        campaign = self._create_campaign(owner, name="Ashes")
        self._create_campaign(second_owner, name="Ruins")

        self.client.force_authenticate(user=owner)
        response = self.client.get("/api/campaigns/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], campaign["id"])

    def test_join_campaign_respects_max_players(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner, max_players=2)
        join_code = campaign["join_code"]

        player = self._create_user("player@example.com", "Player")
        self.client.force_authenticate(user=player)
        response = self.client.post(
            "/api/campaigns/join/",
            {"join_code": join_code},
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        latecomer = self._create_user("late@example.com", "Late")
        self.client.force_authenticate(user=latecomer)
        response = self.client.post(
            "/api/campaigns/join/",
            {"join_code": join_code},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("detail"), "Campaign is full")

    def test_players_requires_membership(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)

        outsider = self._create_user("outsider@example.com", "Outsider")
        self.client.force_authenticate(user=outsider)
        response = self.client.get(f"/api/campaigns/{campaign['id']}/players/")
        self.assertEqual(response.status_code, 404)

    def test_players_returns_members(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner, max_players=3)
        join_code = campaign["join_code"]

        player = self._create_user("player@example.com", "Player")
        self.client.force_authenticate(user=player)
        join_response = self.client.post(
            "/api/campaigns/join/",
            {"join_code": join_code},
            format="json",
        )
        self.assertEqual(join_response.status_code, 201)

        self.client.force_authenticate(user=owner)
        response = self.client.get(f"/api/campaigns/{campaign['id']}/players/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_member_permissions_require_admin_or_owner(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)

        admin_user = self._create_user("admin@example.com", "Admin")
        target_user = self._create_user("player@example.com", "Player")
        admin_role = CampaignRole.objects.get(slug="admin")
        player_role = CampaignRole.objects.get(slug="player")
        CampaignMembership.objects.create(
            campaign_id=campaign["id"], user=admin_user, role=admin_role
        )
        CampaignMembership.objects.create(
            campaign_id=campaign["id"], user=target_user, role=player_role
        )

        self.client.force_authenticate(user=target_user)
        response = self.client.put(
            f"/api/campaigns/{campaign['id']}/members/{target_user.id}/permissions/",
            {"permissions": ["manage_items"]},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=admin_user)
        response = self.client.put(
            f"/api/campaigns/{campaign['id']}/members/{target_user.id}/permissions/",
            {"permissions": ["manage_items"]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["code"], "manage_items")

        self.client.force_authenticate(user=owner)
        response = self.client.put(
            f"/api/campaigns/{campaign['id']}/members/{target_user.id}/permissions/",
            {"permissions": ["manage_items"]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["code"], "manage_items")
