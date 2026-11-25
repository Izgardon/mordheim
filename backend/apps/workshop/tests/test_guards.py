"""What a workshop never does (the workshop plan, phase 1): it is its owner's alone, never joined, played in or
traded from, and its catalogue is the book's but for a list workshop's own list."""

from typing import Any

from apps.campaigns.models import Campaign
from apps.items.tests.catalogue_support import ITEMS
from apps.warband_templates.models import WarbandTemplate
from apps.warband_templates.tests.support import PROFILE

from .support import WorkshopTestCase

WORKSHOP_REFUSED = "workshop_campaign"


class GuardTests(WorkshopTestCase):
    row: dict[str, Any]

    def setUp(self) -> None:
        super().setUp()
        self.row = self.make_warband_workshop()

    def refused(self, response: Any) -> None:
        self.assertEqual(response.status_code, 403, response.data)
        self.assertEqual(response.data["code"], WORKSHOP_REFUSED)

    def test_its_join_code_joins_nothing(self) -> None:
        join_code = Campaign.objects.get(pk=self.row["id"]).join_code
        self.assertEqual(self.join(self.rival, join_code).status_code, 404)

    def test_only_its_owner_reads_it(self) -> None:
        for url in (f"/api/warbands/{self.row['warband_id']}/sheet/", f"/api/campaigns/{self.row['id']}/"):
            self.assertEqual(self.get_as(self.rival, url).status_code, 404)
            self.assertEqual(self.get_as(self.player, url).status_code, 200)

    def test_no_battle_trade_warband_settings_or_scenario_is_written_in_it(self) -> None:
        workshop = f"/api/campaigns/{self.row['id']}/"
        battle = self.post_as(self.player, f"{workshop}battles/", {"participants": [], "scenario": "Skirmish"})
        self.refused(battle)
        self.refused(self.post_as(self.player, f"{workshop}trade-requests/", {"target_user_id": self.rival.id}))
        raised = {"name": "Second", "warband_type_id": self.mercenaries.id, "campaign_id": self.row["id"]}
        self.refused(self.post_as(self.player, "/api/warbands/", raised))
        self.refused(self.patch_as(self.player, workshop, {"name": "Renamed"}))
        self.refused(self.post_as(self.player, f"{workshop}scenarios/random/"))
        self.refused(self.post_as(self.player, f"{workshop}join-code/"))
        self.refused(self.post_as(self.player, f"{workshop}archive/"))

    def test_its_warband_has_no_treasury_and_goes_with_its_workshop(self) -> None:
        warband = f"/api/warbands/{self.row['warband_id']}/"
        self.refused(self.post_as(self.player, f"{warband}trades/", {"action": "Adjustment", "price": 5}))
        self.refused(self.post_as(self.player, f"{warband}resources/", {"name": "Treasure", "amount": 1}))
        self.refused(self.delete_as(self.player, warband))
        self.refused(self.post_as(self.player, f"{warband}hirelings/hire/", {"source": "custom", "name": "Bob"}))

    def test_the_sheet_says_it_is_a_workshops_with_its_cost_budget_and_code(self) -> None:
        sheet = self.get_as(self.player, f"/api/warbands/{self.row['warband_id']}/sheet/").data
        self.assertEqual(sheet["workshop"], {"cost": 0, "budget": 500, "share_code": self.row["share_code"]})
        capabilities = sheet["capabilities"]
        self.assertTrue(capabilities["workshop"] and capabilities["edit"] and capabilities["manage_items"])
        self.assertFalse(capabilities["delete"] or capabilities["trade"] or capabilities["edit_catalogue"])
        campaign_sheet = self.get_as(self.player, f"/api/warbands/{self.warband.id}/sheet/").data
        self.assertIsNone(campaign_sheet["workshop"])
        self.assertFalse(campaign_sheet["capabilities"]["workshop"])
        detail = self.get_as(self.player, f"/api/campaigns/{self.row['id']}/").data
        self.assertFalse(any(detail["capabilities"].values()))

    def test_a_warband_workshop_writes_nothing_in_its_catalogue(self) -> None:
        workshop = Campaign.objects.get(pk=self.row["id"])
        self.refused(self.post_as(self.player, ITEMS.list_url(), ITEMS.body("Lucky Charm", workshop)))
        book_axe = f"{ITEMS.detail_url(self.book_axe.id)}"
        self.refused(self.patch_as(self.player, book_axe, {"campaign_id": workshop.id, "name": "Axe"}))
        listed = self.get_as(self.player, ITEMS.list_url(workshop))
        self.assertEqual(listed.status_code, 200)


class ListWorkshopGuardTests(WorkshopTestCase):
    def test_a_list_workshop_writes_its_own_list_in_the_editor_and_nothing_else(self) -> None:
        row = self.make_list_workshop(copy_of_template_id=self.made.template.id)
        rules = f"/api/warband-templates/{row['template_id']}/rules/"
        body = {"campaign_id": row["id"], "rules": [{"title": "Night Eyes", "description": "Sees in the dark."}]}
        saved = self.put_as(self.player, rules, body)
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual(saved.data["template"]["id"], row["template_id"])
        fighter = {
            "name": "Sergeant",
            "kind": "hero",
            "cost": 35,
            "race_id": self.human.id,
            "max_count": 1,
            **PROFILE,
            "rules": [{"name": "Watchful", "description": "Never surprised."}],
        }
        added = self.post_as(self.player, f"/api/warband-templates/{row['template_id']}/fighters/", fighter)
        self.assertEqual(added.status_code, 201, added.data)  # with a written rule, the list's own special
        book = f"/api/warband-templates/{self.made.template.id}/rules/"
        self.assertEqual(self.put_as(self.player, book, body).status_code, 403)  # never a house version here
        self.assertEqual(WarbandTemplate.objects.filter(campaign_id=row["id"]).count(), 1)
        workshop = Campaign.objects.get(pk=row["id"])
        self.assertEqual(self.post_as(self.player, ITEMS.list_url(), ITEMS.body("Charm", workshop)).status_code, 403)
        made = {"name": "Another", "campaign_id": row["id"]}
        self.assertEqual(self.post_as(self.player, "/api/warband-templates/", made).status_code, 403)
        self.assertEqual(self.put_as(self.rival, rules, body).status_code, 404)
        detail = self.get_as(self.player, f"/api/campaigns/{row['id']}/").data["capabilities"]
        self.assertEqual([name for name, held in detail.items() if held], ["edit_catalogue"])

    def test_a_warband_workshop_refuses_the_editor(self) -> None:
        listed = self.make_list_workshop(copy_of_template_id=self.made.template.id)
        row = self.make_warband_workshop(list_code=listed["share_code"], template_variant="reikland")
        own = WarbandTemplate.objects.get(campaign_id=row["id"])
        body = {"campaign_id": row["id"], "rules": []}
        response = self.put_as(self.player, f"/api/warband-templates/{own.id}/rules/", body)
        self.assertEqual((response.status_code, response.data["code"]), (403, "workshop_campaign"))
