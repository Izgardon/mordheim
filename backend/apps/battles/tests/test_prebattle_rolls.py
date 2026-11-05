"""The pre-battle step's rolls (William, 5 Nov 2026): in the battle rosters each skill and special with a pre-battle
roll carries its dice and text, and each item its shared rules' (battles/services/rosters.py), read with the rest at
no extra query. Prebattle shows them under the unit and nothing applies them."""

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.items.models import ItemRule, ItemRuleLink
from apps.skills.models import Skill
from apps.special.models import Special
from apps.warbands.models import Henchman, HenchmenGroup, Hero, Hireling

from .battle_support import BattleTestCase, catalogue_item

WOUND = "The warrior survives, but on a 1 on a D6 at the start of any battle he can't fight."


class PrebattleRollsRosterTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.wound = Special.objects.create(
            name="Old Battle Wound", type="Injury", prebattle_roll="D6", prebattle_text=WOUND
        )
        self.spy = Skill.objects.create(name="Spy", prebattle_roll="D3", prebattle_text="Re-deploy D3 models.")
        self.grin = ItemRule.objects.create(name="Grin", prebattle_roll="D6", prebattle_text="On a 1, stupid.")
        self.mask = catalogue_item("Jester Mask", 20)
        ItemRuleLink.objects.create(item=self.mask, position=0, name="Its own", text="No roll here.")
        ItemRuleLink.objects.create(item=self.mask, position=1, rule=self.grin)
        self.hero = Hero.objects.create(warband=self.warband, name="Gunther", unit_type="Champion")
        self.hero.hero_specials.create(special=self.wound)
        self.hero.hero_specials.create(special=self.specials[0])  # no roll
        self.hero.hero_skills.create(skill=self.spy)
        self.hero.hero_items.create(item=self.mask, cost=20)
        self.hero.hero_items.create(item=self.sword, cost=10)  # Parry: no roll
        self.sword_for_hire = Hireling.objects.create(warband=self.warband, name="Ogre", unit_type="Ogre")
        self.sword_for_hire.hireling_specials.create(special=self.wound)
        self.group = HenchmenGroup.objects.create(warband=self.warband, name="Lads", unit_type="Warrior")
        self.group.henchmen_group_specials.create(special=self.wound)
        self.group.henchmen_group_items.create(item=self.mask, cost=20)
        for n in range(2):
            Henchman.objects.create(group=self.group, name=f"Lad {n}")

    def roster(self, battle_id: int) -> dict:
        return dict(self.ok(self.get_as(self.viewer, self.url(battle_id, "rosters"))).data[str(self.player.id)])

    def test_a_units_rules_with_a_roll_carry_its_dice_and_text_and_the_rest_nothing(self):
        roster = self.roster(self.to_prebattle())
        hero = next(unit for unit in roster["heroes"] if unit["id"] == self.hero.id)
        wound = {"id": self.wound.id, "name": "Old Battle Wound", "prebattleRoll": "D6", "prebattleText": WOUND}
        self.assertEqual(hero["specials"], [wound, {"id": self.specials[0].id, "name": "Special 0"}])
        self.assertEqual(
            hero["skills"],
            [{"id": self.spy.id, "name": "Spy", "prebattleRoll": "D3", "prebattleText": "Re-deploy D3 models."}],
        )
        mask = next(item for item in hero["items"] if item["id"] == self.mask.id)
        self.assertEqual(mask["prebattleRolls"], [{"rule": "Grin", "roll": "D6", "text": "On a 1, stupid."}])
        sword = next(item for item in hero["items"] if item["id"] == self.sword.id)
        self.assertNotIn("prebattleRolls", sword)
        self.assertEqual(roster["hirelings"][0]["specials"], [wound])
        group = next(group for group in roster["henchmenGroups"] if group["id"] == self.group.id)
        for member in group["members"]:
            self.assertEqual(member["specials"], [wound])
            self.assertEqual([item.get("prebattleRolls") for item in member["items"]], [mask["prebattleRolls"]])

    def test_the_snapshot_keeps_them(self):
        battle_id = self.to_active({self.player: [f"hero:{self.hero.id}"], self.viewer: []})
        self.wound.prebattle_roll = ""
        self.wound.save(update_fields=["prebattle_roll"])  # a later change to the rule leaves the started battle
        hero = self.roster(battle_id)["heroes"][0]
        self.assertEqual(hero["specials"][0]["prebattleRoll"], "D6")

    def test_the_rolls_cost_no_query(self):
        battle_id = self.to_prebattle()
        self.roster(battle_id)  # the first read in a minute also writes presence

        def count() -> int:
            with CaptureQueriesContext(connection) as captured:
                self.roster(battle_id)
            return len(captured)

        with_rolls = count()
        Special.objects.update(prebattle_roll="")
        Skill.objects.update(prebattle_roll="")
        ItemRule.objects.update(prebattle_roll="")
        self.assertEqual(count(), with_rolls)
