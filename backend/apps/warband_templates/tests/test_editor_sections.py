"""The editor's sections, each saved on its own (the templates plan, phase 4): Basics, Fighters, Lists, Rules and
Upgrades, refusing only what breaks the data (an unknown item, list or fighter, a missing name)."""

from apps.items.tests.catalogue_support import ITEMS, SKILLS, make_entry
from apps.skills.models import Skill
from apps.special.kinds import WARBAND
from apps.special.models import Special
from apps.warband_templates.models import (
    TemplateFighter,
    TemplateListItem,
    TemplateRule,
    TemplateUpgrade,
    WarbandTemplate,
)
from apps.warbands.models import WarbandType

from .editor_support import EditorTestCase, fighter_body

VARIANTS = [{"key": "reikland", "name": "Reikland"}, {"key": "middenheim", "name": "Middenheim"}]


class BasicsTests(EditorTestCase):
    def basics(self, **changes: object) -> dict:
        body = {
            "name": "Mercenaries",
            "setting_id": None,
            "starting_gold": 500,
            "max_models": 15,
            "variants": VARIANTS,
            "types": [{"id": self.mercenaries.id, "variant": "reikland"}],
        }
        return {**body, **changes}

    def test_basics_rename_and_change_the_types_and_terms(self) -> None:
        watch = WarbandType.objects.create(name="Night Watch", slug="night-watch", campaign=self.campaign)
        variants = [{**VARIANTS[0], "starting_gold": 600, "rare_bonus": 1}, VARIANTS[1]]
        body = self.saved(
            "basics/",
            self.basics(
                name="House Mercenaries",
                max_models=12,
                variants=variants,
                types=[{"id": self.mercenaries.id, "variant": "middenheim"}, {"id": watch.id, "variant": ""}],
            ),
        )
        template = body["template"]
        self.assertEqual((template["name"], template["max_models"]), ("House Mercenaries", 12))
        self.assertEqual(
            template["variants"][0], {"key": "reikland", "name": "Reikland", "starting_gold": 600, "rare_bonus": 1}
        )
        self.assertEqual(
            sorted((row["name"], row["variant"]) for row in template["types"]),
            [("Mercenaries", "middenheim"), ("Night Watch", "")],
        )

    def test_basics_saved_with_no_change_make_no_house_version(self) -> None:
        read = self.get_as(self.player, self.at(f"editor/?campaign_id={self.campaign.id}")).json()
        template = read["template"]
        same = {
            "name": template["name"],
            "setting_id": template["setting_id"],
            "starting_gold": template["starting_gold"],
            "max_models": template["max_models"],
            "variants": template["variants"],
            "types": [{"id": row["id"], "variant": row["variant"]} for row in template["types"]],
        }
        self.assertEqual(self.saved("basics/", same), read)
        self.assertFalse(WarbandTemplate.objects.filter(replaces=self.book).exists())
        changed = self.saved("basics/", {**same, "max_models": 12})
        self.assertNotEqual(changed["template"]["id"], self.book.id)
        self.assertEqual(changed["facts"]["source"], "house")

    def test_a_variant_taken_out_takes_its_own_rules_and_lines(self) -> None:
        TemplateListItem.objects.create(equipment_list=self.made.kit, item=self.book_sword, cost=10, variant="reikland")
        self.made.captain.variant_changes = {"reikland": {"skill_types": ["Shooting"]}}
        self.made.captain.save()
        body = self.saved("basics/", self.basics(variants=[VARIANTS[1]], types=[{"id": self.mercenaries.id}]))
        version = WarbandTemplate.objects.get(pk=body["template"]["id"])
        self.assertEqual(
            list(TemplateRule.objects.filter(template=version).values_list("title", flat=True)), ["Hard Bargains"]
        )
        self.assertEqual(TemplateListItem.objects.filter(equipment_list__template=version).count(), 1)
        self.assertEqual(version.fighters.get(key="captain").variant_changes, {})
        self.assertEqual(self.book.rules.count(), 2)

    def test_basics_refuse_broken_data_only(self) -> None:
        for changes in (
            {"name": ""},
            {"variants": [VARIANTS[0], VARIANTS[0]]},
            {"types": [{"id": self.mercenaries.id, "variant": "marienburg"}]},
            {"types": [{"id": 99999}]},
        ):
            with self.subTest(changes=changes):
                self.assertEqual(self.save("basics/", self.basics(**changes)).status_code, 400)
        self.assertFalse(WarbandTemplate.objects.filter(replaces=self.book).exists())


class FighterTests(EditorTestCase):
    def test_a_new_fighter_gets_a_key_unique_in_the_template(self) -> None:
        body = self.saved("fighters/", fighter_body(kind="henchman", name="Warrior", plural="Warriors"), method="post")
        keys = [row["key"] for row in body["template"]["fighters"]]
        self.assertEqual(keys, ["captain", "warriors", "warriors-2"])
        made = next(row for row in body["template"]["fighters"] if row["key"] == "warriors-2")
        self.assertEqual((made["kind"], made["cost"]), ("henchman", 35))

    def test_a_save_writes_the_whole_fighter_as_written_his_lists_and_his_rules(self) -> None:
        body = self.saved(
            "fighters/captain/",
            fighter_body(
                name="Captain",
                race_id=self.human.id,
                attacks="1(2)",
                movement="D6",
                spell_types=[{"name": "Lesser Magic", "note": ""}],
                caster="Wizard",
                is_leader=True,
                lists=["kit"],
                rules=[{"special_id": self.made.rule.id}, {"name": "Lantern Bearer", "description": "Sees far."}],
            ),
        )
        version = WarbandTemplate.objects.get(pk=body["template"]["id"])
        captain = version.fighters.get(key="captain")
        self.assertEqual((captain.attacks, captain.movement), (1, None))
        self.assertEqual(captain.written_stats, {"attacks": "(2)", "movement": "D6"})
        self.assertEqual((captain.race_id, captain.caster, captain.is_leader), (self.human.id, "Wizard", True))
        self.assertEqual([link.equipment_list.key for link in captain.list_links.all()], ["kit"])
        written = Special.objects.get(name="Lantern Bearer")
        self.assertEqual(
            (written.campaign_id, written.type, written.owner_kind, written.category),
            (self.campaign.id, "Warband - Mercenaries", WARBAND, "aura"),  # none picked: the book's rule, an aura
        )
        self.assertEqual(
            list(captain.special_links.values_list("special_id", flat=True)), [self.made.rule.id, written.id]
        )
        refused = self.save("fighters/captain/", fighter_body(rules=[{"name": "Lantern Bearer"}]), template=version)
        self.assertEqual((refused.status_code, refused.json()["code"]), (400, "name_taken"))
        row = next(row for row in body["template"]["fighters"] if row["key"] == "captain")
        self.assertEqual(
            [(rule["name"], rule["category"]) for rule in row["rules"]],
            [("Leader", "aura"), ("Lantern Bearer", "aura")],
        )

    def test_a_save_writes_the_skills_he_starts_with_in_order_as_the_campaigns_current_ones(self) -> None:
        # William, 7 Nov 2026: a fighter starts with a skill as one he'd learned ("yes please do that")
        hunter = make_entry(SKILLS, "Hunter")
        book_sprint = Skill.objects.get(campaign=None, name="Sprint")
        sprint = make_entry(SKILLS, "Sprint", campaign=self.campaign, replaces=book_sprint)
        body = self.saved("fighters/captain/", fighter_body(name="Captain", skill_ids=[book_sprint.id, hunter.id]))
        version = WarbandTemplate.objects.get(pk=body["template"]["id"])
        captain = version.fighters.get(key="captain")
        self.assertEqual([link.skill_id for link in captain.skill_links.all()], [sprint.id, hunter.id])
        row = next(row for row in body["template"]["fighters"] if row["key"] == "captain")
        self.assertEqual([skill["name"] for skill in row["skills"]], ["Sprint", "Hunter"])
        # none sent: he starts with none
        self.saved("fighters/captain/", fighter_body(name="Captain"), template=version)
        self.assertFalse(captain.skill_links.exists())
        elsewhere = make_entry(SKILLS, "Lurk", campaign=self.elsewhere)
        refused = self.save("fighters/captain/", fighter_body(skill_ids=[elsewhere.id]), template=version)
        self.assertEqual(refused.status_code, 400)

    def test_a_profile_read_back_saves_unchanged(self) -> None:
        # the Tilean Hunting Hawk's M12 is written (no number to sum), as the seeding keeps it
        typed = {"movement": "12", "weapon_skill": "4", "attacks": "2(4)"}
        first = self.saved("fighters/captain/", fighter_body(name="Hawk", **typed))
        version = WarbandTemplate.objects.get(pk=first["template"]["id"])
        self.saved("fighters/captain/", fighter_body(name="Hawk", **typed), template=version)

        hawk = version.fighters.get(key="captain")
        self.assertEqual((hawk.movement, hawk.weapon_skill, hawk.attacks), (None, 4, 2))
        self.assertEqual(hawk.written_stats, {"movement": "12", "attacks": "(4)"})

    def test_unknown_lists_keys_and_unordered_counts_are_refused(self) -> None:
        for changes in (
            {"lists": ["nope"]},
            {"min_count": 3, "max_count": 1},
            {"name": ""},
            {"strength": "far too long"},
        ):
            with self.subTest(changes=changes):
                self.assertEqual(self.save("fighters/captain/", fighter_body(**changes)).status_code, 400)
        self.assertEqual(self.save("fighters/nobody/", fighter_body()).status_code, 404)

    def test_taking_a_fighter_out_takes_him_out_of_who_may_take_a_line(self) -> None:
        TemplateListItem.objects.filter(pk=self.made.line.pk).update(who={"fighters": ["warriors"]})
        TemplateUpgrade.objects.filter(template=self.book).update(who={"except": ["warriors"]})
        body = self.saved("fighters/warriors/", {}, method="delete")
        version = WarbandTemplate.objects.get(pk=body["template"]["id"])
        self.assertEqual(list(version.fighters.values_list("key", flat=True)), ["captain"])
        self.assertEqual(TemplateListItem.objects.get(equipment_list__template=version).who, {})
        self.assertEqual(TemplateUpgrade.objects.get(template=version).who, {})


class ListTests(EditorTestCase):
    def line(self, **changes: object) -> dict:
        return {"item_id": self.book_axe.id, "cost": 5, **changes}

    def test_a_list_saves_its_lines_and_who_buys_from_it(self) -> None:
        lantern = make_entry(ITEMS, "Lantern", campaign=self.campaign)
        body = self.saved(
            "lists/kit/",
            {
                "name": "Watch list",
                "note": "",
                "fighters": ["captain"],
                "lines": [
                    {"id": self.made.line.id, **self.line(cost=6, shown_as="Hatchet")},
                    self.line(item_id=lantern.id, cost=10, who={"heroes": True}, warband_max=1),
                ],
            },
        )
        version = WarbandTemplate.objects.get(pk=body["template"]["id"])
        kit = version.lists.get(key="kit")
        lines = list(kit.lines.order_by("position"))
        self.assertEqual([(line.item_id, line.cost) for line in lines], [(self.book_axe.id, 6), (lantern.id, 10)])
        self.assertEqual(lines[1].who, {"heroes": True})
        self.assertEqual(list(kit.fighter_links.values_list("fighter__key", flat=True)), ["captain"])
        line_id = lines[0].pk
        again = self.saved(
            "lists/kit/",
            {"name": "Watch list", "fighters": ["captain"], "lines": [{"id": line_id, **self.line()}]},
            template=version,
        )
        self.assertEqual([line["id"] for line in again["template"]["lists"][0]["lines"]], [line_id])

    def test_a_new_list_and_one_taken_out(self) -> None:
        body = self.saved("lists/", {"name": "Kit list", "fighters": ["warriors"]}, method="post")
        self.assertEqual([row["key"] for row in body["template"]["lists"]], ["kit", "kit-list"])
        version_id = body["template"]["id"]
        after = self.saved("lists/kit/", {}, method="delete", template=version_id)
        self.assertEqual([row["key"] for row in after["template"]["lists"]], ["kit-list"])

    def test_an_unknown_item_or_fighter_is_refused(self) -> None:
        hidden = make_entry(ITEMS, "Hidden", campaign=self.elsewhere)
        for body in (
            {"name": "Kit", "lines": [self.line(item_id=hidden.id)]},
            {"name": "Kit", "fighters": ["nobody"]},
            {"name": "Kit", "lines": [self.line(who={"fighters": ["nobody"]})]},
            {"name": "Kit", "lines": [self.line(variant="marienburg")]},
        ):
            with self.subTest(body=body):
                self.assertEqual(self.save("lists/kit/", body).status_code, 400)


class RulesAndUpgradesTests(EditorTestCase):
    def test_rules_are_saved_whole_for_every_variant_or_one_and_every_type_or_one(self) -> None:
        [first, second] = list(self.book.rules.order_by("position"))
        body = self.saved(
            "rules/",
            {
                "rules": [
                    {"id": second.id, "title": "Marksmen", "description": "+1 BS.", "variant": "reikland"},
                    {"title": "Ostermark", "variant": "", "warband_type_id": self.mercenaries.id},
                ]
            },
        )
        rules = body["template"]["rules"]
        self.assertEqual(
            [(row["title"], row["variant"]) for row in rules], [("Marksmen", "reikland"), ("Ostermark", "")]
        )
        self.assertEqual(rules[1]["warband_type_id"], self.mercenaries.id)
        self.assertNotIn(first.id, [row["id"] for row in rules])
        theirs = WarbandType.objects.create(name="Theirs", slug="theirs", campaign=self.elsewhere)
        refused = self.save("rules/", {"rules": [{"title": "X", "warband_type_id": theirs.id}]})
        self.assertEqual(refused.status_code, 400)

    def test_a_rule_for_a_type_it_doesnt_serve_is_kept_with_a_warning(self) -> None:
        ostermarkers = WarbandType.objects.create(name="Ostermarkers", slug="ostermarkers")
        body = self.saved("rules/", {"rules": [{"title": "Wardog", "warband_type_id": ostermarkers.id}]})
        [rule] = body["template"]["rules"]
        self.assertEqual(rule["warband_type_id"], ostermarkers.id)
        self.assertIn(
            ("rules", str(rule["id"]), "For Ostermarkers, which it doesn't serve: no warband reads it."),
            [(row["section"], row["key"], row["text"]) for row in body["warnings"]],
        )

    def test_upgrades_pick_a_special_or_write_one(self) -> None:
        upgrade = TemplateUpgrade.objects.get(template=self.book)
        body = self.saved(
            "upgrades/",
            {
                "upgrades": [
                    {
                        "id": upgrade.id,
                        "group": "Mutations",
                        "rule": {"special_id": self.made.mutation.id},
                        "cost": 40,
                        "later_double": True,
                        "at_recruit": True,
                        "who": {"fighters": ["captain"]},
                    },
                    {
                        "group": "Mutations",
                        "rule": {"name": "Spines", "description": "Ouch.", "kind": "boon", "category": "mutation"},
                        "cost": None,
                        "cost_note": "see rules",
                        "max_per_fighter": 1,
                    },
                    {"group": "Marks", "rule": {"special_id": self.large.id}, "cost": 0},
                ]
            },
        )
        rows = body["template"]["upgrades"]
        self.assertEqual(
            [(row["name"], row["cost"]) for row in rows], [("Tentacle", 40), ("Spines", None), ("Large", 0)]
        )
        self.assertEqual((rows[0]["who_text"], rows[0]["later_double"]), ("Captain only", True))
        self.assertEqual((rows[0]["special_id"], rows[1]["kind"]), (self.made.mutation.id, "boon"))
        spines = Special.objects.get(name="Spines")
        self.assertEqual(
            (spines.kind, spines.category, spines.owner_kind, spines.campaign_id),
            ("boon", "mutation", WARBAND, self.campaign.id),
        )
        self.assertEqual(rows[1]["category"], "mutation")
        version = WarbandTemplate.objects.get(pk=body["template"]["id"])
        self.assertEqual(TemplateUpgrade.objects.filter(template=version).count(), 3)
        self.assertEqual(TemplateUpgrade.objects.filter(template=self.book).count(), 1)

    def test_an_upgrade_needs_its_rule(self) -> None:
        refused = self.save("upgrades/", {"upgrades": [{"group": "Mutations", "rule": {}, "cost": 5}]})
        self.assertEqual(refused.status_code, 400)
        self.assertFalse(TemplateFighter.objects.exclude(template=self.book).exists())
