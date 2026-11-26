"""A workshop's catalogue (William, 26 Nov 2026): "New + edit own". Its player adds entries of the kinds his units use
and edits or deletes his own; the book's are read only there, it keeps no archive, and the kinds that only matter in a
campaign (scenarios, plots, exploration charts) are never written there."""

from typing import Any

from django.utils import timezone

from apps.exploration.models import ExplorationChart
from apps.items.models import Item
from apps.items.tests.catalogue_support import ITEMS, SKILL_GROUPS, SKILLS
from apps.skills.models import SkillGroupSkill
from apps.warband_templates.models import WarbandTemplate
from apps.warbands.models import Hero, HeroItem

from .support import WorkshopTestCase

BOOK_ENTRY = "workshop_book_entry"
NO_ARCHIVE = "workshop_no_archive"
NOT_HERE = "workshop_campaign"
EDITOR_QUERIES = 13


class WorkshopCatalogueTests(WorkshopTestCase):
    row: dict[str, Any]

    def setUp(self) -> None:
        super().setUp()
        self.row = self.make_warband()
        self.workshop_id = self.row["campaign_id"]

    def refused(self, response: Any, code: str) -> None:
        self.assertEqual(response.status_code, 403, getattr(response, "data", None))
        self.assertEqual(response.data["code"], code)
        self.assertTrue(response.data["detail"])  # in the server's words

    def own_item(self, name: str = "Lucky Charm") -> dict[str, Any]:
        made = self.post_as(self.player, ITEMS.list_url(), ITEMS.body(name, self.workshop(self.row)))
        self.assertEqual(made.status_code, 201, made.data)
        return dict(made.data)

    def test_the_flags_say_no_book_edits_and_no_archive_there_and_yes_in_a_campaign(self) -> None:
        here = self.get_as(self.player, f"/api/campaigns/{self.workshop_id}/").data["capabilities"]
        self.assertEqual((here["edit_catalogue"], here["delete_catalogue"]), (True, True))
        self.assertEqual((here["edit_book_catalogue"], here["archived_catalogue"]), (False, False))
        there = self.get_as(self.owner, f"/api/campaigns/{self.campaign.id}/").data["capabilities"]
        self.assertEqual((there["edit_book_catalogue"], there["archived_catalogue"]), (True, True))

    def test_a_book_entry_is_never_edited_removed_or_reverted_there(self) -> None:
        url = ITEMS.detail_url(self.book_axe.id)
        self.refused(self.patch_as(self.player, url, {"campaign_id": self.workshop_id, "name": "Big Axe"}), BOOK_ENTRY)
        self.refused(self.delete_as(self.player, f"{url}?campaign_id={self.workshop_id}"), BOOK_ENTRY)
        self.refused(self.post_as(self.player, f"{url}revert/", {"campaign_id": self.workshop_id}), BOOK_ENTRY)
        self.assertFalse(Item.objects.filter(campaign_id=self.workshop_id).exists())
        rules = f"/api/warband-templates/{self.made.template.id}/rules/"
        body = {"campaign_id": self.workshop_id, "rules": [{"title": "Night Eyes", "description": "Sees."}]}
        self.refused(self.put_as(self.player, rules, body), BOOK_ENTRY)
        self.assertFalse(WarbandTemplate.objects.filter(campaign_id=self.workshop_id).exists())

    def test_his_own_entry_is_added_edited_and_deleted(self) -> None:
        made = self.own_item()
        url = ITEMS.detail_url(made["id"])
        edited = self.patch_as(self.player, url, {"name": "Luckier Charm"})
        self.assertEqual((edited.status_code, edited.data["name"]), (200, "Luckier Charm"))
        self.assertEqual(self.delete_as(self.player, url).status_code, 204)
        self.assertFalse(Item.objects.filter(pk=made["id"]).exists())

    def test_a_deleted_entry_a_warband_holds_leaves_the_lists_and_stays_on_the_unit(self) -> None:
        made = self.own_item()
        hero = Hero.objects.create(warband_id=self.row["id"], name="Gunther", price=60)
        HeroItem.objects.create(hero=hero, item_id=made["id"], cost=25)
        gone = self.delete_as(self.player, ITEMS.detail_url(made["id"]))
        self.assertEqual(gone.status_code, 200, gone.data)
        self.assertEqual(gone.data["outcome"], "hidden")
        self.assertEqual(gone.data["usage"]["units"], 1)
        self.assertNotIn("Lucky Charm", self.listed(self.player, ITEMS, self.workshop(self.row)))
        self.assertTrue(HeroItem.objects.filter(hero=hero, item_id=made["id"]).exists())
        sheet = self.get_as(self.player, f"/api/warbands/{self.row['id']}/sheet/").data
        self.assertIn("Lucky Charm", str(sheet["heroes"]))

    def test_it_keeps_no_archive_to_list_or_restore_from(self) -> None:
        made = self.own_item()
        Item.objects.filter(pk=made["id"]).update(archived_at=timezone.now())
        self.refused(self.get_as(self.player, f"{ITEMS.list_url(self.workshop_id)}&archived=1"), NO_ARCHIVE)
        self.refused(self.post_as(self.player, f"{ITEMS.detail_url(made['id'])}restore/"), NO_ARCHIVE)
        archive = self.get_as(self.owner, f"{ITEMS.list_url(self.campaign)}&archived=1")
        self.assertEqual(archive.status_code, 200)  # a campaign keeps its archive

    def test_a_skill_joins_his_own_groups_never_a_book_one(self) -> None:
        workshop = self.workshop(self.row)
        joining = self.post_as(
            self.player, SKILLS.list_url(), SKILLS.body("Dodge", workshop, group_ids=[self.combat.id])
        )
        self.refused(joining, BOOK_ENTRY)
        self.assertEqual(joining.data["fields"], {"group_ids": [joining.data["detail"]]})
        group = self.post_as(self.player, SKILL_GROUPS.list_url(), SKILL_GROUPS.body("Watch Skills", workshop))
        self.assertEqual(group.status_code, 201, group.data)
        made = self.post_as(
            self.player, SKILLS.list_url(), SKILLS.body("Dodge", workshop, group_ids=[group.data["id"]])
        )
        self.assertEqual(made.status_code, 201, made.data)
        self.assertTrue(SkillGroupSkill.objects.filter(group_id=group.data["id"], skill_id=made.data["id"]).exists())

    def test_a_name_the_book_holds_is_taken_with_nothing_to_edit_there(self) -> None:
        taken = self.post_as(self.player, ITEMS.list_url(), ITEMS.body("Axe", self.workshop(self.row)))
        self.assertEqual((taken.status_code, taken.data["code"]), (400, "name_taken"))
        match = taken.data["matches"][0]
        self.assertEqual((match["source"], match["editable"], match["restorable"]), ("book", False, False))
        self.assertTrue(taken.data["detail"].endswith("Pick another name."))
        in_campaign = self.post_as(self.owner, ITEMS.list_url(), ITEMS.body("Axe", self.campaign))
        self.assertTrue(in_campaign.data["matches"][0]["editable"])
        self.assertTrue(in_campaign.data["detail"].endswith("Edit it instead."))

    def test_the_campaign_only_kinds_are_never_written_there(self) -> None:
        scenario = {"campaign_id": self.workshop_id, "name": "Ambush"}
        self.refused(self.post_as(self.player, "/api/scenarios/", scenario), NOT_HERE)
        self.refused(
            self.post_as(self.player, "/api/plots/", {"campaign_id": self.workshop_id, "name": "Rise"}), NOT_HERE
        )
        chart = ExplorationChart.objects.create(name="Wasteland", slug="wasteland-test")
        removed = self.delete_as(self.player, f"/api/exploration-charts/{chart.id}/?campaign_id={self.workshop_id}")
        self.refused(removed, NOT_HERE)

    def test_the_editor_names_no_other_list_serving_its_type_there(self) -> None:
        listed = self.make_list(copy_of_template_id=self.made.template.id)
        self.make_list(name="Night Watch Again", copy_of_template_id=self.made.template.id)
        url = f"/api/warband-templates/{listed['id']}/editor/?campaign_id={self.workshop_id}"
        self.client.force_authenticate(user=self.player)
        with self.assertNumQueries(EDITOR_QUERIES):  # the campaign's warnings query is never run there
            editor = self.client.get(url)
        self.assertEqual(editor.status_code, 200, editor.data)
        self.assertFalse([found for found in editor.data["warnings"] if "serves it too" in found["text"]])
