"""Postbattle for hirelings (the bestiary rewrite step 2): each follows its own injury table, a dramatis persona is
suggested no XP, one who stays for one battle is suggested to leave, and an upkeep that isn't gold is a reminder.

A hireling on the hero table rolls the campaign's hero death roll and takes the hero results' effects, as heroes do;
one on the henchman table rolls a d6. The battle roster, taken at start, says which table each hireling rolls on, to
the page and to the check alike, so a table changed on the sheet mid-battle applies from the next battle.
The leaving suggestion is never forced: finalise keeps the unit, and the page may dismiss it.
"""

from typing import Any

from apps.warbands.models import Hireling

from .battle_support import BattleTestCase, draft, unit_result


def roll(rolls: list[int], roll_type: str = "d66") -> dict[str, Any]:
    return {"roll_type": roll_type, "rolls": rolls, "result_label": "what the page showed"}


class HirelingPostbattleTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        hire = self.warband.hirelings.create
        self.grukk = hire(name="Grukk", unit_type="Ogre Bodyguard", upkeep_price=30)
        self.persona = hire(
            name="Bertha",
            unit_type="Bertha",
            kind="dramatis_persona",
            injury_table="hero",
            no_level_ups=True,
            stays="one_battle",
            payment_note="a favour",
            initiative=4,
            toughness=3,
        )
        self.prospector = hire(name="Pete", unit_type="Old Prospector", upkeep_cost_expression="1 Treasure")
        self.keys = [f"hireling:{unit.id}" for unit in (self.grukk, self.persona, self.prospector)]
        self.rat = f"hero:{self.rival.heroes.create(name='Rat', unit_type='Assassin').id}"

    def results(self, **rolls: list[dict[str, Any]]) -> dict[str, Any]:
        by_key = dict(zip(("sword", "persona", "prospector"), self.keys, strict=True))
        return {key: unit_result(key, rolls=rolls.get(name)) for name, key in by_key.items()}

    def postbattle(self) -> int:
        return self.to_postbattle({self.player: self.keys, self.viewer: [self.rat]}, winners=[self.warband])

    def test_each_hireling_rolls_on_its_own_table_and_takes_its_effects(self):
        battle_id = self.postbattle()
        results = self.results(persona=[roll([3, 2])], sword=[roll([1], "d6")])  # Nervous Condition; a 1: dead

        self.ok(self.finalize(self.player, battle_id, draft(results)))

        self.persona.refresh_from_db()
        self.grukk.refresh_from_db()
        self.assertEqual((self.persona.initiative, self.persona.dead), (3, False))
        self.assertTrue(self.grukk.dead)

    def test_a_roll_on_the_wrong_table_is_refused(self):
        battle_id = self.postbattle()
        cases = (
            (self.results(persona=[roll([2], "d6")]), "hireling serious_injury_rolls must use d66"),
            (self.results(sword=[roll([3, 2])]), "hireling serious_injury_rolls must use d6"),
        )
        for results, message in cases:
            with self.subTest(message=message):
                response = self.post_as(self.player, self.url(battle_id, "postbattle"), {"postbattle_json": draft(results)})  # fmt: skip
                self.assertEqual(response.status_code, 400)
                self.assertIn(message, str(response.data))

    def test_the_hero_table_is_the_campaigns_hero_death_roll(self):
        self.campaign_settings.hero_death_roll = "d100"
        self.campaign_settings.save()
        battle_id = self.postbattle()

        self.ok(self.finalize(self.player, battle_id, draft(self.results(persona=[roll([30], "d100")]))))  # Chest Wound

        self.persona.refresh_from_db()
        self.assertEqual(self.persona.toughness, 2)

    def test_suggestions_give_a_dramatis_persona_no_xp_say_who_leaves_and_carry_upkeep_formulas(self):
        battle_id = self.postbattle()

        suggested = self.ok(self.get_as(self.player, self.url(battle_id, "state") + "?view=postbattle")).data
        suggested = suggested["suggested_postbattle"]

        sword, persona, prospector = self.keys
        self.assertEqual(suggested["unit_results"][persona]["reasons"], [{"label": "dramatis persona", "xp": 0}])
        self.assertEqual(suggested["unit_results"][persona]["xp_earned"], 0)
        self.assertEqual(suggested["unit_results"][sword]["xp_earned"], 1)
        self.assertEqual(suggested["dismiss"], {"entries": {persona: {"unit_name": "Bertha", "reason": "stays_one_battle"}}})  # fmt: skip
        upkeep = suggested["upkeep"]["entries"]
        self.assertNotIn(persona, upkeep)  # he leaves after this battle: nothing to keep him on for
        self.assertEqual(upkeep[sword], {"unit_name": "Grukk", "cost": 30})  # no formula: none sent
        self.assertEqual(upkeep[prospector], {"unit_name": "Pete", "cost": 0, "cost_expression": "1 Treasure"})

    def test_leaving_is_only_a_suggestion(self):
        battle_id = self.postbattle()

        self.ok(self.finalize(self.player, battle_id, draft(self.results())))

        self.persona.refresh_from_db()
        self.assertIsNone(self.persona.dismissed_at)

    def test_the_battle_roster_says_each_hirelings_kind_table_stay_and_payment(self):
        battle_id = self.postbattle()

        roster = self.ok(self.get_as(self.player, self.url(battle_id, "rosters"))).data[str(self.player.id)]

        entry = next(unit for unit in roster["hirelings"] if unit["key"] == self.keys[1])
        kept = {key: entry[key] for key in ("hirelingKind", "injuryTable", "stays", "paymentNote")}
        self.assertEqual(kept, {"hirelingKind": "dramatis_persona", "injuryTable": "hero", "stays": "one_battle", "paymentNote": "a favour"})  # fmt: skip

    def test_a_table_changed_on_the_sheet_mid_battle_applies_from_the_next_battle(self):
        battle_id = self.postbattle()
        Hireling.objects.filter(id=self.persona.id).update(injury_table="henchman")  # a house rule, mid-battle

        self.ok(self.finalize(self.player, battle_id, draft(self.results(persona=[roll([3, 2])]))))

        self.persona.refresh_from_db()
        self.assertEqual(self.persona.initiative, 3)  # the hero table's Nervous Condition, as the page rolled it
