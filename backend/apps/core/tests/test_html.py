from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import SimpleTestCase
from rest_framework.test import APIClient, APITestCase

from apps.campaigns.models import CampaignLocation
from apps.campaigns.views import _ensure_permissions, _ensure_roles
from apps.core.html import sanitize_rich_text


class SanitizeRichTextTests(SimpleTestCase):
    def test_keeps_simple_formatting(self):
        html = "<p><strong>Ruined</strong> <em>temple</em></p><ul><li>Roll a D6</li></ul>"
        self.assertEqual(sanitize_rich_text(html), html)

    def test_removes_scripts_and_their_content(self):
        self.assertEqual(sanitize_rich_text("<p>ok</p><script>steal()</script>"), "<p>ok</p>")

    def test_removes_event_handlers(self):
        self.assertEqual(sanitize_rich_text('<img src=x onerror="alert(1)">'), "")
        self.assertNotIn("onclick", sanitize_rich_text('<p onclick="alert(1)">hi</p>'))

    def test_removes_javascript_links_and_hardens_web_links(self):
        self.assertNotIn("javascript:", sanitize_rich_text('<a href="javascript:alert(1)">x</a>'))
        cleaned = sanitize_rich_text('<a href="https://mordheimer.net">rules</a>')
        self.assertIn('href="https://mordheimer.net"', cleaned)
        self.assertIn('rel="noopener noreferrer nofollow"', cleaned)


class LocationContentSanitizedOnWriteTests(APITestCase):
    """Stored XSS: location content is rendered as HTML for every member (SEC-03 / AUTH-SEC-02)."""

    client: APIClient

    def setUp(self):
        cache.clear()
        _ensure_roles.cache_clear()
        _ensure_permissions.cache_clear()
        self.client = APIClient()
        owner = get_user_model().objects.create_user(username="owner@example.com", password="x", first_name="Owner")
        self.client.force_authenticate(user=owner)
        response = self.client.post(
            "/api/campaigns/", {"name": "Marienburg", "max_players": 4, "campaign_type": "marienburg"}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.locations_url = f"/api/campaigns/{response.data['id']}/locations/"

    def test_create_strips_script_payloads(self):
        response = self.client.post(
            self.locations_url,
            {"name": "Docks", "content": '<p>Fog</p><img src=x onerror="fetch(localStorage.refresh)">'},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(CampaignLocation.objects.get(id=response.data["id"]).content, "<p>Fog</p>")

    def test_update_strips_script_payloads(self):
        created = self.client.post(self.locations_url, {"name": "Docks", "content": "<p>Fog</p>"}, format="json")
        response = self.client.patch(
            f"{self.locations_url}{created.data['id']}/",
            {"content": "<p>Fog</p><script>alert(1)</script>"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["content"], "<p>Fog</p>")
