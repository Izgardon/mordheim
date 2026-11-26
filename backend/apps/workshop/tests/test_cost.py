"""A workshop warband's cost against its budget (the workshop plan): read live, warned above, never blocked."""

from typing import Any

from apps.campaigns.models import CampaignSettings
from apps.warbands.models import Warband
from apps.warbands.services.purchases import OVER_BUDGET
from apps.warbands.services.roster_cost import roster_cost, roster_value

from .support import KIT_COST, WorkshopTestCase, kit_out


class CostTests(WorkshopTestCase):
    def kitted(self) -> Any:
        row = self.make_warband(template_variant="reikland")
        kit_out(
            self.warband_of(row),
            human=self.human,
            axe=self.book_axe,
            sword=self.book_sword,
            skill=self.infiltration[0],
            special=self.large,
            spell=self.lifestealer[0],
        )
        return row

    def test_the_cost_is_every_unit_and_every_copy_still_on_the_roster(self) -> None:
        warband = self.warband_of(self.kitted())
        with self.assertNumQueries(1):
            self.assertEqual(roster_cost(warband), KIT_COST)
        value = roster_value(warband)
        self.assertEqual((value.cost, value.budget, value.over), (KIT_COST, 500, False))

    def test_a_variants_gold_is_the_budget(self) -> None:
        template = self.made.template
        template.variants = [{"key": "reikland", "name": "Reikland", "starting_gold": 600}]
        template.save()
        warband = self.warband_of(self.make_warband(template_variant="reikland"))
        self.assertEqual(roster_value(warband).budget, 600)

    def test_buying_above_the_budget_warns_of_the_budget_and_goes_ahead(self) -> None:
        row = self.kitted()
        body = {"item_id": self.heavy_armour.id, "target_type": "stash", "quantity": 6, "price": 50}
        response = self.post_as(self.player, f"/api/warbands/{row['id']}/purchases/", body)
        self.assertEqual(response.status_code, 201, response.data)
        codes = [warning["code"] for warning in response.data["warnings"]]
        self.assertEqual(codes, [OVER_BUDGET])
        warning = response.data["warnings"][0]
        self.assertEqual((warning["cost"], warning["budget"]), (KIT_COST + 300, 500))
        sheet = self.get_as(self.player, f"/api/warbands/{row['id']}/sheet/").data
        self.assertEqual(sheet["workshop"]["cost"], KIT_COST + 300)

    def test_every_writes_summary_carries_the_cost_after_it(self) -> None:
        # the page's "Cost 455 / 500 gc" follows each write from its answer's summary, as the gold does
        row = self.kitted()
        base = f"/api/warbands/{row['id']}/"
        summary = self.get_as(self.player, f"{base}summary/").data
        self.assertEqual(summary["workshop"], {"cost": KIT_COST, "budget": 500})
        body = {"item_id": self.heavy_armour.id, "target_type": "stash", "quantity": 1, "price": 50}
        response = self.post_as(self.player, f"{base}purchases/", body)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["summary"]["workshop"], {"cost": KIT_COST + 50, "budget": 500})

    def test_hiring_above_the_budget_warns_of_the_budget_and_goes_ahead(self) -> None:
        row = self.kitted()
        CampaignSettings.objects.filter(campaign_id=row["campaign_id"]).update(starting_gold=250)
        body = {"source": "hired_sword", "id": self.ogre.id}
        response = self.post_as(self.player, f"/api/warbands/{row['id']}/hirelings/hire/", body)
        self.assertEqual(response.status_code, 201, response.data)
        warning = next(found for found in response.data["warnings"] if found["code"] == OVER_BUDGET)
        self.assertEqual((warning["cost"], warning["budget"]), (KIT_COST + 80, 250))
        in_campaign = self.post_as(self.player, f"/api/warbands/{self.warband.id}/hirelings/hire/", body)
        self.assertEqual(in_campaign.status_code, 201, in_campaign.data)
        self.assertNotIn(OVER_BUDGET, [found["code"] for found in in_campaign.data["warnings"]])

    def test_a_campaigns_warband_has_no_workshop_in_its_summary(self) -> None:
        warband = Warband.objects.create(campaign=self.elsewhere, user=self.outsider, name="Far")
        self.assertIsNone(self.get_as(self.outsider, f"/api/warbands/{warband.id}/summary/").data["workshop"])
