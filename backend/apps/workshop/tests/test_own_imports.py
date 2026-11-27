"""Picking my own workshop warband or list in a campaign (William, 27 Nov 2026: "a user didn't have to import any of
their own warbands or lists as they were there already"): the campaign imports take its id as well as a code, copy it
exactly as its code would, and refuse anyone else's, a deleted one and a campaign's in the server's words."""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.warband_templates.models import WarbandTemplate
from apps.warbands.models import LedgerAction, Warband, WarbandTrade

from .support import KIT_COST
from .test_imports import ImportTestCase, roster


class OwnWarbandTests(ImportTestCase):
    def pick(self, user: Any, body: dict[str, Any]) -> Any:
        return self.post_as(user, self.url("warbands/import/"), body)

    def test_my_workshop_warband_is_picked_by_id_and_copied_as_its_code_would_be(self) -> None:
        row = self.kitted(user=self.admin)
        response = self.pick(self.admin, {"warband_id": row["id"]})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data["gold"], response.data["warnings"]), (500 - KIT_COST, []))
        copy = Warband.objects.get(pk=response.data["warband_id"])
        self.assertEqual((copy.campaign_id, copy.user_id, copy.in_workshop), (self.campaign.id, self.admin.id, False))
        self.assertEqual(roster(copy), roster(self.warband_of(row)))
        ledger = WarbandTrade.objects.filter(warband=copy, action=LedgerAction.BUY).values_list("price", "description")
        self.assertEqual(list(ledger), [(-KIT_COST, "Imported The Gilded Wagon")])
        self.assertTrue(Warband.objects.filter(pk=row["id"], deleted_at__isnull=True).exists())  # it stays mine

    def test_anyone_elses_a_deleted_one_and_a_campaigns_are_refused(self) -> None:
        theirs = self.kitted(user=self.player)
        refused = self.pick(self.admin, {"warband_id": theirs["id"]})
        self.assertEqual((refused.status_code, refused.data["code"]), (400, "not_yours"))
        self.assertEqual(refused.data["fields"], {"warband_id": ["That isn't one of your warbands."]})
        mine = self.make_warband(user=self.admin)
        self.delete_as(self.admin, f"/api/warbands/{mine['id']}/")
        self.assertEqual(self.pick(self.admin, {"warband_id": mine["id"]}).data["code"], "not_yours")
        campaigns = self.pick(self.rival, {"warband_id": self.rival_warband.id})  # his own, but a campaign's
        self.assertEqual((campaigns.status_code, campaigns.data["code"]), (400, "not_yours"))
        self.assertEqual(self.pick(self.admin, {"warband_id": 999999}).data["code"], "not_yours")
        both = self.pick(self.admin, {"warband_id": theirs["id"], "code": theirs["share_code"]})
        self.assertEqual((both.status_code, list(both.data)), (400, ["warband_id"]))
        neither = self.pick(self.admin, {})
        self.assertEqual((neither.status_code, list(neither.data)), (400, ["code"]))
        self.assertEqual(self.pick(self.outsider, {"warband_id": theirs["id"]}).status_code, 404)  # not a member
        self.assertFalse(Warband.objects.filter(campaign=self.campaign, user=self.admin).exists())

    def test_a_player_with_a_warband_here_still_gets_has_warband(self) -> None:
        mine = self.make_warband(user=self.player)
        response = self.pick(self.player, {"warband_id": mine["id"]})
        self.assertEqual((response.status_code, response.data["code"]), (409, "has_warband"))

    def test_by_id_costs_what_by_code_does(self) -> None:
        by_code, by_id = self.kitted(user=self.admin), self.kitted(user=self.owner)
        with CaptureQueriesContext(connection) as coded:
            self.assertEqual(self.pick(self.admin, {"code": by_code["share_code"]}).status_code, 201)
        with self.assertNumQueries(len(coded)):
            self.assertEqual(self.pick(self.owner, {"warband_id": by_id["id"]}).status_code, 201)


class OwnListTests(ImportTestCase):
    def pick(self, user: Any, body: dict[str, Any]) -> Any:
        return self.post_as(user, self.url("warband-templates/import/"), body)

    def test_my_workshop_list_is_picked_by_id_as_the_campaigns_own(self) -> None:
        listed = self.make_list(user=self.player, name="Watch", copy_of_template_id=self.made.template.id)
        response = self.pick(self.player, {"list_id": listed["id"]})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["name"], "Watch")
        template = WarbandTemplate.objects.get(pk=response.data["template_id"])
        self.assertEqual((template.campaign_id, template.copied_from_id), (self.campaign.id, listed["id"]))
        self.assertEqual(template.fighters.count(), 2)
        self.assertIsNone(template.share_code)  # nothing in a campaign has a code

    def test_anyone_elses_a_deleted_one_the_books_and_a_campaigns_are_refused(self) -> None:
        theirs = self.make_list(user=self.rival)
        refused = self.pick(self.player, {"list_id": theirs["id"]})
        self.assertEqual((refused.status_code, refused.data["code"]), (400, "not_yours"))
        self.assertEqual(refused.data["fields"], {"list_id": ["That isn't one of your lists."]})
        self.assertEqual(self.pick(self.player, {"list_id": self.made.template.id}).data["code"], "not_yours")
        made = self.post_as(self.player, "/api/warband-templates/", {"name": "Wolves", "campaign_id": self.campaign.id})
        campaigns = self.pick(self.player, {"list_id": made.data["template"]["id"]})
        self.assertEqual(campaigns.data["code"], "not_yours")
        mine = self.make_list(user=self.player, name="Gone")
        workshop = mine["campaign_id"]
        self.assertEqual(
            self.delete_as(self.player, f"/api/warband-templates/{mine['id']}/?campaign_id={workshop}").status_code, 204
        )
        self.assertEqual(self.pick(self.player, {"list_id": mine["id"]}).data["code"], "not_yours")
        self.revoke(self.rival, "edit_catalogue")
        self.assertEqual(self.pick(self.rival, {"list_id": theirs["id"]}).status_code, 403)
        self.assertFalse(WarbandTemplate.objects.filter(campaign=self.campaign, copied_from_id=theirs["id"]).exists())

    def test_by_id_costs_what_by_code_does(self) -> None:
        source = {"copy_of_template_id": self.made.template.id}
        by_code = self.make_list(user=self.player, name="Watch", **source)
        by_id = self.make_list(user=self.rival, name="Ward", **source)
        with CaptureQueriesContext(connection) as coded:
            self.assertEqual(self.pick(self.player, {"code": by_code["share_code"]}).status_code, 201)
        with self.assertNumQueries(len(coded) - 1):  # a code is first looked for among the warbands
            self.assertEqual(self.pick(self.rival, {"list_id": by_id["id"]}).status_code, 201)
