from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase

from apps.campaigns.constants import PERMISSION_CODES
from apps.campaigns.models import CampaignMembership, CampaignMembershipPermission, CampaignPermission


class CampaignDetailPermissionsTests(APITestCase):
    """The campaign payload carries the caller's permission codes (PERF-15)."""

    client: APIClient

    def setUp(self):
        cache.clear()
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(username="owner@example.com", password="x", first_name="Owner")
        self.player = user_model.objects.create_user(username="player@example.com", password="x", first_name="Pl")
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)
        created = self.client.post("/api/campaigns/", {"name": "Shards", "max_players": 4}, format="json")
        self.campaign_id = created.data["id"]
        player_client = APIClient()
        player_client.force_authenticate(user=self.player)
        player_client.post("/api/campaigns/join/", {"join_code": created.data["join_code"]}, format="json")
        self.player_client = player_client

    def test_owner_holds_every_permission(self):
        response = self.client.get(f"/api/campaigns/{self.campaign_id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["permissions"], sorted(PERMISSION_CODES))

    def test_player_sees_only_granted_permissions(self):
        url = f"/api/campaigns/{self.campaign_id}/"
        # Joining grants edit_catalogue (add and edit catalogue entries) by default.
        self.assertEqual(self.player_client.get(url).data["permissions"], ["edit_catalogue"])

        membership = CampaignMembership.objects.get(campaign_id=self.campaign_id, user=self.player)
        CampaignMembershipPermission.objects.create(
            membership=membership, permission=CampaignPermission.objects.get(code="delete_catalogue")
        )

        self.assertEqual(self.player_client.get(url).data["permissions"], ["delete_catalogue", "edit_catalogue"])

    def test_matches_permissions_me(self):
        detail = self.player_client.get(f"/api/campaigns/{self.campaign_id}/").data["permissions"]
        mine = self.player_client.get(f"/api/campaigns/{self.campaign_id}/permissions/me/").data
        self.assertEqual(detail, sorted(entry["code"] for entry in mine))
