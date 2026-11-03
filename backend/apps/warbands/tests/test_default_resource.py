"""The default resource on a warband (William, 3 Nov 2026): every new warband starts with it at 0, named as its campaign
names it, instead of Treasure; it is listed first, never deleted, and renamed only by the campaign's settings (a
PATCH naming it as it is still goes through); its amount changes as any resource's does."""

from typing import Any

from apps.campaigns.models import CampaignSettings
from apps.campaigns.tests.campaign_support import CampaignTestCase, make_user
from apps.warbands.models import Warband, WarbandResource


class DefaultResourceTests(CampaignTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.default = WarbandResource.objects.get(warband=self.warband, is_default=True)

    def rows(self, warband: Warband) -> list[tuple[str, int, bool]]:
        return list(WarbandResource.objects.filter(warband=warband).values_list("name", "amount", "is_default"))

    def resource_url(self, resource: WarbandResource, suffix: str = "") -> str:
        return f"/api/warbands/{self.warband.id}/resources/{resource.id}/{suffix}"

    def listed(self, response: Any) -> list[tuple[str, bool]]:
        return [(row["name"], row["is_default"]) for row in response.json()]

    def test_a_new_warband_starts_with_the_default_resource_at_0_and_no_treasure(self):
        self.assertEqual(self.rows(self.warband), [("Wyrdstone", 0, True)])
        self.assertEqual(self.rows(self.rival_warband), [("Wyrdstone", 0, True)])

    def test_a_new_warband_s_default_resource_is_named_as_the_campaign_names_it(self):
        CampaignSettings.objects.filter(campaign=self.campaign).update(default_resource_name="Warpstone")
        newcomer = make_user("newcomer@example.com", "Nina")
        self.join(newcomer)

        warband = self._create_warband(self.client, newcomer, "Crows")

        self.assertEqual(self.rows(warband), [("Warpstone", 0, True)])

    def test_it_is_listed_first(self):
        WarbandResource.objects.create(warband=self.warband, name="Amber", amount=2)

        resources = self.get_as(self.player, f"/api/warbands/{self.warband.id}/resources/")
        summary = self.get_as(self.player, f"/api/warbands/{self.warband.id}/summary/").json()["resources"]

        self.assertEqual(self.listed(resources), [("Wyrdstone", True), ("Amber", False)])
        self.assertEqual([(row["name"], row["is_default"]) for row in summary], [("Wyrdstone", True), ("Amber", False)])

    def test_it_is_never_deleted(self):
        response = self.delete_as(self.player, self.resource_url(self.default))

        self.assertEqual((response.status_code, response.json()["code"]), (400, "default_resource"))
        self.assertTrue(WarbandResource.objects.filter(id=self.default.id).exists())

    def test_only_the_campaign_renames_it_and_its_amount_changes_as_any_resource_s(self):
        renamed = self.patch_as(self.player, self.resource_url(self.default), {"name": "Gold"})
        same_name = self.patch_as(self.player, self.resource_url(self.default), {"name": "Wyrdstone", "delta": 3})
        sold = self.post_as(self.player, self.resource_url(self.default, "sell/"), {"quantity": 1, "price": 20})

        self.assertEqual((renamed.status_code, renamed.json()["code"]), (400, "default_resource"))
        self.assertEqual((same_name.status_code, same_name.json()["amount"]), (200, 3))
        self.assertEqual((sold.status_code, sold.json()["resource"]["amount"]), (200, 2))
        self.assertEqual(self.rows(self.warband), [("Wyrdstone", 2, True)])

    def test_any_other_resource_is_still_renamed_and_deleted(self):
        amber = WarbandResource.objects.create(warband=self.warband, name="Amber", amount=2)

        renamed = self.patch_as(self.player, self.resource_url(amber), {"name": "Gromril"})
        taken = self.patch_as(self.player, self.resource_url(amber), {"name": "wyrdstone"})  # the default's name
        deleted = self.delete_as(self.player, self.resource_url(amber))

        self.assertEqual((renamed.status_code, renamed.json()["name"]), (200, "Gromril"))
        self.assertEqual(taken.status_code, 400)
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(self.rows(self.warband), [("Wyrdstone", 0, True)])
