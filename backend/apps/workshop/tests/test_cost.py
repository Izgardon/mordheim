"""A workshop warband's running cost (the workshop plan): read live, with no budget, gold or warning (William, 27 Nov
2026: "it shouldn't matter here, we just need a running cost")."""

from typing import Any

from apps.warbands.models import Warband, WarbandTrade
from apps.warbands.services.roster_cost import roster_cost

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

    def test_it_starts_on_no_gold_whatever_its_lists_gold(self) -> None:
        template = self.made.template
        template.variants = [{"key": "reikland", "name": "Reikland", "starting_gold": 600}]
        template.save()
        warband = self.warband_of(self.make_warband(template_variant="reikland"))
        self.assertEqual(warband.gold, 0)
        self.assertFalse(WarbandTrade.objects.filter(warband=warband).exists())  # no Starting Gold row

    def test_buying_any_amount_warns_of_nothing_and_the_sheet_carries_the_cost_alone(self) -> None:
        row = self.kitted()
        body = {"item_id": self.heavy_armour.id, "target_type": "stash", "quantity": 6, "price": 50}
        response = self.post_as(self.player, f"/api/warbands/{row['id']}/purchases/", body)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["warnings"], [])  # no budget to go over, and its gold below 0 matters to nobody
        sheet = self.get_as(self.player, f"/api/warbands/{row['id']}/sheet/").data
        self.assertEqual(sheet["workshop"], {"cost": KIT_COST + 300, "share_code": row["share_code"]})

    def test_every_writes_summary_carries_the_cost_after_it(self) -> None:
        # the page's "Cost 240 gc" follows each write from its answer's summary
        row = self.kitted()
        base = f"/api/warbands/{row['id']}/"
        summary = self.get_as(self.player, f"{base}summary/").data
        self.assertEqual(summary["workshop"], {"cost": KIT_COST})
        body = {"item_id": self.heavy_armour.id, "target_type": "stash", "quantity": 1, "price": 50}
        response = self.post_as(self.player, f"{base}purchases/", body)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["summary"]["workshop"], {"cost": KIT_COST + 50})

    def test_hiring_warns_of_no_gold_and_a_campaigns_purchase_still_does(self) -> None:
        row = self.kitted()
        body = {"source": "hired_sword", "id": self.ogre.id}
        response = self.post_as(self.player, f"/api/warbands/{row['id']}/hirelings/hire/", body)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["warnings"], [])
        self.warband.refresh_from_db()
        price = self.warband.gold + 50  # a campaign's warband still warns below 0 gc
        bought = {"item_id": self.heavy_armour.id, "target_type": "stash", "quantity": 1, "price": price}
        in_campaign = self.post_as(self.player, f"/api/warbands/{self.warband.id}/purchases/", bought)
        self.assertEqual(in_campaign.status_code, 201, in_campaign.data)
        self.assertEqual([found["code"] for found in in_campaign.data["warnings"]], ["gold_negative"])

    def test_a_campaigns_warband_has_no_workshop_in_its_summary(self) -> None:
        warband = Warband.objects.create(campaign=self.elsewhere, user=self.outsider, name="Far")
        self.assertIsNone(self.get_as(self.outsider, f"/api/warbands/{warband.id}/summary/").data["workshop"])


class CostQueryTests(WorkshopTestCase):
    def test_the_summary_and_a_codes_preview_read_in_as_many_queries_whatever_the_roster(self) -> None:
        # its cost is one query (roster_cost.py), and no budget is read: a list's gold and variant never come into it
        row = self.make_warband(template_variant="reikland")
        listed = self.make_list(name="Caravans A", copy_of_template_id=self.made.template.id)
        self.client.force_authenticate(user=self.player)
        for kitted in (False, True):
            if kitted:
                kit_out(
                    self.warband_of(row),
                    human=self.human,
                    axe=self.book_axe,
                    sword=self.book_sword,
                    skill=self.infiltration[0],
                    special=self.large,
                    spell=self.lifestealer[0],
                )
            with self.assertNumQueries(SUMMARY_QUERIES):
                self.client.get(f"/api/warbands/{row['id']}/summary/")
            with self.assertNumQueries(PREVIEW_QUERIES):
                self.client.get(f"/api/workshop/shared/{row['share_code']}/")
        with self.assertNumQueries(PREVIEW_QUERIES):  # a list's alike
            self.client.get(f"/api/workshop/shared/{listed['share_code']}/")


SUMMARY_QUERIES = 7  # the warband, its units and resources, and its cost
PREVIEW_QUERIES = 3  # the code, then a warband's cost and its roster's counts (a list's types)
