"""What a workshop never does (the workshop plan, version 2): it is its player's alone, never joined, played in or
traded from; its catalogue is his to write as any campaign's editor writes one's, but never a house version of a book
list; and he may hold many warbands there, one in a campaign."""

from typing import Any

from django.db import IntegrityError

from apps.campaigns.models import Campaign
from apps.items.models import Item
from apps.items.tests.catalogue_support import ITEMS
from apps.warband_templates.models import WarbandTemplate
from apps.warband_templates.tests.support import PROFILE
from apps.warbands.models import Warband

from .support import WorkshopTestCase

WORKSHOP_REFUSED = "workshop_campaign"


class GuardTests(WorkshopTestCase):
    row: dict[str, Any]

    def setUp(self) -> None:
        super().setUp()
        self.row = self.make_warband()

    def refused(self, response: Any) -> None:
        self.assertEqual(response.status_code, 403, response.data)
        self.assertEqual(response.data["code"], WORKSHOP_REFUSED)

    def test_its_join_code_joins_nothing(self) -> None:
        join_code = self.workshop(self.row).join_code
        self.assertEqual(self.join(self.rival, join_code).status_code, 404)

    def test_only_its_player_reads_it(self) -> None:
        for url in (f"/api/warbands/{self.row['id']}/sheet/", f"/api/campaigns/{self.row['campaign_id']}/"):
            self.assertEqual(self.get_as(self.rival, url).status_code, 404)
            self.assertEqual(self.get_as(self.player, url).status_code, 200)

    def test_no_battle_trade_warband_settings_or_scenario_is_written_in_it(self) -> None:
        workshop = f"/api/campaigns/{self.row['campaign_id']}/"
        battle = self.post_as(self.player, f"{workshop}battles/", {"participants": [], "scenario": "Skirmish"})
        self.refused(battle)
        self.refused(self.post_as(self.player, f"{workshop}trade-requests/", {"target_user_id": self.rival.id}))
        raised = {"name": "Second", "warband_type_id": self.mercenaries.id, "campaign_id": self.row["campaign_id"]}
        self.refused(self.post_as(self.player, "/api/warbands/", raised))
        self.refused(self.patch_as(self.player, workshop, {"name": "Renamed"}))
        self.refused(self.post_as(self.player, f"{workshop}scenarios/random/"))
        self.refused(self.post_as(self.player, f"{workshop}join-code/"))
        self.refused(self.post_as(self.player, f"{workshop}archive/"))
        self.refused(self.post_as(self.player, f"{workshop}warband-types/", {"name": "Custom"}))
        self.refused(self.post_as(self.player, f"{workshop}warbands/import/", {"code": self.row["share_code"]}))

    def test_its_warbands_have_no_treasury(self) -> None:
        warband = f"/api/warbands/{self.row['id']}/"
        self.refused(self.post_as(self.player, f"{warband}trades/", {"action": "Adjustment", "price": 5}))
        self.refused(self.post_as(self.player, f"{warband}resources/", {"name": "Treasure", "amount": 1}))

    def test_the_sheet_says_it_is_a_workshops_with_its_cost_budget_and_code(self) -> None:
        sheet = self.get_as(self.player, f"/api/warbands/{self.row['id']}/sheet/").data
        self.assertEqual(sheet["workshop"], {"cost": 0, "budget": 500, "share_code": self.row["share_code"]})
        capabilities = sheet["capabilities"]
        held = ("workshop", "edit", "manage_items", "delete", "edit_catalogue")
        self.assertTrue(all(capabilities[name] for name in held), capabilities)
        self.assertFalse(capabilities["trade"])
        campaign_sheet = self.get_as(self.player, f"/api/warbands/{self.warband.id}/sheet/").data
        self.assertIsNone(campaign_sheet["workshop"])
        self.assertFalse(campaign_sheet["capabilities"]["workshop"])
        detail = self.get_as(self.player, f"/api/campaigns/{self.row['campaign_id']}/").data
        self.assertEqual(detail["kind"], "workshop")
        held_here = sorted(name for name, on in detail["capabilities"].items() if on)
        self.assertEqual(held_here, ["delete_catalogue", "edit_catalogue"])

    def test_its_player_writes_his_own_catalogue_entries_there(self) -> None:
        workshop = self.workshop(self.row)
        made = self.post_as(self.player, ITEMS.list_url(), ITEMS.body("Lucky Charm", workshop))
        self.assertEqual(made.status_code, 201, made.data)
        self.assertEqual(Item.objects.get(pk=made.data["id"]).campaign_id, workshop.pk)
        self.assertIn("Lucky Charm", self.listed(self.player, ITEMS, workshop))
        self.assertNotIn("Lucky Charm", self.listed(self.player, ITEMS, self.campaign))
        self.assertEqual(self.post_as(self.rival, ITEMS.list_url(), ITEMS.body("Charm", workshop)).status_code, 404)
        gone = self.delete_as(self.player, f"{ITEMS.detail_url(made.data['id'])}")
        self.assertEqual(gone.status_code, 204, getattr(gone, "data", None))

    def test_many_warbands_in_a_workshop_one_in_a_campaign(self) -> None:
        self.make_warband(name="Second", template_variant="reikland")
        self.assertEqual(Warband.objects.filter(campaign_id=self.row["campaign_id"], user=self.player).count(), 2)
        with self.assertRaises(IntegrityError):
            Warband.objects.create(campaign=self.campaign, user=self.player, name="Twin")


class ListGuardTests(WorkshopTestCase):
    def test_its_player_writes_his_own_lists_in_the_editor_never_a_book_one(self) -> None:
        row = self.make_list(copy_of_template_id=self.made.template.id)
        rules = f"/api/warband-templates/{row['id']}/rules/"
        body = {
            "campaign_id": row["campaign_id"],
            "rules": [{"title": "Night Eyes", "description": "Sees in the dark."}],
        }
        saved = self.put_as(self.player, rules, body)
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual(saved.data["template"]["id"], row["id"])
        fighter = {
            "name": "Sergeant",
            "kind": "hero",
            "cost": 35,
            "race_id": self.human.id,
            "max_count": 1,
            **PROFILE,
            "rules": [{"name": "Watchful", "description": "Never surprised."}],
        }
        added = self.post_as(self.player, f"/api/warband-templates/{row['id']}/fighters/", fighter)
        self.assertEqual(added.status_code, 201, added.data)  # with a written rule, the list's own special
        book = f"/api/warband-templates/{self.made.template.id}/rules/"
        refused = self.put_as(self.player, book, body)
        self.assertEqual(
            (refused.status_code, refused.data["code"]), (403, "workshop_book_entry")
        )  # never a house version
        self.assertEqual(WarbandTemplate.objects.filter(campaign_id=row["campaign_id"]).count(), 1)
        self.assertEqual(self.put_as(self.rival, rules, body).status_code, 404)

    def test_a_workshop_is_never_a_campaign_for_the_join_or_the_campaigns_list(self) -> None:
        row = self.make_list()
        self.assertFalse(Campaign.objects.filter(pk=row["campaign_id"], kind="campaign").exists())
        self.assertNotIn(
            row["campaign_id"], [found["id"] for found in self.get_as(self.player, "/api/campaigns/").data]
        )
