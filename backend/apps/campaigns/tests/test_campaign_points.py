"""Campaign points (William, 7 Nov 2026: "campaign points campaign wide setting - if enabled adds another mandatory
resource called campaign points"): a campaign setting, off at first, that the campaign's settings change. On, every
warband holds Campaign points (at 0, listed after the default resource, never renamed, deleted or sold, changed like any
resource), a warband raised later too; off, they are hidden with their amounts kept, and on again they come back."""

from typing import Any

from apps.warbands.models import LedgerAction, Warband, WarbandResource, WarbandTrade
from apps.warbands.units.services.fee_payments import locked_counters

from .campaign_support import CampaignTestCase, make_user


class CampaignPointsTests(CampaignTestCase):
    def switch(self, on: bool, user: Any = None) -> Any:
        return self.patch_as(user or self.owner, self.url(), {"enable_campaign_points": on})

    def rows(self, warband: Warband) -> list[tuple[str, int]]:
        return list(WarbandResource.objects.filter(warband=warband).values_list("name", "amount"))

    def points(self, warband: Warband) -> WarbandResource:
        return WarbandResource.objects.get(warband=warband, is_campaign_points=True)

    def resource_url(self, resource: WarbandResource, suffix: str = "") -> str:
        return f"/api/warbands/{resource.warband_id}/resources/{resource.id}/{suffix}"

    def shown(self, warband: Warband) -> dict[str, list[str]]:
        """The counters each read shows: the resources list, the summary and the sheet."""
        base = f"/api/warbands/{warband.id}/"
        resources = self.get_as(self.player, f"{base}resources/").json()
        summary = self.get_as(self.player, f"{base}summary/").json()["resources"]
        sheet = self.get_as(self.player, f"{base}sheet/").json()["summary"]["resources"]
        return {
            "resources": [row["name"] for row in resources],
            "summary": [row["name"] for row in summary],
            "sheet": [row["name"] for row in sheet],
        }

    def test_it_is_off_at_first_and_no_warband_holds_them(self):
        self.assertFalse(self.get_as(self.player, self.url()).json()["enable_campaign_points"])
        self.assertEqual(WarbandResource.objects.filter(is_campaign_points=True).count(), 0)

    def test_only_those_who_edit_the_settings_switch_it(self):
        refused = [self.switch(True, user).status_code for user in (self.player, self.admin)]

        self.assertEqual(refused, [403, 403])
        self.assertFalse(WarbandResource.objects.filter(is_campaign_points=True).exists())

    def test_on_every_warband_holds_them_at_0_after_the_default_resource(self):
        WarbandResource.objects.create(warband=self.warband, name="Amber", amount=2)

        response = self.switch(True)

        self.assertEqual((response.status_code, response.json()["enable_campaign_points"]), (200, True))
        self.assertEqual(self.rows(self.warband), [("Wyrdstone", 0), ("Campaign points", 0), ("Amber", 2)])
        self.assertEqual(self.rows(self.rival_warband), [("Wyrdstone", 0), ("Campaign points", 0)])
        listed = ["Wyrdstone", "Campaign points", "Amber"]
        self.assertEqual(self.shown(self.warband), {"resources": listed, "summary": listed, "sheet": listed})
        flags = self.get_as(self.player, f"/api/warbands/{self.warband.id}/resources/").json()[1]
        self.assertEqual((flags["is_default"], flags["is_campaign_points"]), (False, True))

    def test_they_change_like_any_resource_but_are_never_sold_renamed_or_deleted(self):
        # William, 8 Nov 2026: "campaign points resource when on shouldnt have any menu options as it isnt sellable"
        self.switch(True)
        points = self.points(self.warband)

        added = self.patch_as(self.player, self.resource_url(points), {"delta": 3})
        sold = self.post_as(self.player, self.resource_url(points, "sell/"), {"quantity": 1, "price": 10})
        renamed = self.patch_as(self.player, self.resource_url(points), {"name": "Glory"})
        deleted = self.delete_as(self.player, self.resource_url(points))

        self.assertEqual((added.status_code, added.json()["amount"]), (200, 3))
        self.assertEqual(
            (sold.status_code, sold.json()),
            (400, {"detail": "Campaign points can't be sold.", "code": "campaign_points"}),
        )
        self.assertEqual((renamed.status_code, renamed.json()["code"]), (400, "campaign_points"))
        self.assertEqual((deleted.status_code, deleted.json()["code"]), (400, "campaign_points"))
        self.assertEqual(self.rows(self.warband), [("Wyrdstone", 0), ("Campaign points", 3)])
        self.assertFalse(WarbandTrade.objects.filter(warband=self.warband, action=LedgerAction.SELL).exists())

    def test_off_hides_them_with_their_amounts_kept_and_on_again_brings_them_back(self):
        self.switch(True)
        WarbandResource.objects.filter(warband=self.warband, is_campaign_points=True).update(amount=4)
        points = self.points(self.warband)

        self.switch(False)
        hidden = self.shown(self.warband)
        unreachable = self.patch_as(self.player, self.resource_url(points), {"delta": 1})
        self.switch(True)

        self.assertEqual(hidden, {"resources": ["Wyrdstone"], "summary": ["Wyrdstone"], "sheet": ["Wyrdstone"]})
        self.assertEqual(unreachable.status_code, 404)
        self.assertEqual(self.rows(self.warband), [("Wyrdstone", 0), ("Campaign points", 4)])
        self.assertEqual(self.points(self.warband).id, points.id)
        listed = ["Wyrdstone", "Campaign points"]
        self.assertEqual(self.shown(self.warband), {"resources": listed, "summary": listed, "sheet": listed})

    def test_a_warband_raised_while_they_are_on_holds_them_and_one_raised_while_off_gets_them_when_on(self):
        newcomer, late = make_user("newcomer@example.com", "Nina"), make_user("late@example.com", "Lars")
        self.join(newcomer)
        self.join(late)
        self.switch(True)
        crows = self._create_warband(self.client, newcomer, "Crows")
        self.switch(False)
        owls = self._create_warband(self.client, late, "Owls")

        self.assertEqual(self.rows(crows), [("Wyrdstone", 0), ("Campaign points", 0)])
        self.assertEqual(self.rows(owls), [("Wyrdstone", 0)])
        self.switch(True)
        self.assertEqual(self.rows(owls), [("Wyrdstone", 0), ("Campaign points", 0)])

    def test_a_resource_of_that_name_a_warband_has_becomes_its_campaign_points(self):
        own = WarbandResource.objects.create(warband=self.warband, name="campaign points", amount=6)

        self.switch(True)

        self.assertEqual(self.points(self.warband).id, own.id)
        self.assertEqual(self.rows(self.warband), [("Wyrdstone", 0), ("campaign points", 6)])

    def test_the_default_resource_is_never_named_campaign_points(self):
        response = self.patch_as(self.owner, self.url(), {"default_resource_name": "campaign Points"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("default_resource_name", response.json())

    def test_a_fee_pays_from_them_only_while_they_are_on(self):
        self.switch(True)
        points = self.points(self.warband)

        paying = [counter.id for counter in locked_counters(self.warband.id)]
        self.switch(False)
        hidden = [counter.id for counter in locked_counters(self.warband.id)]

        self.assertIn(points.id, paying)
        self.assertNotIn(points.id, hidden)
