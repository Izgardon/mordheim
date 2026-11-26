"""Imports carry custom content (the workshop plan, version 2): a warband or a list copied into a campaign or another
player's workshop brings every entry of its own it uses, linked where the target holds one of the same name and
effect, else copied as the target's own: live for an importer who may edit the target's catalogue, archived for
anyone else. A fixed number of queries whatever the roster's size."""

from typing import Any

from apps.bestiary.models import BestiaryEntrySkill
from apps.campaigns.models import Campaign
from apps.items.models import Item, ItemAvailability, ItemRule, ItemRuleLink
from apps.items.tests.catalogue_support import BESTIARY, ITEMS, RACES, make_entry
from apps.races.models import Race
from apps.skills.models import Skill, SkillGroup, SkillGroupSkill
from apps.special.models import Special
from apps.spells.models import Spell
from apps.warband_templates.models import TemplateFighter, TemplateListItem
from apps.warbands.models import (
    HenchmenGroup,
    HenchmenGroupItem,
    Hero,
    HeroItem,
    HeroSkill,
    HeroSpecial,
    HeroSpell,
    Warband,
    WarbandItem,
)
from apps.workshop.services.copy_warband import copy_warband

from .support import WorkshopTestCase

CUSTOM = ["Ferret", "Ferret", "Gleam", "Halfling", "Lucky Charm", "Nimble", "Pickpocket", "Thieving"]


class ContentTestCase(WorkshopTestCase):
    row: dict[str, Any]
    shop: Campaign

    def setUp(self) -> None:
        super().setUp()
        self.row = self.make_warband(template_variant="reikland")
        self.shop = self.workshop(self.row)
        self.content = self.custom_content(self.shop)
        self.roster(self.warband_of(self.row))

    def custom_content(self, campaign: Campaign) -> dict[str, Any]:
        """One custom entry of every kind a copy carries, in the player's workshop."""
        rule = ItemRule.objects.create(campaign=campaign, name="Lucky", text="Re-roll one dice a game.")
        charm = make_entry(ITEMS, "Lucky Charm", campaign=campaign, type="Misc", subtype="Misc", cost=10)
        ItemRuleLink.objects.create(item=charm, rule=rule)
        skill = Skill.objects.create(campaign=campaign, name="Pickpocket", description="Takes 1D6 gc.")
        group = SkillGroup.objects.create(campaign=campaign, name="Thieving")
        SkillGroupSkill.objects.bulk_create(
            [SkillGroupSkill(group=group, skill=skill), SkillGroupSkill(group=group, skill=self.infiltration[0])]
        )
        ferret = make_entry(BESTIARY, "Ferret", campaign=campaign)
        BestiaryEntrySkill.objects.create(bestiary_entry=ferret, skill=skill)
        twin = Item.objects.create(
            campaign=campaign, name="Ferret", type="Animal", subtype="Animal", bestiary_entry=ferret
        )
        ItemAvailability.objects.create(item=twin, cost=15)
        return {
            "rule": rule,
            "charm": charm,
            "skill": skill,
            "group": group,
            "ferret": ferret,
            "twin": twin,
            "race": make_entry(RACES, "Halfling", campaign=campaign),
            "special": Special.objects.create(campaign=campaign, name="Nimble", type="Trait"),
            "spell": Spell.objects.create(campaign=campaign, name="Gleam", type="Lesser Magic"),
        }

    def roster(self, warband: Warband, heroes: int = 1) -> None:
        """Heroes holding the custom content, a beast group, and the stash: `heroes` of them."""
        content = self.content
        for index in range(heroes):
            hero = Hero.objects.create(
                warband=warband,
                name=f"Pip {index}",
                race=content["race"],
                price=30,
                available_skills={"Thieving": True},
            )
            HeroItem.objects.create(hero=hero, item=content["charm"], cost=10)
            HeroItem.objects.create(hero=hero, item=self.book_axe, cost=5)
            HeroSkill.objects.create(hero=hero, skill=content["skill"])
            HeroSpecial.objects.create(hero=hero, special=content["special"])
            HeroSpell.objects.create(hero=hero, spell=content["spell"])
            group = HenchmenGroup.objects.create(
                warband=warband, name=f"Ferrets {index}", source_beast=content["ferret"]
            )
            HenchmenGroupItem.objects.create(henchmen_group=group, item=content["charm"], cost=10)
        WarbandItem.objects.create(warband=warband, item=content["twin"], cost=15, quantity=1)

    def import_warband(self, user: Any, campaign: Campaign | None = None) -> Any:
        response = self.post_as(user, self.url("warbands/import/", campaign), {"code": self.row["share_code"]})
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def held(self, warband_id: int) -> dict[str, Any]:
        """What the copied roster links, by the entry's model and name."""
        hero = Hero.objects.filter(warband_id=warband_id).select_related("race").first()
        assert hero is not None
        return {
            "race": hero.race,
            "items": {row.item.name: row.item for row in HeroItem.objects.filter(hero=hero).select_related("item")},
            "skill": HeroSkill.objects.select_related("skill").get(hero=hero).skill,
            "special": HeroSpecial.objects.select_related("special").get(hero=hero).special,
            "spell": HeroSpell.objects.select_related("spell").get(hero=hero).spell,
            "beast": HenchmenGroup.objects.select_related("source_beast").get(warband_id=warband_id).source_beast,
            "stash": WarbandItem.objects.select_related("item").get(warband_id=warband_id).item,
            "access": hero.available_skills,
        }


class CarriedTests(ContentTestCase):
    def test_an_editor_brings_every_custom_entry_as_the_campaigns_own(self) -> None:
        answer = self.import_warband(self.admin)
        held = self.held(answer["warband_id"])
        for entry in (held["race"], held["items"]["Lucky Charm"], held["skill"], held["special"], held["spell"]):
            self.assertEqual((entry.campaign_id, entry.archived_at), (self.campaign.id, None), entry)
        self.assertEqual(held["items"]["Axe"].id, self.book_axe.id)  # the book's stays the book's
        beast = held["beast"]
        self.assertEqual((beast.campaign_id, beast.name), (self.campaign.id, "Ferret"))
        self.assertEqual(list(beast.bestiary_entry_skills.values_list("skill_id", flat=True)), [held["skill"].id])
        self.assertEqual((held["stash"].bestiary_entry_id, held["stash"].campaign_id), (beast.id, self.campaign.id))
        group = SkillGroup.objects.get(campaign=self.campaign, name="Thieving")
        skills = set(group.skill_links.values_list("skill_id", flat=True))
        self.assertEqual(skills, {held["skill"].id, self.infiltration[0].id})
        rule = ItemRuleLink.objects.get(item=held["items"]["Lucky Charm"]).rule
        assert rule is not None
        self.assertEqual((rule.campaign_id, rule.name), (self.campaign.id, "Lucky"))
        added = next(found for found in answer["warnings"] if found["code"] == "custom_content_added")
        self.assertEqual(added["names"], sorted(set(CUSTOM)))
        self.assertIn("Lucky Charm", self.listed(self.admin, ITEMS))

    def test_anyone_else_brings_them_archived_for_his_warband_alone(self) -> None:
        self.assertEqual(self.join(self.outsider).status_code, 201)
        self.revoke(self.outsider, "edit_catalogue")
        answer = self.import_warband(self.outsider)
        held = self.held(answer["warband_id"])
        for entry in (held["race"], held["items"]["Lucky Charm"], held["skill"], held["beast"], held["stash"]):
            self.assertEqual(entry.campaign_id, self.campaign.id)
            self.assertIsNotNone(entry.archived_at, entry)
        codes = [found["code"] for found in answer["warnings"]]
        self.assertIn("custom_content_archived", codes)
        self.assertNotIn("Lucky Charm", self.listed(self.admin, ITEMS))

    def test_an_entry_of_the_same_name_and_effect_is_linked_another_copied_under_a_number(self) -> None:
        same = make_entry(ITEMS, "Lucky Charm", campaign=self.campaign, type="Misc", subtype="Misc", cost=10)
        ItemRuleLink.objects.create(item=same, rule=ItemRule.objects.create(campaign=self.campaign, name="Lucky", text="Re-roll one dice a game."))  # fmt: skip
        Race.objects.create(campaign=self.campaign, name="Halfling", movement=5)  # another effect
        held = self.held(self.import_warband(self.admin)["warband_id"])
        self.assertEqual(held["items"]["Lucky Charm"].id, same.id)
        self.assertEqual((held["race"].name, held["race"].campaign_id), ("Halfling (2)", self.campaign.id))

    def test_a_skill_group_copied_under_a_new_name_is_the_one_the_unit_names(self) -> None:
        SkillGroup.objects.create(campaign=self.campaign, name="Thieving", large_only=True)
        held = self.held(self.import_warband(self.admin)["warband_id"])
        self.assertEqual(held["access"], {"Thieving (2)": True})
        copy = SkillGroup.objects.get(campaign=self.campaign, name="Thieving (2)")
        self.assertIn(held["skill"].id, copy.skill_links.values_list("skill_id", flat=True))

    def test_a_skill_group_a_fighters_variant_names_comes_under_its_new_name(self) -> None:
        listed = self.make_list(name="Thieves", copy_of_template_id=self.made.template.id)
        fighters = TemplateFighter.objects.filter(template_id=listed["id"])
        fighters.update(variant_changes={"reikland": {"skill_types": ["Thieving", "Combat"]}})
        SkillGroup.objects.create(campaign=self.campaign, name="Thieving", large_only=True)
        response = self.post_as(self.admin, self.url("warband-templates/import/"), {"code": listed["share_code"]})
        self.assertEqual(response.status_code, 201, response.data)
        copied = TemplateFighter.objects.filter(template_id=response.data["template_id"])
        named = {str(fighter.variant_changes["reikland"]["skill_types"][0]) for fighter in copied}
        self.assertEqual(named, {"Thieving (2)"})
        self.assertTrue(SkillGroup.objects.filter(campaign=self.campaign, name="Thieving (2)").exists())

    def test_a_workshops_version_of_a_book_entry_comes_as_an_entry_of_its_own(self) -> None:
        version = Item.objects.create(
            campaign=self.shop, replaces=self.book_axe, name="Axe", type="Weapon", subtype="Melee", strength="+2"
        )
        HeroItem.objects.filter(hero__warband_id=self.row["id"], item=self.book_axe).update(item=version)
        held = self.held(self.import_warband(self.admin)["warband_id"])
        axe = held["items"]["Axe (2)"]
        self.assertEqual((axe.campaign_id, axe.replaces_id, axe.strength), (self.campaign.id, None, "+2"))

    def test_into_another_players_workshop_the_copies_are_his_own_and_live(self) -> None:
        copied = self.post_as(self.rival, "/api/workshop/import/", {"code": self.row["share_code"]}).data
        held = self.held(copied["id"])
        self.assertEqual((held["race"].campaign_id, held["race"].archived_at), (copied["campaign_id"], None))
        self.assertIn("custom_content_added", [found["code"] for found in copied["warnings"]])
        again = self.post_as(self.rival, "/api/workshop/import/", {"code": self.row["share_code"]}).data
        self.assertEqual(self.held(again["id"])["race"].id, held["race"].id)  # the second copy links the first's
        self.assertNotIn("custom_content_added", [found["code"] for found in again["warnings"]])

    def test_a_list_brings_the_custom_content_its_lines_and_fighters_use(self) -> None:
        listed = self.make_list(name="Thieves", copy_of_template_id=self.made.template.id)
        TemplateListItem.objects.filter(equipment_list__template_id=listed["id"]).update(item=self.content["charm"])
        response = self.post_as(self.admin, self.url("warband-templates/import/"), {"code": listed["share_code"]})
        self.assertEqual(response.status_code, 201, response.data)
        lines = TemplateListItem.objects.filter(equipment_list__template_id=response.data["template_id"])
        charm = Item.objects.get(campaign=self.campaign, name="Lucky Charm")
        self.assertEqual(set(lines.values_list("item_id", flat=True)), {charm.id})

    def test_a_copy_reads_in_a_fixed_number_of_queries_whatever_its_size(self) -> None:
        small = self.warband_of(self.row)
        large = self.warband_of(self.make_warband(name="Large", template_variant="reikland"))
        self.roster(large, heroes=4)
        with self.assertNumQueries(CONTENT_QUERIES):
            copy_warband(small, self.elsewhere, self.outsider)
        with self.assertNumQueries(CONTENT_QUERIES):  # into a campaign holding none of it either
            copy_warband(large, self.campaign, self.admin)


CONTENT_QUERIES = 113  # the roster's tables, and each kind of custom content read, matched, copied and relinked
