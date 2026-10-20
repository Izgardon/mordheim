"""Encampments and locations (decision 9; CAMP-UX-03).

Both pages sit behind a settings flag (404 while it's off). Encampments (decision 9, CAMP-TWEAK-08): any member adds
one, owned by himself unless he picks another member; its owner or `manage_encampments` edits, reassigns and removes it
(a soft delete). Locations are parked: writes need `manage_locations` and there is no delete.
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

    def remove(self, user: Any, camp_id: int) -> Any:
        return self.delete_as(user, self.url(f"encampments/{camp_id}/"))

    def test_any_member_adds_one_owned_by_himself_unless_he_picks_another(self):
        # decision 9, CAMP-TWEAK-08: adding needed manage_encampments and the owner defaulted to nobody
        added = self.add(self.player, description="Staging point")
        by_admin = self.add(self.admin, name="Harbour", owner_id=self.rival.id)
        unassigned = self.add(self.rival, name="Wharf", owner_id=None)

        self.assertEqual(added.status_code, 201)
        self.assertEqual(
            added.data,
            {
                "id": added.data["id"],
                "campaign_id": self.campaign.id,
                "name": "Dockside",
                "owner_id": self.player.id,
                "owner_name": "Pia",
                "owner_left": False,
                "description": "Staging point",
                "capabilities": {"edit": True},
            },
        )
        self.assertEqual((by_admin.status_code, by_admin.data["owner_name"]), (201, "Rex"))
        self.assertEqual((unassigned.data["owner_id"], unassigned.data["capabilities"]), (None, {"edit": False}))
        listed = self.get_as(self.rival, self.url("encampments/")).data
        self.assertEqual(
            [(row["name"], row["capabilities"]["edit"]) for row in listed],
            [("Dockside", False), ("Harbour", True), ("Wharf", False)],  # by name, then id; Rex owns Harbour
        )

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

    def test_its_owner_or_manage_encampments_edits_reassigns_and_removes_it(self):
        # CAMP-TWEAK-08: its owner couldn't edit it without the code; anyone with the code still edits any of them
        camp = CampaignEncampment.objects.create(campaign=self.campaign, name="Dockside", owner=self.player)
        self.assertEqual(self.edit(self.rival, camp.id, description="Mine").status_code, 403)
        self.assertEqual(self.remove(self.rival, camp.id).status_code, 403)

        self.assertEqual(self.edit(self.player, camp.id, description="Ours").data["description"], "Ours")
        moved = self.edit(self.player, camp.id, owner_id=self.rival.id)

        self.assertEqual((moved.status_code, moved.data["owner_name"]), (200, "Rex"))
        self.assertEqual(self.edit(self.player, camp.id, name="Back").status_code, 403)  # not his any more
        self.grant(self.player, "manage_encampments")
        self.assertEqual(self.edit(self.player, camp.id, name="Back").status_code, 200)
        self.assertEqual(self.remove(self.rival, camp.id).status_code, 204)

    def test_removing_is_a_soft_delete_that_hides_it(self):
        # CAMP-UX-03: there was no delete
        camp = CampaignEncampment.objects.create(campaign=self.campaign, name="Dockside")

        self.assertEqual(self.remove(self.admin, camp.id).status_code, 204)

        self.assertEqual(self.get_as(self.owner, self.url("encampments/")).data, [])
        stored = CampaignEncampment.objects.get(id=camp.id)
        self.assertEqual((stored.removed_at is not None, stored.removed_by_id), (True, self.admin.id))
        self.assertEqual(self.edit(self.owner, camp.id, name="Back").status_code, 404)
        self.assertEqual(self.remove(self.owner, camp.id).status_code, 404)

    def test_an_encampment_whose_owner_left_says_so(self):
        # the Rejoining call: his encampments stay his and show "(left)" (a gap PR A left)
        camp = CampaignEncampment.objects.create(campaign=self.campaign, name="Dockside", owner=self.player)
        self.delete_as(self.owner, self.url(f"members/{self.player.id}/"))

        row = self.get_as(self.rival, self.url("encampments/")).data[0]

        self.assertEqual((row["id"], row["owner_id"], row["owner_name"], row["owner_left"]), (camp.id, self.player.id, "Pia", True))  # fmt: skip
        self.join(self.player)
        self.assertFalse(self.get_as(self.rival, self.url("encampments/")).data[0]["owner_left"])

    def test_the_page_answers_404_while_it_is_off_and_to_outsiders(self):
        camp = CampaignEncampment.objects.create(campaign=self.campaign, name="Dockside")
        self.assertEqual(self.get_as(self.outsider, self.url("encampments/")).status_code, 404)
        self.enable_features(encampments=False)

        self.assertEqual(self.get_as(self.owner, self.url("encampments/")).status_code, 404)
        self.assertEqual(self.add(self.owner).status_code, 404)
        self.assertEqual(self.edit(self.owner, camp.id, name="Wharf").status_code, 404)
        self.assertEqual(self.remove(self.owner, camp.id).status_code, 404)
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
