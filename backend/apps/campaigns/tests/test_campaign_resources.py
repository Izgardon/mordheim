"""`GET campaigns/<id>/resources/`: the resources a hire fee or upkeep picks its one resource from (William, 7 Nov 2026:
"resource options should be options from the campaigns resources that still exist")."""

from apps.campaigns.models import CampaignSettings
from apps.campaigns.services.resources import campaign_resources
from apps.warbands.models import WarbandResource

from .campaign_support import CampaignTestCase


class CampaignResourcesTests(CampaignTestCase):
    def names(self) -> list[tuple[str, bool, bool]]:
        response = self.get_as(self.player, self.url("resources/"))
        self.assertEqual(response.status_code, 200, response.data)
        return [(row["name"], row["is_default"], row["is_campaign_points"]) for row in response.json()]

    def test_the_default_resource_then_campaign_points_then_the_names_its_warbands_hold(self):
        WarbandResource.objects.create(warband=self.warband, name="Treasure")
        WarbandResource.objects.create(warband=self.rival_warband, name="treasure ")  # the same, in its own case
        WarbandResource.objects.create(warband=self.rival_warband, name="Gromril")
        WarbandResource.objects.create(warband=self.rival_warband, name="Gold")  # the fee's gold, never a resource
        self.assertEqual(
            self.names(), [("Wyrdstone", True, False), ("Gromril", False, False), ("Treasure", False, False)]
        )

        CampaignSettings.objects.filter(campaign=self.campaign).update(
            default_resource_name="Warpstone", enable_campaign_points=True
        )
        self.assertEqual(self.names()[:2], [("Warpstone", True, False), ("Campaign points", False, True)])

    def test_a_resource_no_warband_holds_any_more_is_gone(self):
        gromril = WarbandResource.objects.create(warband=self.warband, name="Gromril")
        self.assertIn(("Gromril", False, False), self.names())

        gromril.delete()

        self.assertNotIn("Gromril", [name for name, _, _ in self.names()])

    def test_members_only_and_two_queries_whatever_the_warbands_hold(self):
        self.assertEqual(self.get_as(self.outsider, self.url("resources/")).status_code, 404)
        for index in range(5):
            WarbandResource.objects.create(warband=self.warband, name=f"Shard {index}")
        with self.assertNumQueries(2):
            rows = campaign_resources(self.campaign.id)
        self.assertEqual(len(rows), 6)
