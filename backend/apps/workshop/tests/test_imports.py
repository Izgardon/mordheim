"""Importing by code (the workshop plan, phase 2): a warband into a campaign, paid in one ledger row; a list into a
campaign's own templates; either into my own workshop. The copy is the roster in its exact state."""

from typing import Any

from django.db.models import Model

from apps.campaigns.models import Campaign, CampaignSettings
from apps.items.models import Item
from apps.special.models import Special
from apps.warband_templates.models import TemplateFighterSpecial, WarbandTemplate
from apps.warband_templates.tests.support import PROFILE
from apps.warbands.models import (
    Henchman,
    HenchmanItemGap,
    HenchmenGroup,
    HenchmenGroupItem,
    HenchmenGroupSkill,
    HenchmenGroupSpecial,
    Hero,
    HeroItem,
    HeroSkill,
    HeroSpecial,
    HeroSpell,
    Hireling,
    HirelingItem,
    HirelingSkill,
    HirelingSpecial,
    HirelingSpell,
    LedgerAction,
    Warband,
    WarbandItem,
    WarbandRule,
    WarbandTrade,
)
from apps.workshop.services.copy_warband import WARBAND_FIELDS, copy_warband

from .support import KIT_COST, WorkshopTestCase, kit_out

SKIPPED = {"id", "created_at", "updated_at", "warband", "hero", "hireling", "henchmen_group", "group", "henchman"}
# each table a warband owns, by its path from the warband
TABLES: tuple[tuple[type[Model], str], ...] = (
    (WarbandItem, "warband"),
    (WarbandRule, "warband"),
    (Hero, "warband"),
    (HeroItem, "hero__warband"),
    (HeroSkill, "hero__warband"),
    (HeroSpecial, "hero__warband"),
    (HeroSpell, "hero__warband"),
    (Hireling, "warband"),
    (HirelingItem, "hireling__warband"),
    (HirelingSkill, "hireling__warband"),
    (HirelingSpecial, "hireling__warband"),
    (HirelingSpell, "hireling__warband"),
    (HenchmenGroup, "warband"),
    (Henchman, "group__warband"),
    (HenchmenGroupItem, "henchmen_group__warband"),
    (HenchmanItemGap, "henchman__group__warband"),
    (HenchmenGroupSkill, "henchmen_group__warband"),
    (HenchmenGroupSpecial, "henchmen_group__warband"),
)
ALIVE = {Hero: True, Hireling: True, HenchmenGroup: True, Henchman: True}


def roster(warband: Warband) -> dict[str, list[dict[str, Any]]]:
    """Every row the warband owns that a copy takes, field by field, without ids and dates (a gap by its member's and
    row's names)."""
    found: dict[str, list[dict[str, Any]]] = {}
    for model, path in TABLES:
        rows = model._default_manager.filter(**{path: warband})
        if model in ALIVE:
            rows = rows.filter(dead=False, dismissed_at__isnull=True)
        if model is WarbandRule:
            rows = rows.filter(from_plot__isnull=True)
        fields = [f.attname for f in model._meta.concrete_fields if f.name not in SKIPPED]
        if model is HenchmanItemGap:
            fields = [*fields, "henchman__name", "group_item__item_id"]
            fields.remove("group_item_id")
        if model in (HeroItem, HeroSkill, HeroSpecial, HeroSpell):
            fields.append("hero__name")
        found[model.__name__] = sorted((dict(row) for row in rows.values(*fields)), key=repr)
    return found


class ImportTestCase(WorkshopTestCase):
    def kitted(self, user: Any = None, **body: Any) -> dict[str, Any]:
        row = self.make_warband_workshop(user=user, template_variant="reikland", **body)
        warband = self.warband_of(row)
        kit: dict[str, Any] = {
            "axe": self.book_axe,
            "sword": self.book_sword,
            "skill": self.infiltration[0],
            "special": self.large,
        }
        kit_out(warband, human=self.human, spell=self.lifestealer[0], **kit)
        Warband.objects.filter(pk=warband.pk).update(backstory="Born in the Reik.", dice_color="#123456", max_units=12)
        warband.counts_as.set([self.mercenaries])
        made: dict[str, Any] = row
        return made

    def import_warband(self, user: Any, code: str, campaign: Campaign | None = None) -> Any:
        return self.post_as(user, self.url("warbands/import/", campaign), {"code": code})


class CampaignWarbandImportTests(ImportTestCase):
    def test_a_warband_arrives_in_its_exact_state_and_pays_its_cost_in_one_row(self) -> None:
        row = self.kitted()
        response = self.import_warband(self.admin, row["share_code"])
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data["gold"], response.data["warnings"]), (500 - KIT_COST, []))
        source, copy = self.warband_of(row), Warband.objects.get(pk=response.data["warband_id"])
        self.assertEqual((copy.campaign_id, copy.user_id), (self.campaign.id, self.admin.id))
        self.assertEqual(
            {name: getattr(copy, name) for name in WARBAND_FIELDS},
            {name: getattr(source, name) for name in WARBAND_FIELDS},
        )
        self.assertEqual(list(copy.counts_as.all()), [self.mercenaries])
        self.assertEqual(roster(copy), roster(source))
        self.assertEqual(copy.heroes.count(), 1)  # the dead hero stayed behind
        ledger = list(
            WarbandTrade.objects.filter(warband=copy).order_by("id").values_list("action", "price", "description")
        )
        self.assertEqual(
            ledger,
            [
                (LedgerAction.STARTING_GOLD, 500, "Starting Gold"),
                (LedgerAction.BUY, -KIT_COST, "Imported The Gilded Wagon"),
            ],
        )
        self.assertEqual(list(copy.resources.values_list("name", "amount")), [("Wyrdstone", 0)])
        self.assertIsNone(response.data["template_id"])  # raised from the book's: no list came

    def test_links_become_the_campaigns_entries_and_warn_what_is_not_in_play(self) -> None:
        row = self.kitted()
        version = Item.objects.create(
            name="Axe", type="Weapon", subtype="Melee", campaign=self.campaign, replaces=self.book_axe
        )
        Item.objects.filter(pk=self.book_sword.pk).update(campaign_type=self.khemri)
        CampaignSettings.objects.filter(campaign=self.campaign).update(starting_gold=100)
        response = self.import_warband(self.admin, row["share_code"])
        self.assertEqual(response.status_code, 201, response.data)
        copy = Warband.objects.get(pk=response.data["warband_id"])
        self.assertEqual(
            list(HeroItem.objects.filter(hero__warband=copy).values_list("item_id", flat=True)), [version.id]
        )
        self.assertEqual(
            [(warning["code"], warning["message"]) for warning in response.data["warnings"]],
            [
                ("not_in_play", "Not in play in this campaign: Sword."),
                ("gold_negative", f"This leaves the warband at {100 - KIT_COST} gc."),
            ],
        )

    def test_refusals(self) -> None:
        row = self.kitted()
        has = self.import_warband(self.player, row["share_code"])
        self.assertEqual((has.status_code, has.data["code"]), (409, "has_warband"))
        self.assertEqual(self.import_warband(self.outsider, row["share_code"]).status_code, 404)  # not a member
        listed = self.make_list_workshop()
        wrong = self.import_warband(self.admin, listed["share_code"])
        self.assertEqual((wrong.status_code, wrong.data["code"]), (400, "not_a_warband"))
        unknown = self.import_warband(self.admin, "QQQQQQQQ")
        self.assertEqual((unknown.status_code, unknown.data["code"]), (404, "code_not_found"))
        workshop = Campaign.objects.get(pk=row["id"])
        into_workshop = self.import_warband(self.player, row["share_code"], workshop)
        self.assertEqual((into_workshop.status_code, into_workshop.data["code"]), (403, "workshop_campaign"))
        self.delete_as(self.player, f"/api/workshop/{row['id']}/")
        self.assertEqual(self.import_warband(self.admin, row["share_code"]).status_code, 404)
        self.assertFalse(Warband.objects.filter(campaign=self.campaign, user=self.admin).exists())

    def test_a_copy_reads_in_a_fixed_number_of_queries_whatever_its_size(self) -> None:
        small = self.warband_of(self.kitted())
        large = self.warband_of(self.kitted(user=self.rival))
        kit: dict[str, Any] = {
            "axe": self.book_axe,
            "sword": self.book_sword,
            "skill": self.infiltration[1],
            "special": self.large,
        }
        for index in range(3):
            kit_out(large, human=self.human, spell=self.lifestealer[1], stash_cost=20 + index, **kit)
        with self.assertNumQueries(COPY_QUERIES):
            copy_warband(small, self.elsewhere.id, self.outsider)
        Warband.objects.filter(campaign=self.elsewhere).delete()
        with self.assertNumQueries(COPY_QUERIES):
            copy_warband(large, self.elsewhere.id, self.outsider)


COPY_QUERIES = 54  # each table read once and written once, each kind of entry resolved once


class ListComesWithItTests(ImportTestCase):
    def test_a_warband_raised_from_a_custom_list_brings_the_list_and_its_own_rules(self) -> None:
        listed = self.make_list_workshop(user=self.rival, name="Watch", copy_of_template_id=self.made.template.id)
        rules = [{"name": "Watchful", "description": "Never surprised."}]
        fighter = {"name": "Sergeant", "kind": "hero", "cost": 35, "race_id": self.human.id, "max_count": 1}
        added = self.post_as(
            self.rival,
            f"/api/warband-templates/{listed['template_id']}/fighters/",
            {**fighter, **PROFILE, "rules": rules},
        )
        self.assertEqual(added.status_code, 201, added.data)
        row = self.kitted(list_code=listed["share_code"])
        workshop_rule = Special.objects.get(campaign_id=row["id"], name="Watchful")
        self.assertEqual(workshop_rule.type, "Warband - Watch")
        HeroSpecial.objects.create(hero=self.warband_of(row).heroes.get(dead=False), special=workshop_rule)
        response = self.import_warband(self.admin, row["share_code"])
        self.assertEqual(response.status_code, 201, response.data)
        template = WarbandTemplate.objects.get(pk=response.data["template_id"])
        self.assertEqual((template.campaign_id, template.name), (self.campaign.id, "Watch"))
        campaign_rule = Special.objects.get(campaign=self.campaign, name="Watchful")
        self.assertEqual(campaign_rule.type, "Warband - Watch")
        links = TemplateFighterSpecial.objects.filter(fighter__template=template, special__name="Watchful")
        self.assertEqual(list(links.values_list("special_id", flat=True)), [campaign_rule.id])
        held = HeroSpecial.objects.filter(hero__warband_id=response.data["warband_id"], special__name="Watchful")
        self.assertEqual(list(held.values_list("special_id", flat=True)), [campaign_rule.id])


class ListImportTests(ImportTestCase):
    def test_a_list_becomes_the_campaigns_own_with_its_own_rules_numbered_when_its_name_is_taken(self) -> None:
        listed = self.make_list_workshop(user=self.outsider, name="Watch", copy_of_template_id=self.made.template.id)
        url = self.url("warband-templates/import/")
        first = self.post_as(self.player, url, {"code": listed["share_code"]})
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(first.data["name"], "Watch")
        second = self.post_as(self.player, url, {"code": listed["share_code"]})
        self.assertEqual(second.data["name"], "Watch (2)")
        template = WarbandTemplate.objects.get(pk=second.data["template_id"])
        self.assertEqual((template.campaign_id, template.copied_from_id), (self.campaign.id, listed["template_id"]))
        self.assertEqual(template.fighters.count(), 2)
        self.revoke(self.rival, "edit_catalogue")
        self.assertEqual(self.post_as(self.rival, url, {"code": listed["share_code"]}).status_code, 403)
        warband_code = self.make_warband_workshop()["share_code"]
        wrong = self.post_as(self.player, url, {"code": warband_code})
        self.assertEqual((wrong.status_code, wrong.data["code"]), (400, "not_a_list"))


class IntoMyWorkshopTests(ImportTestCase):
    def test_a_warband_or_a_list_is_copied_into_a_new_workshop_of_mine(self) -> None:
        row = self.kitted()
        copied = self.post_as(self.outsider, "/api/workshop/import/", {"code": row["share_code"]})
        self.assertEqual(copied.status_code, 201, copied.data)
        self.assertEqual((copied.data["kind"], copied.data["cost"], copied.data["budget"]), ("warband", KIT_COST, 500))
        self.assertNotEqual(copied.data["share_code"], row["share_code"])
        copy = Warband.objects.get(pk=copied.data["warband_id"])
        self.assertEqual(copy.user_id, self.outsider.id)
        self.assertEqual(roster(copy), roster(self.warband_of(row)))
        listed = self.make_list_workshop(copy_of_template_id=self.made.template.id)
        list_copy = self.post_as(self.outsider, "/api/workshop/import/", {"code": listed["share_code"]})
        self.assertEqual((list_copy.status_code, list_copy.data["kind"]), (201, "list"))
        mine = self.get_as(self.outsider, "/api/workshop/").data
        self.assertEqual(
            ([w["id"] for w in mine["warbands"]], [w["id"] for w in mine["lists"]]),
            ([copied.data["id"]], [list_copy.data["id"]]),
        )
