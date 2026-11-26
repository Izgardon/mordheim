"""A player's workshop (the workshop plan, version 2): made on first use, one each, holding many warbands and lists,
each with its own code; listed, previewed and deleted."""

from django.db import IntegrityError

from apps.campaigns.models import WORKSHOP, Campaign, CampaignCampaignType
from apps.core.share_codes import SHARE_CODE_ALPHABET
from apps.core.testing import book_warband_type
from apps.items.models import Item
from apps.items.tests.catalogue_support import ITEMS
from apps.scenarios.models import CampaignScenario
from apps.users.services import deletion
from apps.warband_templates.models import WarbandTemplate
from apps.warbands.models import Warband

from .support import WorkshopTestCase

# the workshop, its warbands, their costs and their named lists, its lists and their types
LIST_QUERIES = 7


class MakingTests(WorkshopTestCase):
    def test_a_first_warband_makes_the_workshop_and_the_next_one_shares_it(self) -> None:
        self.assertEqual(self.get_as(self.player, "/api/workshop/").data, {"id": None, "warbands": [], "lists": []})
        first = self.make_warband(template_variant="reikland")
        workshop = self.workshop(first)
        self.assertEqual((workshop.kind, workshop.workshop_owner_id), (WORKSHOP, self.player.id))
        self.assertFalse(CampaignCampaignType.objects.filter(campaign=workshop).exists())  # computed, never stored
        self.assertFalse(CampaignScenario.objects.filter(campaign=workshop).exists())
        second = self.make_warband(name="The Second Wagon", template_variant="middenheim")
        self.assertEqual(second["campaign_id"], workshop.pk)
        self.assertEqual(Campaign.objects.filter(kind=WORKSHOP).count(), 1)
        warband = self.warband_of(first)
        self.assertEqual((warband.user_id, warband.gold, warband.template_variant), (self.player.id, 500, "reikland"))
        self.assertEqual((warband.in_workshop, warband.template_id), (True, self.made.template.id))
        self.assertEqual(list(warband.rules.values_list("title", flat=True)), ["Hard Bargains", "Marksmen"])
        picked = ("kind", "cost", "budget", "template_id", "warnings")
        self.assertEqual(
            {key: first[key] for key in picked},
            {"kind": "warband", "cost": 0, "budget": 500, "template_id": self.made.template.id, "warnings": []},
        )
        self.assertEqual(len({first["share_code"], second["share_code"]}), 2)
        self.assertTrue(set(first["share_code"]) <= set(SHARE_CODE_ALPHABET) and len(first["share_code"]) == 8)

    def test_my_workshop_is_made_on_its_own_for_my_content_and_only_once(self) -> None:
        made = self.post_as(self.player, "/api/workshop/")
        self.assertEqual(made.status_code, 200, made.data)
        self.assertEqual((made.data["warbands"], made.data["lists"]), ([], []))
        self.assertEqual(self.post_as(self.player, "/api/workshop/").data["id"], made.data["id"])
        self.assertEqual(self.make_warband()["campaign_id"], made.data["id"])

    def test_one_live_workshop_each(self) -> None:
        self.make_warband()
        with self.assertRaises(IntegrityError):
            Campaign.objects.create(name="Again", join_code="QQQQQQ", kind=WORKSHOP, workshop_owner=self.player)

    def test_every_setting_is_in_play_in_a_workshop(self) -> None:
        row = self.make_warband()
        Item.objects.filter(pk=self.book_sword.pk).update(campaign_type=self.khemri)
        rows = self.get_as(self.player, ITEMS.list_url(row["campaign_id"])).json()
        self.assertTrue(all(item["in_play"] for item in rows))
        in_campaign = self.get_as(self.player, ITEMS.list_url(self.campaign)).json()
        self.assertFalse(next(item for item in in_campaign if item["name"] == "Sword")["in_play"])
        types = self.get_as(self.player, f"/api/campaigns/{row['campaign_id']}/warband-types/").json()
        self.assertTrue(all(found["in_play"] for found in types))

    def test_a_list_is_blank_or_a_copy_of_the_books_or_one_of_mine_each_with_a_code(self) -> None:
        blank = self.make_list()
        self.assertEqual((blank["kind"], blank["warband_types"]), ("list", []))
        copy = self.make_list(name="My Caravans", copy_of_template_id=self.made.template.id)
        template = WarbandTemplate.objects.get(pk=copy["id"])
        self.assertEqual((template.campaign_id, template.copied_from_id), (blank["campaign_id"], self.made.template.id))
        self.assertEqual(
            copy["warband_types"], [{"id": self.mercenaries.id, "name": "Mercenaries", "variant": "reikland"}]
        )
        self.assertEqual(template.fighters.count(), 2)
        again = self.make_list(name="My Caravans Again", copy_of_template_id=copy["id"])
        self.assertEqual(WarbandTemplate.objects.get(pk=again["id"]).copied_from_id, copy["id"])
        self.assertEqual(len({blank["share_code"], copy["share_code"], again["share_code"]}), 3)
        taken = self.post_as(self.player, "/api/workshop/lists/", {"name": "My Caravans"})
        self.assertEqual((taken.status_code, taken.data["code"]), (400, "name_taken"))
        rivals = self.make_list(user=self.rival, name="Rival List")
        foreign = self.post_as(self.player, "/api/workshop/lists/", {"name": "X", "copy_of_template_id": rivals["id"]})
        self.assertEqual(foreign.status_code, 400)

    def test_the_template_editors_make_a_template_gives_a_workshop_list_its_code(self) -> None:
        row = self.make_warband()
        made = self.post_as(
            self.player, "/api/warband-templates/", {"name": "Wolves", "campaign_id": row["campaign_id"]}
        )
        self.assertEqual(made.status_code, 201, made.data)
        self.assertEqual(len(WarbandTemplate.objects.get(pk=made.data["template"]["id"]).share_code or ""), 8)

    def test_a_warband_raised_from_one_of_my_lists_names_it_and_one_raised_by_type_the_books(self) -> None:
        self.make_list(name="Caravans A", copy_of_template_id=self.made.template.id)
        second = self.make_list(name="Caravans B", copy_of_template_id=self.made.template.id)
        WarbandTemplate.objects.filter(pk=second["id"]).update(starting_gold=700)
        row = self.make_warband(list_id=second["id"], warband_type_id=None)
        warband = self.warband_of(row)
        self.assertEqual((warband.template_id, warband.warband_type_id), (second["id"], self.mercenaries.id))
        self.assertEqual((row["budget"], warband.gold), (700, 700))
        sheet = self.get_as(self.player, f"/api/warbands/{row['id']}/template/").data
        self.assertEqual(sheet["template"]["id"], second["id"])
        # William, 26 Nov 2026: a type uses the book's list, never one of mine ("One of my lists" is how I use those)
        by_type = self.make_warband(name="By type", template_variant="reikland")
        self.assertEqual(by_type["template_id"], self.made.template.id)
        outline = self.get_as(
            self.player, f"/api/campaigns/{row['campaign_id']}/warband-types/{self.mercenaries.id}/template/"
        )
        self.assertEqual(outline.data["template"]["id"], self.made.template.id)
        rivals = self.make_list(user=self.rival, name="Rival List")
        foreign = self.post_as(self.player, "/api/workshop/warbands/", {"name": "X", "list_id": rivals["id"]})
        self.assertEqual(foreign.status_code, 400)

    def test_a_shared_list_code_copies_the_list_in_unless_it_is_mine(self) -> None:
        listed = self.make_list(user=self.rival, name="Caravans+", copy_of_template_id=self.made.template.id)
        row = self.make_warband(list_code=listed["share_code"].lower(), warband_type_id=None)
        own = WarbandTemplate.objects.get(pk=row["template_id"])
        self.assertEqual(
            (own.campaign_id, own.name, own.copied_from_id), (row["campaign_id"], "Caravans+", listed["id"])
        )
        self.assertNotEqual(own.share_code, listed["share_code"])
        warband = self.warband_of(row)
        self.assertEqual((warband.warband_type_id, warband.template_variant), (self.mercenaries.id, "reikland"))
        again = self.make_warband(name="Again", list_code=own.share_code, warband_type_id=None)
        self.assertEqual(again["template_id"], own.pk)  # my own list's code: no copy
        warband_code = self.post_as(
            self.player, "/api/workshop/warbands/", {"name": "X", "list_code": row["share_code"]}
        )
        self.assertEqual((warband_code.status_code, warband_code.data["code"]), (400, "not_a_list"))
        self.assertFalse(Warband.objects.filter(name="X").exists())
        blank = self.make_list(name="Blank")
        none = self.post_as(self.player, "/api/workshop/warbands/", {"name": "X", "list_id": blank["id"]})
        self.assertEqual((none.status_code, none.data["code"]), (400, "list_serves_no_type"))

    def test_a_new_type_in_settings_keeps_my_list_serving_it_else_reads_the_books(self) -> None:
        outlaws = book_warband_type("Outlaws")
        both = [self.mercenaries.id, outlaws.id]
        listed = self.make_list(name="Caravans B", copy_of_template_id=self.made.template.id, warband_type_ids=both)
        row = self.make_warband(list_id=listed["id"], template_variant="reikland")
        to_outlaws = {"warband_type_id": outlaws.id, "template_variant": "reikland"}
        changed = self.patch_as(self.player, f"/api/warbands/{row['id']}/", to_outlaws)
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(self.warband_of(row).template_id, listed["id"])  # the list it named serves it too
        by_type = self.make_warband(name="By type", template_variant="reikland")
        moved = self.patch_as(self.player, f"/api/warbands/{by_type['id']}/", {"warband_type_id": outlaws.id})
        self.assertEqual(moved.status_code, 200, moved.data)
        self.assertIsNone(self.warband_of(by_type).template_id)  # the book has none for it; my list is never picked
        back = self.patch_as(self.player, f"/api/warbands/{by_type['id']}/", {"warband_type_id": self.mercenaries.id})
        self.assertEqual(back.status_code, 200, back.data)
        self.assertEqual(self.warband_of(by_type).template_id, self.made.template.id)


class ListingTests(WorkshopTestCase):
    def test_my_workshop_lists_its_warbands_and_lists_and_never_shows_as_a_campaign(self) -> None:
        mine = self.make_warband()
        listed = self.make_list()
        self.make_warband(user=self.rival)
        data = self.get_as(self.player, "/api/workshop/").data
        self.assertEqual(data["id"], mine["campaign_id"])
        self.assertEqual([row["id"] for row in data["warbands"]], [mine["id"]])
        self.assertEqual([row["id"] for row in data["lists"]], [listed["id"]])
        campaigns = [row["id"] for row in self.get_as(self.player, "/api/campaigns/").data]
        self.assertEqual(campaigns, [self.campaign.id])
        warbands = [row["id"] for row in self.get_as(self.player, "/api/warbands/").data]
        self.assertEqual(warbands, [self.warband.id])
        in_it = self.get_as(self.player, f"/api/warbands/?campaign_id={mine['campaign_id']}").data
        self.assertEqual([row["id"] for row in in_it], [mine["id"]])

    def test_the_list_reads_in_a_fixed_number_of_queries(self) -> None:
        self.make_warband()
        self.make_list()
        self.client.force_authenticate(user=self.player)
        with self.assertNumQueries(LIST_QUERIES):
            self.client.get("/api/workshop/")
        for index in range(3):
            self.make_warband(name=f"More {index}")
            self.make_list(name=f"List {index}", copy_of_template_id=self.made.template.id)
        self.client.force_authenticate(user=self.player)
        with self.assertNumQueries(LIST_QUERIES):
            self.client.get("/api/workshop/")
        self.client.force_authenticate(user=self.rival)
        with self.assertNumQueries(1):  # no workshop yet
            self.client.get("/api/workshop/")

    def test_a_code_previews_for_anyone_signed_in(self) -> None:
        row = self.make_warband()
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
        listed = self.make_list(name="My Caravans", copy_of_template_id=self.made.template.id)
        shown = self.get_as(self.outsider, f"/api/workshop/shared/{listed['share_code']}/").data
        self.assertEqual((shown["kind"], shown["maker"], shown["name"]), ("list", "Pia", "My Caravans"))
        self.assertEqual(
            (shown["warband_types"], shown["variants"]),
            (
                [{"id": self.mercenaries.id, "name": "Mercenaries", "variant": "reikland"}],
                [{"key": "reikland", "name": "Reikland"}, {"key": "middenheim", "name": "Middenheim"}],
            ),
        )
        unknown = self.get_as(self.outsider, "/api/workshop/shared/ZZZZZZZZ/")
        self.assertEqual((unknown.status_code, unknown.data["code"]), (404, "code_not_found"))
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(f"/api/workshop/shared/{row['share_code']}/").status_code, 401)


class DeletingTests(WorkshopTestCase):
    def test_a_deleted_warband_is_gone_with_its_code_and_its_copies_stay(self) -> None:
        row = self.make_warband()
        copy = self.post_as(self.rival, "/api/workshop/import/", {"code": row["share_code"]}).data
        self.assertEqual(self.delete_as(self.rival, f"/api/warbands/{row['id']}/").status_code, 404)
        self.assertEqual(self.delete_as(self.player, f"/api/warbands/{row['id']}/").status_code, 204)
        warband = Warband.objects.get(pk=row["id"])
        self.assertIsNotNone(warband.deleted_at)
        self.assertEqual(warband.share_code, row["share_code"])  # never given out again
        self.assertEqual(self.get_as(self.player, "/api/workshop/").data["warbands"], [])
        self.assertEqual(self.get_as(self.player, f"/api/workshop/shared/{row['share_code']}/").status_code, 404)
        self.assertEqual(self.get_as(self.player, f"/api/warbands/{row['id']}/sheet/").status_code, 404)
        self.assertEqual(self.get_as(self.rival, f"/api/warbands/{copy['id']}/sheet/").status_code, 200)

    def test_a_deleted_list_is_gone_with_its_code_archived_while_a_warband_reads_it(self) -> None:
        used = self.make_list(name="Used", copy_of_template_id=self.made.template.id)
        unused = self.make_list(name="Unused", copy_of_template_id=self.made.template.id)
        row = self.make_warband(list_id=used["id"])
        query = f"?campaign_id={used['campaign_id']}"
        self.assertEqual(self.delete_as(self.player, f"/api/warband-templates/{unused['id']}/{query}").status_code, 204)
        self.assertFalse(WarbandTemplate.objects.filter(pk=unused["id"]).exists())
        archived = self.delete_as(self.player, f"/api/warband-templates/{used['id']}/{query}")
        self.assertIn(archived.status_code, (200, 204), archived.data)
        self.assertIsNotNone(WarbandTemplate.objects.get(pk=used["id"]).archived_at)
        self.assertEqual(self.get_as(self.player, "/api/workshop/").data["lists"], [])
        self.assertEqual(self.get_as(self.player, f"/api/workshop/shared/{used['share_code']}/").status_code, 404)
        sheet = self.get_as(self.player, f"/api/warbands/{row['id']}/template/").data
        self.assertEqual(sheet["template"]["id"], used["id"])  # the warband keeps reading it


class AccountDeletionTests(WorkshopTestCase):
    def test_deleting_an_account_lists_no_workshop_and_deletes_it(self) -> None:
        row = self.make_warband(user=self.outsider)
        listed = self.make_list(user=self.outsider)
        preview = deletion.preview(self.outsider)
        self.assertEqual([campaign["id"] for campaign in preview["campaigns"]], [self.elsewhere.id])
        deletion.delete_account(self.outsider)
        self.assertIsNotNone(self.workshop(row).deleted_at)
        self.assertIsNone(self.workshop(row).archived_at)
        for code in (row["share_code"], listed["share_code"]):
            self.assertEqual(self.get_as(self.player, f"/api/workshop/shared/{code}/").status_code, 404)
