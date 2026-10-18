"""Encampments and locations (decision 9; CAMP-UX-03).

Both pages sit behind a settings flag (404 while it's off) and a permission code for writes; neither has a delete.
PR C changes encampments (any member adds one, its owner edits it, soft delete); locations are parked.
"""

from typing import Any

from apps.campaigns.models import CampaignEncampment, CampaignLocation

from .campaign_support import CampaignTestCase


class EncampmentTests(CampaignTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enable_features()

    def add(self, user: Any, **body: Any) -> Any:
        return self.post_as(user, self.url("encampments/"), {"name": "Dockside", **body})

    def edit(self, user: Any, camp_id: int, **body: Any) -> Any:
        return self.patch_as(user, self.url(f"encampments/{camp_id}/"), body)

    def test_adding_needs_manage_encampments_and_leaves_the_owner_unassigned(self):
        # Characterises current behaviour (decision 9, pinned; flips in PR C: any member adds, owner defaults to them)
        self.assertEqual(self.add(self.player).status_code, 403)
        self.grant(self.player, "manage_encampments")

        added = self.add(self.player, description="Staging point")
        by_admin = self.add(self.admin, name="Harbour", owner_id=self.rival.id)

        self.assertEqual(added.status_code, 201)
        self.assertEqual(
            added.data,
            {
                "id": added.data["id"],
                "campaign_id": self.campaign.id,
                "name": "Dockside",
                "owner_id": None,
                "owner_name": None,
                "description": "Staging point",
            },
        )
        self.assertEqual((by_admin.status_code, by_admin.data["owner_name"]), (201, "Rex"))
        listed = self.get_as(self.rival, self.url("encampments/")).data
        self.assertEqual([row["name"] for row in listed], ["Dockside", "Harbour"])  # by name, then id

    def test_the_owner_must_be_a_member_and_the_name_is_required(self):
        outsider = self.add(self.owner, owner_id=self.outsider.id)
        self.assertEqual(outsider.status_code, 400)
        self.assertEqual(outsider.data, {"owner_id": ["Owner must be a member of the campaign."]})
        self.assertEqual(self.add(self.owner, name="   ").data, {"name": ["This field may not be blank."]})

        camp = self.add(self.owner, owner_id=self.player.id).data
        self.assertEqual(self.edit(self.owner, camp["id"], owner_id=self.outsider.id).status_code, 400)
        unassigned = self.edit(self.owner, camp["id"], owner_id=None, name=" Wharf ")

        self.assertEqual((unassigned.data["owner_id"], unassigned.data["name"]), (None, "Wharf"))
        self.assertEqual(CampaignEncampment.objects.get(id=camp["id"]).owner_id, None)

    def test_an_encampments_owner_cannot_edit_it_without_the_code(self):
        # Characterises current behaviour (CAMP-TWEAK-08, pinned; flips in PR C: its owner edits and reassigns it)
        camp = CampaignEncampment.objects.create(campaign=self.campaign, name="Dockside", owner=self.player)

        self.assertEqual(self.edit(self.player, camp.id, description="Mine").status_code, 403)
        self.grant(self.rival, "manage_encampments")
        moved = self.edit(self.rival, camp.id, owner_id=self.rival.id)  # anyone with the code reassigns any of them

        self.assertEqual((moved.status_code, moved.data["owner_name"]), (200, "Rex"))

    def test_there_is_no_delete(self):
        # Characterises current behaviour (CAMP-UX-03, pinned; flips in PR C: soft delete)
        camp = CampaignEncampment.objects.create(campaign=self.campaign, name="Dockside")

        self.assertEqual(self.delete_as(self.owner, self.url(f"encampments/{camp.id}/")).status_code, 405)
        self.assertTrue(CampaignEncampment.objects.filter(id=camp.id).exists())

    def test_the_page_answers_404_while_it_is_off_and_to_outsiders(self):
        camp = CampaignEncampment.objects.create(campaign=self.campaign, name="Dockside")
        self.assertEqual(self.get_as(self.outsider, self.url("encampments/")).status_code, 404)
        self.enable_features(encampments=False)

        self.assertEqual(self.get_as(self.owner, self.url("encampments/")).status_code, 404)
        self.assertEqual(self.add(self.owner).status_code, 404)
        self.assertEqual(self.edit(self.owner, camp.id, name="Wharf").status_code, 404)
        elsewhere = CampaignEncampment.objects.create(campaign=self.elsewhere, name="Foreign")
        self.enable_features()
        self.assertEqual(self.edit(self.owner, elsewhere.id, name="Mine").status_code, 404)


class LocationTests(CampaignTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enable_features()

    def add(self, user: Any, **body: Any) -> Any:
        return self.post_as(user, self.url("locations/"), {"name": "River Quarter", **body})

    def test_writes_need_manage_locations_and_there_is_no_delete(self):
        self.assertEqual(self.add(self.player).status_code, 403)
        location = self.add(self.admin).data
        url = self.url(f"locations/{location['id']}/")
        self.assertEqual(self.patch_as(self.player, url, {"d6_1": "Ambush"}).status_code, 403)
        self.assertEqual(self.get_as(self.player, self.url("locations/")).status_code, 200)

        self.grant(self.player, "manage_locations")

        self.assertEqual(self.patch_as(self.player, url, {"d6_1": "Ambush"}).data["d6_1"], "Ambush")
        # CAMP-UX-03's location half is parked: no delete for anyone
        self.assertEqual(self.delete_as(self.owner, url).status_code, 405)
        self.assertTrue(CampaignLocation.objects.filter(id=location["id"]).exists())

    def test_content_is_sanitised_and_rolls_are_kept_as_typed(self):
        response = self.add(
            self.owner, content="<p>Main text</p><script>alert(1)</script>", d6_6="<strong>Secret route</strong>"
        )

        self.assertEqual(response.status_code, 201)
        self.assertIn("<p>Main text</p>", response.data["content"])
        self.assertNotIn("<script", response.data["content"])
        self.assertEqual(response.data["d6_6"], "<strong>Secret route</strong>")  # rendered as text (LocationsTable)

    def test_the_page_answers_404_while_it_is_off(self):
        location = CampaignLocation.objects.create(campaign=self.campaign, name="River Quarter")
        self.enable_features(locations=False)

        self.assertEqual(self.get_as(self.owner, self.url("locations/")).status_code, 404)
        self.assertEqual(self.add(self.owner).status_code, 404)
        self.assertEqual(
            self.patch_as(self.owner, self.url(f"locations/{location.id}/"), {"name": "X"}).status_code, 404
        )
