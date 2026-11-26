"""Making, listing, previewing and deleting workshops (the workshop plan, phase 1)."""

from apps.campaigns.models import WORKSHOP, Campaign, CampaignType
from apps.scenarios.models import CampaignScenario
from apps.users.services import deletion
from apps.warband_templates.models import WarbandTemplate
from apps.workshop.services.making import SHARE_CODE_ALPHABET

from .support import WorkshopTestCase

# the workshops, their warbands, their lists with their types, the roster costs and the templates (three)
LIST_QUERIES = 8


class MakingTests(WorkshopTestCase):
    def test_a_warband_workshop_raises_its_warband_from_the_book_template_with_every_setting_ticked(self) -> None:
        row = self.make_warband_workshop(template_variant="reikland")
        workshop = self.workshop(row)
        self.assertEqual((workshop.kind, workshop.holds, workshop.name), (WORKSHOP, "warband", "The Gilded Wagon"))
        self.assertEqual(len(workshop.share_code or ""), 8)
        self.assertTrue(set(workshop.share_code or "") <= set(SHARE_CODE_ALPHABET))
        ticked = set(workshop.campaign_types.values_list("id", flat=True))
        self.assertEqual(ticked, set(CampaignType.objects.values_list("id", flat=True)))
        self.assertFalse(CampaignScenario.objects.filter(campaign=workshop).exists())
        warband = self.warband_of(row)
        self.assertEqual((warband.user_id, warband.gold, warband.template_variant), (self.player.id, 500, "reikland"))
        self.assertEqual(list(warband.rules.values_list("title", flat=True)), ["Hard Bargains", "Marksmen"])
        self.assertEqual(
            {key: row[key] for key in ("kind", "cost", "budget", "share_code", "warnings")},
            {"kind": "warband", "cost": 0, "budget": 500, "share_code": workshop.share_code, "warnings": []},
        )
        self.assertEqual(row["warband_type"], {"id": self.mercenaries.id, "name": "Mercenaries"})

    def test_a_list_workshop_holds_a_blank_list_or_a_copy_of_a_book_one(self) -> None:
        blank = self.make_list_workshop()
        self.assertEqual((blank["kind"], blank["warband_types"]), ("list", []))
        copy = self.make_list_workshop(name="My Caravans", copy_of_template_id=self.made.template.id)
        template = WarbandTemplate.objects.get(pk=copy["template_id"])
        self.assertEqual((template.campaign_id, template.copied_from_id), (copy["id"], self.made.template.id))
        self.assertEqual(
            copy["warband_types"], [{"id": self.mercenaries.id, "name": "Mercenaries", "variant": "reikland"}]
        )
        self.assertEqual(template.fighters.count(), 2)
        refused = self.post_as(self.player, "/api/workshop/lists/", {"name": "X", "copy_of_template_id": 0})
        self.assertEqual(refused.status_code, 400)

    def test_a_lists_preview_carries_its_variants_and_each_types_preset(self) -> None:
        listed = self.make_list_workshop(name="My Caravans", copy_of_template_id=self.made.template.id)
        preview = self.get_as(self.outsider, f"/api/workshop/shared/{listed['share_code']}/").data
        self.assertEqual(
            (preview["warband_types"], preview["variants"]),
            (
                [{"id": self.mercenaries.id, "name": "Mercenaries", "variant": "reikland"}],
                [{"key": "reikland", "name": "Reikland"}, {"key": "middenheim", "name": "Middenheim"}],
            ),
        )

    def test_a_list_workshops_editor_doesnt_warn_that_the_book_serves_its_type_too(self) -> None:
        listed = self.make_list_workshop(name="My Caravans", copy_of_template_id=self.made.template.id)
        editor = self.get_as(self.player, f"/api/warband-templates/{listed['template_id']}/editor/")
        self.assertEqual(editor.status_code, 200, editor.data)
        self.assertFalse([w for w in editor.data["warnings"] if "serves it too" in w["text"]], editor.data["warnings"])

    def test_a_warband_raised_from_a_shared_list_code_uses_a_copy_of_it(self) -> None:
        listed = self.make_list_workshop(user=self.rival, name="Caravans+", copy_of_template_id=self.made.template.id)
        row = self.make_warband_workshop(list_code=listed["share_code"].lower(), warband_type_id=None)
        own = WarbandTemplate.objects.get(campaign_id=row["id"])
        self.assertEqual((own.name, own.copied_from_id), ("Caravans+", listed["template_id"]))
        warband = self.warband_of(row)
        self.assertEqual((warband.warband_type_id, warband.template_variant), (self.mercenaries.id, "reikland"))
        warband_code = self.post_as(
            self.player, "/api/workshop/warbands/", {"name": "X", "list_code": row["share_code"]}
        )
        self.assertEqual((warband_code.status_code, warband_code.data["code"]), (400, "not_a_list"))
        self.assertFalse(Campaign.objects.filter(name="X").exists())  # all or nothing


class ListingTests(WorkshopTestCase):
    def test_my_workshops_are_listed_with_their_cost_and_never_as_campaigns(self) -> None:
        mine = self.make_warband_workshop()
        listed = self.make_list_workshop()
        self.make_warband_workshop(user=self.rival)
        data = self.get_as(self.player, "/api/workshop/").data
        self.assertEqual([row["id"] for row in data["warbands"]], [mine["id"]])
        self.assertEqual([row["id"] for row in data["lists"]], [listed["id"]])
        campaigns = [row["id"] for row in self.get_as(self.player, "/api/campaigns/").data]
        self.assertEqual(campaigns, [self.campaign.id])
        warbands = [row["id"] for row in self.get_as(self.player, "/api/warbands/").data]
        self.assertEqual(warbands, [self.warband.id])
        in_it = self.get_as(self.player, f"/api/warbands/?campaign_id={mine['id']}").data
        self.assertEqual([row["id"] for row in in_it], [mine["warband_id"]])

    def test_the_list_reads_in_a_fixed_number_of_queries(self) -> None:
        self.make_warband_workshop()
        self.make_list_workshop()
        self.client.force_authenticate(user=self.player)
        with self.assertNumQueries(LIST_QUERIES):
            self.client.get("/api/workshop/")
        for index in range(3):
            self.make_warband_workshop(name=f"More {index}")
            self.make_list_workshop(name=f"List {index}")
        self.client.force_authenticate(user=self.player)
        with self.assertNumQueries(LIST_QUERIES):
            self.client.get("/api/workshop/")

    def test_a_code_previews_for_anyone_signed_in(self) -> None:
        row = self.make_warband_workshop()
        preview = self.get_as(self.outsider, f"/api/workshop/shared/{row['share_code']}/").data
        self.assertEqual(
            preview,
            {
                "kind": "warband",
                "share_code": row["share_code"],
                "maker": "Pia",
                "name": "The Gilded Wagon",
                "warband_type": {"id": self.mercenaries.id, "name": "Mercenaries"},
                "cost": 0,
                "budget": 500,
                "heroes": 0,
                "henchmen": 0,
                "hired_swords": 0,
            },
        )
        unknown = self.get_as(self.outsider, "/api/workshop/shared/ZZZZZZZZ/")
        self.assertEqual((unknown.status_code, unknown.data["code"]), (404, "code_not_found"))
        self.client.logout()
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(f"/api/workshop/shared/{row['share_code']}/").status_code, 401)


class DeletingTests(WorkshopTestCase):
    def test_only_its_owner_deletes_it_and_then_it_and_its_code_are_gone(self) -> None:
        row = self.make_warband_workshop()
        self.assertEqual(self.delete_as(self.rival, f"/api/workshop/{row['id']}/").status_code, 404)
        self.assertEqual(self.delete_as(self.player, f"/api/workshop/{self.campaign.id}/").status_code, 404)
        self.assertEqual(self.delete_as(self.player, f"/api/workshop/{row['id']}/").status_code, 204)
        self.assertIsNotNone(self.workshop(row).deleted_at)
        self.assertEqual(self.get_as(self.player, "/api/workshop/").data, {"warbands": [], "lists": []})
        self.assertEqual(self.get_as(self.player, f"/api/workshop/shared/{row['share_code']}/").status_code, 404)
        self.assertEqual(self.get_as(self.player, f"/api/warbands/{row['warband_id']}/sheet/").status_code, 404)
        self.assertEqual(self.get_as(self.player, f"/api/campaigns/{row['id']}/").status_code, 404)


class AccountDeletionTests(WorkshopTestCase):
    def test_deleting_an_account_lists_no_workshop_and_deletes_them_all(self) -> None:
        row = self.make_warband_workshop(user=self.outsider)
        preview = deletion.preview(self.outsider)
        self.assertEqual([campaign["id"] for campaign in preview["campaigns"]], [self.elsewhere.id])
        deletion.delete_account(self.outsider)
        self.assertIsNotNone(self.workshop(row).deleted_at)
        self.assertIsNone(self.workshop(row).archived_at)
