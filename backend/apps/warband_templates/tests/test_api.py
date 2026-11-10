"""`GET warband-templates/` and `GET warband-templates/<id>/` (read only): the book's list, a campaign's with each
template and type in play or not and its house version in place of the book's, one whole template in a fixed number
of queries, and nothing written."""

from typing import Any

from django.db import connection, transaction
from django.test.utils import CaptureQueriesContext

from apps.campaigns.models import CampaignType
from apps.core.catalogue import versions
from apps.core.catalogue.kinds import WARBAND_TEMPLATES
from apps.items.tests.catalogue_support import SKILLS, CatalogueTestCase, make_entry
from apps.skills.models import Skill
from apps.warband_templates.models import (
    TemplateFighter,
    TemplateFighterList,
    TemplateFighterSkill,
    TemplateListItem,
    TemplateUpgrade,
    WarbandTemplate,
    WarbandTemplateType,
)
from apps.warbands.models import WarbandType

from .support import PROFILE, Made, make_template

LIST = "/api/warband-templates/"


class WarbandTemplateApiTests(CatalogueTestCase):
    made: Made
    khemri: CampaignType
    hunter: Skill

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.made = make_template("Mercenaries", item=cls.book_axe, race=cls.human, warband_type=cls.mercenaries)
        cls.khemri = CampaignType.objects.create(slug="khemri", name="Khemri", grade="1b")
        ostermarkers = WarbandType.objects.create(name="Ostermarkers", slug="ostermarkers", campaign_type=cls.khemri)
        WarbandTemplateType.objects.create(template=cls.made.template, warband_type=ostermarkers)
        cls.hunter = make_entry(SKILLS, "Hunter", description="Reloads.")
        TemplateFighterSkill.objects.create(fighter=cls.made.captain, skill=cls.hunter)  # he starts with it

    def get(self, url: str, user: Any = None) -> Any:
        self.client.force_authenticate(user=user or self.player)
        return self.client.get(url)

    def test_the_book_list_carries_each_template_and_the_types_it_serves(self) -> None:
        response = self.get(LIST)
        self.assertEqual(response.status_code, 200)
        [row] = response.json()
        self.assertEqual(
            (row["name"], row["gold"], row["most_warriors"], row["in_play"]), ("Mercenaries", 500, 15, None)
        )
        self.assertEqual(
            [(entry["name"], entry["variant"]) for entry in row["types"]],
            [
                ("Mercenaries", "reikland"),
                ("Ostermarkers", ""),
            ],
        )

    def test_a_campaigns_list_says_which_types_are_in_play_there(self) -> None:
        [row] = self.get(f"{LIST}?campaign_id={self.campaign.id}").json()
        self.assertTrue(row["in_play"])
        self.assertEqual(
            {entry["name"]: entry["in_play"] for entry in row["types"]},
            {
                "Mercenaries": True,
                "Ostermarkers": False,
            },
        )

    def test_a_campaigns_house_version_stands_in_for_the_books(self) -> None:
        with transaction.atomic():
            version = versions.editable(WARBAND_TEMPLATES, self.made.template, self.campaign.id)
        WarbandTemplate.objects.filter(pk=version.pk).update(starting_gold=600)
        [row] = self.get(f"{LIST}?campaign_id={self.campaign.id}").json()
        self.assertEqual((row["id"], row["replaces"], row["gold"]), (version.pk, self.made.template.pk, 600))
        self.assertEqual([entry["name"] for entry in row["types"]], ["Mercenaries", "Ostermarkers"])

    def test_an_outsider_reads_no_campaigns_list_and_writes_nothing(self) -> None:
        self.assertEqual(self.get(f"{LIST}?campaign_id={self.campaign.id}", self.outsider).status_code, 404)
        self.client.force_authenticate(user=self.outsider)
        body = {"campaign_id": self.campaign.id, "name": "Night Watch"}
        self.assertEqual(self.client.post(LIST, body, format="json").status_code, 404)
        self.client.force_authenticate(user=self.owner)
        detail = f"{LIST}{self.made.template.id}/?campaign_id={self.campaign.id}"
        self.assertEqual(self.client.patch(detail, body, format="json").status_code, 405)  # the editor's routes write

    def test_a_template_reads_whole(self) -> None:
        TemplateUpgrade.objects.filter(template=self.made.template).update(who={"fighters": ["warriors"]})
        body = self.get(f"{LIST}{self.made.template.id}/").json()
        self.assertEqual(
            [(rule["title"], rule["variant"]) for rule in body["rules"]],
            [
                ("Hard Bargains", ""),
                ("Marksmen", "reikland"),
            ],
        )
        [kit] = body["lists"]
        self.assertEqual(
            (kit["key"], kit["lines"][0]["item"]["name"], kit["lines"][0]["shown_as"]), ("kit", "Axe", "Hatchet")
        )
        captain = body["fighters"][0]
        self.assertEqual((captain["key"], captain["race"], captain["lists"]), ("captain", "Human", ["kit"]))
        self.assertEqual([rule["name"] for rule in captain["rules"]], ["Leader"])
        self.assertEqual(captain["skills"], [{"id": self.hunter.id, "name": "Hunter", "description": "Reloads."}])
        self.assertEqual((body["upgrades"][0]["name"], body["upgrades"][0]["who_text"]), ("Tentacle", "Warriors only"))

    def test_a_skill_a_variant_gives_him_carries_its_rules(self) -> None:
        ride = make_entry(SKILLS, "Ride [Animal]", description="Rides the animal.")
        TemplateFighter.objects.filter(pk=self.made.captain.pk).update(
            variant_changes={"middenheim": {"skill_types": ["Combat"], "skills": [{"id": ride.id, "name": ride.name}]}}
        )
        captain = self.get(f"{LIST}{self.made.template.id}/").json()["fighters"][0]
        self.assertEqual(
            captain["variant_changes"],
            {
                "middenheim": {
                    "skill_types": ["Combat"],
                    "skills": [{"id": ride.id, "name": "Ride [Animal]", "description": "Rides the animal."}],
                }
            },
        )

    def test_who_may_take_a_line_is_the_servers_wording(self) -> None:
        # the templates plan, phase 3: one wording, plural names, as the hire screens read it
        TemplateListItem.objects.filter(pk=self.made.line.pk).update(who={"heroes": True, "fighters": ["warriors"]})
        body = self.get(f"{LIST}{self.made.template.id}/").json()
        self.assertEqual(body["lists"][0]["lines"][0]["who_text"], "Heroes and Warriors only")

    def test_a_template_reads_in_the_same_queries_however_many_fighters_it_has(self) -> None:
        def count() -> int:
            self.client.force_authenticate(user=self.player)
            with CaptureQueriesContext(connection) as captured:
                response = self.client.get(f"{LIST}{self.made.template.id}/")
            self.assertEqual(response.status_code, 200)
            return len(captured)

        few = count()
        for number in range(3):
            fighter = TemplateFighter.objects.create(
                template=self.made.template,
                key=f"extra-{number}",
                kind="henchman",
                name="Extra",
                race=self.human,
                **PROFILE,
            )
            TemplateFighterList.objects.create(fighter=fighter, equipment_list=self.made.kit)
            fighter.special_links.create(special=self.made.rule)
            fighter.skill_links.create(skill=self.hunter)
        self.assertEqual((few, count()), (10, 10))  # the template, then one query for each kind of its rows

    def test_a_campaigns_list_reads_in_the_same_queries_however_many_templates_it_holds(self) -> None:
        def count() -> int:
            self.client.force_authenticate(user=self.player)
            with CaptureQueriesContext(connection) as captured:
                response = self.client.get(f"{LIST}?campaign_id={self.campaign.id}")
            self.assertEqual(response.status_code, 200)
            return len(captured)

        few = count()
        for name in ("Skaven", "Undead"):
            served = WarbandType.objects.create(name=name, slug=name.lower())
            make_template(name, item=self.book_axe, race=self.human, warband_type=served)
        self.assertEqual(
            (few, count()), (3, 3)
        )  # the membership with the catalogue version, the templates, their types

    def test_the_search_view_carries_what_each_template_holds_by_name(self) -> None:
        # Search everything finds a warband type by its fighters, rules and skills (William, 8 Nov 2026: "the
        # reference search doesnt search warbands yet")
        rule = self.made.template.rules.get(title="Marksmen")
        rule.warband_type = self.mercenaries
        rule.save()
        TemplateFighter.objects.filter(pk=self.made.captain.pk).update(skill_types=["Combat", "Mercenaries"])
        [row] = self.get(f"{LIST}?campaign_id={self.campaign.id}&view=search").json()
        self.assertEqual([entry["name"] for entry in row["types"]], ["Mercenaries", "Ostermarkers"])
        self.assertEqual(
            row["contents"],
            {
                "fighters": [
                    {
                        "name": "Captain",
                        "plural": "",
                        "kind": "hero",
                        "skill_types": ["Combat", "Mercenaries"],
                        "rules": ["Leader"],
                        "skills": ["Hunter"],
                    },
                    {
                        "name": "Warrior",
                        "plural": "Warriors",
                        "kind": "henchman",
                        "skill_types": [],
                        "rules": [],
                        "skills": [],
                    },
                ],
                "rules": [
                    {"title": "Hard Bargains", "warband_type_id": None},
                    {"title": "Marksmen", "warband_type_id": self.mercenaries.id},
                ],
                "upgrades": ["Tentacle"],
            },
        )
        [plain] = self.get(f"{LIST}?campaign_id={self.campaign.id}").json()
        self.assertNotIn("contents", plain)  # the Warbands page's rows stay as they were

    def test_the_search_view_reads_in_the_same_queries_however_many_templates_it_holds(self) -> None:
        def count() -> int:
            self.client.force_authenticate(user=self.player)
            with CaptureQueriesContext(connection) as captured:
                response = self.client.get(f"{LIST}?campaign_id={self.campaign.id}&view=search")
            self.assertEqual(response.status_code, 200)
            return len(captured)

        few = count()
        for name in ("Skaven", "Undead"):
            served = WarbandType.objects.create(name=name, slug=name.lower())
            made = make_template(name, item=self.book_axe, race=self.human, warband_type=served)
            made.warriors.skill_links.create(skill=self.hunter)
        # the membership with the catalogue version, the templates, their types, rules, fighters, the fighters'
        # rules and skills, and the upgrades
        self.assertEqual((few, count()), (8, 8))
