"""Making a template (blank or a copy), a book template's first save making the campaign's house version, Revert,
deleting, and who may: the editor's routes (the templates plan, phase 4)."""

from apps.campaigns.models import Campaign
from apps.core.models import RevertedVersion
from apps.items.tests.catalogue_support import EDIT
from apps.warband_templates.models import (
    TemplateFighter,
    TemplateFighterList,
    TemplateList,
    TemplateRule,
    WarbandTemplate,
    WarbandTemplateType,
)
from apps.warbands.models import WarbandType

from .editor_support import LIST, EditorTestCase, fighter_body


class MakingTests(EditorTestCase):
    def make(self, **body: object) -> dict:
        response = self.post_as(self.player, LIST, {"campaign_id": self.campaign.id, **body})
        self.assertEqual(response.status_code, 201, response.data)
        answer: dict = response.json()
        return answer

    def test_a_blank_template_serves_the_types_it_is_made_for(self) -> None:
        watch = WarbandType.objects.create(name="Night Watch", slug="night-watch", campaign=self.campaign)
        body = self.make(name="The Night Watch", type_ids=[watch.id])
        template = body["template"]
        self.assertEqual((template["campaign_id"], template["replaces"]), (self.campaign.id, None))
        self.assertEqual([row["name"] for row in template["types"]], ["Night Watch"])
        self.assertEqual(body["facts"], {"source": "custom", "copied_from": None, "warbands": 0})
        self.assertEqual((template["fighters"], template["lists"], template["rules"]), ([], [], []))

    def test_a_copy_has_its_own_rows_and_keys_and_serves_only_its_types(self) -> None:
        watch = WarbandType.objects.create(name="Night Watch", slug="night-watch", campaign=self.campaign)
        body = self.make(name="The Night Watch", copy_of=self.book.id, type_ids=[watch.id])
        copy = WarbandTemplate.objects.get(pk=body["template"]["id"])
        self.assertEqual(
            (copy.campaign_id, copy.replaces_id, copy.copied_from_id), (self.campaign.id, None, self.book.id)
        )
        self.assertEqual(body["facts"]["copied_from"], {"id": self.book.id, "name": "Mercenaries"})
        self.assertEqual(list(copy.type_links.values_list("warband_type_id", flat=True)), [watch.id])
        self.assertEqual(sorted(copy.fighters.values_list("key", flat=True)), ["captain", "warriors"])
        [kit] = copy.lists.all()
        self.assertNotEqual(kit.pk, self.made.kit.pk)
        self.assertEqual(
            set(TemplateFighterList.objects.filter(fighter__template=copy).values_list("equipment_list_id", flat=True)),
            {kit.pk},
        )
        self.assertEqual(TemplateRule.objects.filter(template=copy).count(), 2)
        self.assertEqual(self.book.type_links.count(), 1)  # the book's own rows stay

    def test_a_taken_name_and_another_campaigns_template_are_refused(self) -> None:
        taken = self.post_as(self.player, LIST, {"campaign_id": self.campaign.id, "name": "mercenaries"})
        self.assertEqual((taken.status_code, taken.json()["code"]), (400, "name_taken"))
        other = WarbandTemplate.objects.create(name="Hidden", campaign=self.elsewhere)
        refused = self.post_as(self.player, LIST, {"campaign_id": self.campaign.id, "name": "X", "copy_of": other.id})
        self.assertEqual(refused.status_code, 400)
        mine = WarbandType.objects.create(name="Theirs", slug="theirs", campaign=self.elsewhere)
        refused = self.post_as(self.player, LIST, {"campaign_id": self.campaign.id, "name": "Y", "type_ids": [mine.id]})
        self.assertEqual(refused.status_code, 400)

    def test_making_needs_edit_catalogue_and_a_campaign_that_isnt_archived(self) -> None:
        self.revoke(self.player, EDIT)
        refused = self.post_as(self.player, LIST, {"campaign_id": self.campaign.id, "name": "Night Watch"})
        self.assertEqual(refused.status_code, 403)
        outsider = self.post_as(self.outsider, LIST, {"campaign_id": self.campaign.id, "name": "Night Watch"})
        self.assertEqual(outsider.status_code, 404)
        Campaign.objects.filter(pk=self.campaign.pk).update(archived_at="2026-11-01T00:00:00Z")
        archived = self.post_as(self.owner, LIST, {"campaign_id": self.campaign.id, "name": "Night Watch"})
        self.assertEqual((archived.status_code, archived.json()["code"]), (403, "campaign_archived"))
        self.assertFalse(WarbandTemplate.objects.filter(name="Night Watch").exists())


class HouseVersionTests(EditorTestCase):
    def test_the_first_save_of_a_book_template_makes_the_house_version(self) -> None:
        body = self.saved("fighters/captain/", fighter_body(name="Captain", cost=70, lists=["kit"], max_count=1))
        version = WarbandTemplate.objects.get(pk=body["template"]["id"])
        self.assertEqual((version.campaign_id, version.replaces_id), (self.campaign.id, self.book.id))
        self.assertEqual(body["facts"]["source"], "house")
        self.assertEqual(body["template"]["replaces"], self.book.id)
        self.assertEqual(version.fighters.get(key="captain").cost, 70)
        self.assertEqual(self.book.fighters.get(key="captain").cost, 60)
        self.assertEqual(sorted(version.fighters.values_list("key", flat=True)), ["captain", "warriors"])
        self.assertEqual(
            list(version.type_links.values_list("campaign_id", "warband_type_id")),
            [(self.campaign.id, self.mercenaries.id)],
        )
        again = self.saved("fighters/captain/", fighter_body(name="Captain", cost=75), template=version)
        self.assertEqual(again["template"]["id"], version.pk)
        self.assertEqual(WarbandTemplate.objects.filter(replaces=self.book).count(), 1)

    def test_a_save_naming_the_book_template_again_edits_the_version(self) -> None:
        first = self.saved("fighters/captain/", fighter_body(name="Captain", cost=70))
        second = self.saved("fighters/warriors/", fighter_body(name="Warrior", cost=30))
        self.assertEqual(first["template"]["id"], second["template"]["id"])

    def test_revert_takes_the_house_version_away_and_the_book_serves_again(self) -> None:
        body = self.saved("fighters/captain/", fighter_body(name="Captain", cost=70))
        version_id = body["template"]["id"]
        reverted = self.post_as(self.player, self.at("revert/", template=version_id), {})
        self.assertEqual((reverted.status_code, reverted.json()["id"]), (200, self.book.id))
        self.assertFalse(WarbandTemplate.objects.filter(pk=version_id).exists())
        self.assertFalse(TemplateFighter.objects.filter(template_id=version_id).exists())
        self.assertTrue(RevertedVersion.objects.filter(version_id=version_id, book_id=self.book.id).exists())
        editor = self.get_as(self.player, self.at(f"editor/?campaign_id={self.campaign.id}")).json()
        self.assertEqual((editor["template"]["id"], editor["facts"]["source"]), (self.book.id, "book"))

    def test_the_editor_reads_the_campaigns_house_version_for_the_book_id(self) -> None:
        body = self.saved("fighters/captain/", fighter_body(name="Captain", cost=70))
        editor = self.get_as(self.player, self.at(f"editor/?campaign_id={self.campaign.id}")).json()
        self.assertEqual(editor["template"]["id"], body["template"]["id"])
        no_campaign = self.get_as(self.player, self.at("editor/"))
        self.assertEqual(no_campaign.status_code, 400)

    def test_a_book_template_is_written_for_a_campaign_by_someone_who_can_edit_its_catalogue(self) -> None:
        self.client.force_authenticate(user=self.player)
        no_campaign = self.client.put(self.at("fighters/captain/"), fighter_body(), format="json")
        self.assertEqual(no_campaign.status_code, 403)
        self.revoke(self.player, EDIT)
        refused = self.save("fighters/captain/", fighter_body())
        self.assertEqual(refused.status_code, 403)
        self.assertEqual(self.save("fighters/captain/", fighter_body(), user=self.outsider).status_code, 404)
        self.assertFalse(WarbandTemplate.objects.filter(replaces=self.book).exists())


class DeletingTests(EditorTestCase):
    def own(self, type_ids: list[int]) -> WarbandTemplate:
        template = WarbandTemplate.objects.create(name="Night Watch", campaign=self.campaign)
        WarbandTemplateType.objects.bulk_create(
            WarbandTemplateType(template=template, campaign=self.campaign, warband_type_id=pk) for pk in type_ids
        )
        TemplateList.objects.create(template=template, key="kit", name="Kit")
        return template

    def test_a_campaigns_own_template_no_warband_uses_is_deleted(self) -> None:
        watch = WarbandType.objects.create(name="Night Watch", slug="night-watch", campaign=self.campaign)
        template = self.own([watch.id])
        response = self.delete_as(self.owner, self.at(template=template))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(WarbandTemplate.objects.filter(pk=template.pk).exists())

    def test_one_a_warband_uses_is_archived_and_restored(self) -> None:
        template = self.own([self.mercenaries.id])  # the campaign's own comes first for its Mercenaries warbands
        response = self.delete_as(self.owner, self.at(template=template))
        self.assertEqual((response.status_code, response.json()["outcome"]), (200, "archived"))
        template.refresh_from_db()
        self.assertIsNotNone(template.archived_at)
        restored = self.post_as(self.player, self.at("restore/", template=template), {})
        self.assertEqual(restored.status_code, 200)

    def test_a_house_version_is_reverted_not_deleted(self) -> None:
        version_id = self.saved("fighters/captain/", fighter_body(name="Captain"))["template"]["id"]
        response = self.delete_as(self.owner, self.at(template=version_id))
        self.assertEqual((response.status_code, response.json()["code"]), (409, "use_revert"))
