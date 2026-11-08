"""`GET warbands/<id>/template/` (the warband's template as the hire screens read it) and `GET campaigns/<id>/
warband-types/<type>/template/` (the raise screen's outline): the variant applied, what the warband has of each
fighter, who each line is for, the free dagger, the copies held of a limited item, the rules it lacks, list prices,
and a fixed number of queries whatever the roster or the template holds."""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.battles.models import Battle
from apps.campaigns.models import CampaignSettings
from apps.items.tests.catalogue_support import ITEMS, CatalogueTestCase, make_entry
from apps.skills.models import Skill
from apps.warband_templates.models import (
    HENCHMAN,
    TemplateFighter,
    TemplateFighterList,
    TemplateListItem,
    TemplateUpgrade,
)
from apps.warbands.models import Henchman, HenchmenGroup, HenchmenGroupItem, Hero, HeroItem, WarbandItem, WarbandRule

from .support import PROFILE, Made, make_template


class WarbandTemplateEndpointTests(CatalogueTestCase):
    made: Made
    dagger: Any
    endpoint: str

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.made = make_template("Mercenaries", item=cls.book_axe, race=cls.human, warband_type=cls.mercenaries)
        cls.dagger = make_entry(ITEMS, "Dagger", cost=2)
        TemplateListItem.objects.create(equipment_list=cls.made.kit, item=cls.dagger, cost=2, first_free=True)
        TemplateListItem.objects.create(
            equipment_list=cls.made.kit, item=cls.book_sword, cost=10, who={"heroes": True}, warband_max=2
        )
        cls.made.captain.variant_changes = {"middenheim": {"skill_types": ["Combat", "Strength"]}}
        cls.made.captain.skill_types = ["Combat", "Shooting"]
        cls.made.captain.save()
        cls.endpoint = f"/api/warbands/{cls.warband.id}/template/"

    def read(self, user: Any = None) -> dict[str, Any]:
        response = self.get_as(user or self.player, self.endpoint)
        self.assertEqual(response.status_code, 200, response.data)
        body: dict[str, Any] = response.json()
        return body

    def fighter(self, body: dict[str, Any], key: str) -> dict[str, Any]:
        return next(row for row in body["template"]["fighters"] if row["key"] == key)

    def test_the_variant_is_the_types_preset_until_the_warband_picks_one(self) -> None:
        body = self.read()
        self.assertEqual((body["variant"], body["list_prices_open"]), ("reikland", True))
        self.assertEqual([rule["title"] for rule in body["template"]["rules"]], ["Hard Bargains", "Marksmen"])
        self.warband.template_variant = "middenheim"
        self.warband.save()
        body = self.read()
        self.assertEqual([rule["title"] for rule in body["template"]["rules"]], ["Hard Bargains"])
        self.assertEqual(self.fighter(body, "captain")["skill_types"], ["Combat", "Strength"])

    def test_each_fighter_says_what_the_warband_has_of_him(self) -> None:
        Hero.objects.create(warband=self.warband, name="Ulrich", fighter_key="captain")
        Hero.objects.create(warband=self.warband, name="Gone", fighter_key="captain", dead=True)
        Hero.objects.create(warband=self.warband, name="Typed", unit_type="Captain")
        for size in (3, 2):
            group = HenchmenGroup.objects.create(warband=self.warband, name="Lads", fighter_key="warriors")
            Henchman.objects.bulk_create([Henchman(group=group, name=f"Lad {n}") for n in range(size)])
        first = Henchman.objects.filter(group__warband=self.warband).order_by("id").first()
        assert first is not None
        Henchman.objects.filter(pk=first.pk).update(dead=True)
        body = self.read()
        self.assertEqual(self.fighter(body, "captain")["have"], {"count": 1, "groups": 0})
        self.assertEqual(self.fighter(body, "warriors")["have"], {"count": 4, "groups": 2})

    def test_lines_say_who_they_are_for_the_free_dagger_and_what_a_limited_item_holds(self) -> None:
        hero = Hero.objects.create(warband=self.warband, name="Ulrich")
        HeroItem.objects.create(hero=hero, item=self.book_sword)
        group = HenchmenGroup.objects.create(warband=self.warband, name="Lads")
        Henchman.objects.bulk_create([Henchman(group=group, name=f"Lad {n}") for n in range(2)])
        HenchmenGroupItem.objects.create(henchmen_group=group, item=self.book_sword)
        WarbandItem.objects.create(warband=self.warband, item=self.book_sword, quantity=3)
        body = self.read()
        lines = {line["item"]["name"]: line for line in body["template"]["lists"][0]["lines"]}
        self.assertEqual((lines["Sword"]["who_text"], lines["Sword"]["held"]), ("Heroes only", 6))
        self.assertEqual((lines["Axe"]["who_text"], lines["Axe"]["held"]), ("", None))
        warriors = self.fighter(body, "warriors")
        self.assertEqual(warriors["off_lines"], [lines["Sword"]["id"]])
        self.assertEqual(self.fighter(body, "captain")["off_lines"], [])
        self.assertEqual(warriors["free_items"], [{"id": self.dagger.id, "name": "Dagger"}])

    def test_upgrades_say_their_later_price_and_who_they_are_for(self) -> None:
        TemplateUpgrade.objects.filter(template=self.made.template).update(
            who={"fighters": ["captain"]}, later_double=True, max_per_fighter=2, at_recruit=True
        )
        body = self.read()
        [upgrade] = body["template"]["upgrades"]
        self.assertEqual(
            {key: upgrade[key] for key in ("name", "group", "special_id", "cost", "later_cost", "who_text")},
            {
                "name": "Tentacle",
                "group": "Mutations",
                "special_id": self.made.mutation.id,
                "cost": 35,
                "later_cost": 70,
                "who_text": "Captain only",
            },
        )
        self.assertEqual((upgrade["max_per_fighter"], upgrade["at_recruit"]), (2, True))
        self.assertEqual(self.fighter(body, "warriors")["off_upgrades"], [upgrade["id"]])
        self.assertEqual(self.fighter(body, "captain")["off_upgrades"], [])

    def test_a_line_for_one_variant_is_read_only_by_that_variant(self) -> None:
        bow = make_entry(ITEMS, "Bow", cost=10)
        line = TemplateListItem.objects.create(
            equipment_list=self.made.kit, item=bow, cost=10, warband_max=1, variant="middenheim"
        )
        names = [row["item"]["name"] for row in self.read()["template"]["lists"][0]["lines"]]
        self.assertNotIn("Bow", names)
        self.warband.template_variant = "middenheim"
        self.warband.save()
        lines = {row["item"]["name"]: row for row in self.read()["template"]["lists"][0]["lines"]}
        self.assertEqual((lines["Bow"]["id"], lines["Bow"]["held"]), (line.id, 0))

    def test_it_counts_the_rules_the_warband_lacks_and_closes_list_prices_after_the_first_fight(self) -> None:
        WarbandRule.objects.create(warband=self.warband, title=" hard bargains ")
        body = self.read()
        self.assertEqual(body["template"]["missing_rules"], 1)
        self.open_battle(status=Battle.STATUS_POSTBATTLE)
        self.assertFalse(self.read()["list_prices_open"])

    def test_a_warband_whose_type_has_no_template_reads_none_and_outsiders_nothing(self) -> None:
        body = self.get_as(self.rival, f"/api/warbands/{self.rival_warband.id}/template/").json()
        self.assertEqual(body["template"]["name"], "Mercenaries")  # Rats are Mercenaries too
        self.made.template.type_links.all().delete()
        self.assertEqual(self.read(), {"template": None, "variant": "", "list_prices_open": True})
        self.assertEqual(self.get_as(self.outsider, self.endpoint).status_code, 404)

    def test_it_reads_in_the_same_queries_however_big_the_roster_and_the_template(self) -> None:
        def count() -> int:
            self.client.force_authenticate(user=self.player)
            with CaptureQueriesContext(connection) as captured:
                self.assertEqual(self.client.get(self.endpoint).status_code, 200)
            return len(captured)

        few = count()
        for number in range(3):
            fighter = TemplateFighter.objects.create(
                template=self.made.template, key=f"extra-{number}", kind=HENCHMAN, name="Extra", **PROFILE
            )
            TemplateFighterList.objects.create(fighter=fighter, equipment_list=self.made.kit)
            fighter.special_links.create(special=self.made.rule)
            fighter.skill_links.create(skill=Skill.objects.get(campaign=None, name="Sprint"))
            hero = Hero.objects.create(warband=self.warband, name=f"Hero {number}", fighter_key="captain")
            HeroItem.objects.create(hero=hero, item=self.book_sword)
            group = HenchmenGroup.objects.create(warband=self.warband, name=f"Group {number}", fighter_key=fighter.key)
            Henchman.objects.create(group=group, name="Lad")
            WarbandRule.objects.create(warband=self.warband, title=f"Rule {number}")
        # the warband and membership, list prices, the template, its rules, lists, lines, fighters, their rules,
        # starting skills and lists, its upgrades, the heroes and groups by fighter, the limited items held, the
        # warband's rule titles
        self.assertEqual((few, count()), (16, 16))


class RaiseOutlineTests(CatalogueTestCase):
    made: Made

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        cls.made = make_template(
            "Merchant Caravans", item=cls.book_axe, race=cls.human, warband_type=cls.mercenaries, max_models=12
        )
        cls.made.template.starting_gold = 600
        cls.made.template.save()

    def outline(self, type_id: int, query: str = "") -> dict[str, Any]:
        response = self.get_as(self.player, self.url(f"warband-types/{type_id}/template/{query}"))
        self.assertEqual(response.status_code, 200, response.data)
        body: dict[str, Any] = response.json()
        return body

    def test_the_gold_is_the_campaigns_plus_the_templates_difference_from_500(self) -> None:
        CampaignSettings.objects.filter(campaign=self.campaign).update(starting_gold=450)
        body = self.outline(self.mercenaries.id)
        self.assertEqual((body["gold"], body["most_warriors"]), (550, 12))
        outline = body["template"]
        self.assertEqual(
            (outline["name"], outline["preset_variant"], outline["variant"]),
            ("Merchant Caravans", "reikland", "reikland"),
        )
        self.assertEqual([row["key"] for row in outline["fighters"]], ["captain", "warriors"])
        self.assertEqual([rule["title"] for rule in outline["rules"]], ["Hard Bargains", "Marksmen"])

    def test_a_type_that_presets_no_variant_reads_the_one_asked(self) -> None:
        self.made.template.type_links.update(variant="")
        self.assertEqual(self.outline(self.mercenaries.id)["template"]["variant"], "")
        picked = self.outline(self.mercenaries.id, "?variant=middenheim")["template"]
        self.assertEqual(
            (picked["variant"], [rule["title"] for rule in picked["rules"]]), ("middenheim", ["Hard Bargains"])
        )
        self.assertEqual(self.outline(self.mercenaries.id, "?variant=nowhere")["template"]["variant"], "")

    def test_a_type_without_a_template_reads_the_campaigns_gold_and_outsiders_nothing(self) -> None:
        self.made.template.type_links.all().delete()
        self.assertEqual(
            self.outline(self.mercenaries.id),
            {"template": None, "gold": 500, "campaign_gold": 500, "most_warriors": 15},
        )
        url = self.url(f"warband-types/{self.mercenaries.id}/template/")
        self.assertEqual(self.get_as(self.outsider, url).status_code, 404)
