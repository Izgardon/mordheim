from django.test import TestCase

from apps.core.testing import ReferenceCampaign, build_reference_campaign
from apps.items.models import Item


class ApiRevalidationTests(TestCase):
    """Unchanged GET responses revalidate to an empty 304 (catalogues are ~370 KB per campaign entry)."""

    ref: ReferenceCampaign

    @classmethod
    def setUpTestData(cls):
        cls.ref = build_reference_campaign(unit_count=1)

    def setUp(self):
        self.client = self.ref.owner_client
        self.client.force_authenticate(user=self.ref.owner)
        self.url = f"/api/items/?campaign_id={self.ref.campaign_id}"

    def test_get_carries_etag_and_must_revalidate(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.has_header("ETag"))
        self.assertIn("private", response["Cache-Control"])
        self.assertIn("no-cache", response["Cache-Control"])

    def test_unchanged_response_revalidates_to_304(self):
        etag = self.client.get(self.url)["ETag"]
        response = self.client.get(self.url, HTTP_IF_NONE_MATCH=etag)
        self.assertEqual(response.status_code, 304)
        self.assertEqual(response.content, b"")

    def test_changed_response_is_sent_in_full(self):
        etag = self.client.get(self.url)["ETag"]
        Item.objects.create(name="Freshly forged blade", type="Melee")
        response = self.client.get(self.url, HTTP_IF_NONE_MATCH=etag)
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response["ETag"], etag)

    def test_writes_are_not_affected(self):
        response = self.client.post(
            f"/api/campaigns/{self.ref.campaign_id}/messages/", {"body": "hello"}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.has_header("ETag"))
