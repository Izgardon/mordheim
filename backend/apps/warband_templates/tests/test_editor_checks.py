"""The editor's warnings, how many warbands use a template, what its types can usually buy, sharing (a campaign's
template is what every warband of its types hires from next, and nothing on a roster changes), and the editor's
query counts (the templates plan, phase 4)."""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.campaigns.models import CampaignSettings
from apps.warband_templates.models import TemplateFighter, TemplateFighterList, WarbandTemplate, WarbandTemplateType
from apps.warbands.models import Hero

from .editor_support import EditorTestCase, fighter_body
from .support import PROFILE


class WarningTests(EditorTestCase):
    def editor(self, template: WarbandTemplate | int | None = None) -> dict[str, Any]:
        response = self.get_as(self.player, f"{self.at('editor/', template=template)}?campaign_id={self.campaign.id}")
        self.assertEqual(response.status_code, 200, response.data)
        body: dict[str, Any] = response.json()
        return body

    def texts(self, body: dict[str, Any]) -> list[tuple[str, str, str]]:
        return [(row["section"], row["key"], row["text"]) for row in body["warnings"]]

    def test_no_leader_no_kit_and_a_list_nobody_buys_from(self) -> None:
        TemplateFighter.objects.filter(pk=self.made.captain.pk).update(max_count=1)
        TemplateFighterList.objects.filter(fighter=self.made.warriors).delete()
        body = self.editor()
        self.assertEqual(
            self.texts(body),
            [
                ("fighters", "", "No fighter is the leader."),
                ("fighters", "warriors", 'No list and no fixed kit: say "None" if they carry nothing.'),
            ],
        )
        TemplateFighter.objects.filter(pk=self.made.captain.pk).update(is_leader=True, fixed_kit="None")
        TemplateFighter.objects.filter(pk=self.made.warriors.pk).update(fixed_kit="None")
        TemplateFighterList.objects.filter(fighter=self.made.captain).delete()
        self.assertEqual(self.texts(self.editor()), [("lists", "kit", "Nobody buys from it.")])

    def test_heroes_over_the_campaigns_hero_cap(self) -> None:
        TemplateFighter.objects.filter(pk=self.made.captain.pk).update(is_leader=True, max_count=1)
        CampaignSettings.objects.filter(campaign=self.campaign).update(max_heroes=2)
        TemplateFighter.objects.create(
            template=self.book, key="champions", kind="hero", name="Champion", max_count=2, **PROFILE
        )
        self.assertIn(("fighters", "", "Up to 3 heroes; the campaign allows 2."), self.texts(self.editor()))
        TemplateFighter.objects.filter(key="champions").update(max_count=None)
        self.assertIn(
            ("fighters", "", "Champion has no most; the campaign allows 2 heroes."), self.texts(self.editor())
        )

    def test_a_type_two_templates_serve_and_one_that_serves_none(self) -> None:
        own = WarbandTemplate.objects.create(name="Night Watch", campaign=self.campaign)
        self.assertEqual(
            self.texts(self.editor(own)), [("basics", "", "It serves no warband type, so no warband uses it.")]
        )
        WarbandTemplateType.objects.create(template=own, campaign=self.campaign, warband_type=self.mercenaries)
        self.assertIn(
            ("basics", "", "Mercenaries: the book's Mercenaries serves them too; this one comes first."),
            self.texts(self.editor(own)),
        )
        self.assertIn(
            (
                "basics",
                "",
                "Mercenaries: Night Watch serves them too and comes first, so this one isn't used for them.",
            ),
            self.texts(self.editor()),
        )


class UsersAndWhoCanTests(EditorTestCase):
    def facts(self, template: WarbandTemplate | int | None = None) -> dict[str, Any]:
        url = f"{self.at('editor/', template=template)}?campaign_id={self.campaign.id}"
        facts: dict[str, Any] = self.get_as(self.player, url).json()["facts"]
        return facts

    def test_a_template_is_used_by_the_warbands_it_comes_first_for(self) -> None:
        self.assertEqual(self.facts()["warbands"], 2)  # Monks and Rats are Mercenaries
        own = WarbandTemplate.objects.create(name="Night Watch", campaign=self.campaign)
        WarbandTemplateType.objects.create(template=own, campaign=self.campaign, warband_type=self.mercenaries)
        self.assertEqual((self.facts()["warbands"], self.facts(own)["warbands"]), (0, 2))

    def test_who_can_says_what_its_types_cant_usually_buy(self) -> None:
        # the Sword's price row names the Mercenaries; the Axe's names nobody and isn't for everyone
        url = f"{self.at('who-can/')}?campaign_id={self.campaign.id}"
        offers = {row["item_id"]: row for row in self.get_as(self.player, url).json()["items"]}
        self.assertTrue(offers[self.book_sword.id]["can_buy"])
        self.assertEqual(
            (offers[self.book_axe.id]["can_buy"], offers[self.book_axe.id]["reason"]),
            (False, "Not usually available to Mercenaries."),
        )


class SharingTests(EditorTestCase):
    def test_new_recruits_follow_the_house_version_and_units_on_rosters_stay(self) -> None:
        hero = Hero.objects.create(warband=self.warband, name="Ulrich", fighter_key="captain", price=60)
        self.saved("fighters/captain/", fighter_body(name="Captain", cost=80, lists=["kit"]))
        body = self.get_as(self.player, f"/api/warbands/{self.warband.id}/template/").json()
        captain = next(row for row in body["template"]["fighters"] if row["key"] == "captain")
        self.assertEqual((captain["cost"], captain["have"]["count"]), (80, 1))
        hero.refresh_from_db()
        self.assertEqual(hero.price, 60)


class EditorQueryTests(EditorTestCase):
    def count(self, url: str, method: str = "get", body: dict[str, Any] | None = None) -> int:
        self.client.force_authenticate(user=self.player)
        with CaptureQueriesContext(connection) as captured:
            response = getattr(self.client, method)(url, body, format="json")
        self.assertIn(response.status_code, (200, 201), getattr(response, "data", None))
        return len(captured)

    def grow(self, template: Any = None) -> None:
        for number in range(3):
            fighter = TemplateFighter.objects.create(
                template_id=template or self.book.pk, key=f"extra-{number}", kind="henchman", name="Extra", **PROFILE
            )
            fighter.list_links.create(equipment_list=fighter.template.lists.get())
            fighter.special_links.create(special=self.made.rule)

    def test_the_editor_reads_in_the_same_queries_however_much_the_template_holds(self) -> None:
        url = f"{self.at('editor/')}?campaign_id={self.campaign.id}"
        few = self.count(url)
        self.grow()
        self.assertEqual((few, self.count(url)), (14, 14))

    def test_a_section_save_takes_the_same_queries_however_much_the_template_holds(self) -> None:
        version_id = self.saved("fighters/captain/", fighter_body(name="Captain"))["template"]["id"]
        url = self.at("fighters/captain/", template=version_id)
        body = {"campaign_id": self.campaign.id, **fighter_body(name="Captain", lists=["kit"])}
        few = self.count(url, "put", body)
        self.grow(version_id)
        self.assertEqual(few, self.count(url, "put", body))
