from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase

from apps.campaigns.views import _ensure_permissions, _ensure_roles


class SpellApiTests(APITestCase):
    client: APIClient

    def setUp(self):
        self.client = APIClient()
        cache.clear()
        self.user_model = get_user_model()
        self.password = "testpass123"
        _ensure_roles.cache_clear()
        _ensure_permissions.cache_clear()

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
                "max_players": max_players,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        return response.data

    def test_create_spell_allows_description_longer_than_500_characters(self):
        owner = self._create_user("owner@example.com", "Owner")
        campaign = self._create_campaign(owner)
        long_description = "A" * 501

        self.client.force_authenticate(user=owner)
        response = self.client.post(
            "/api/spells/",
            {
                "campaign_id": campaign["id"],
                "name": "Apocalyptic Invocation",
                "type": "Chaos Ritual",
                "description": long_description,
                "dc": "9",
                "roll": 6,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["description"], long_description)
