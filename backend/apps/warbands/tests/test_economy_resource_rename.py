"""Renaming a resource: PATCH resources/<id>/ {name} (next step 2, the warband page's resource menu)."""

from apps.warbands.models import WarbandResource

from .roster_support import RosterTestCase


class ResourceRenameTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.shards = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=3)
        self.url = f"/api/warbands/{self.warband.id}/resources/{self.shards.id}/"

    def test_a_rename_keeps_the_amount(self):
        response = self.client.patch(self.url, {"name": "  Shards  "}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.json()["name"], response.json()["amount"]), ("Shards", 3))

    def test_a_blank_name_or_another_resource_s_name_is_refused(self):
        WarbandResource.objects.create(warband=self.warband, name="Treasure", amount=1)

        self.assertEqual(self.client.patch(self.url, {"name": " "}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(self.url, {"name": "treasure"}, format="json").status_code, 400)
        self.shards.refresh_from_db()
        self.assertEqual(self.shards.name, "Wyrdstone")
