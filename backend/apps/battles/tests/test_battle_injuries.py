"""Serious injuries applied at finalise (decision 7, BUG-47, BATL-TWEAK-05).

The server's table gives each roll's result and effect. At finalise a unit's last roll, when ticked, is applied if it
is simple (dead, a characteristic -1, a named special) and flagged to apply by hand otherwise; one log per unit.
"""

from typing import Any

from apps.battles.services.injuries import describe_roll
from apps.special.models import Special
from apps.warbands.models import HeroSpecial, WarbandLog

from .battle_support import BattleTestCase, draft, unit_result


def roll(rolls: list[int], roll_type: str = "d66", **fields: Any) -> dict[str, Any]:
    return {"roll_type": roll_type, "rolls": rolls, "result_label": "what the page showed", **fields}


class InjuryTableTests(BattleTestCase):
    def test_each_result_has_its_effect(self):
        cases: list[tuple[str, list[int], str, dict[str, Any]]] = [
            ("d66", [1, 3], "Dead", {"kind": "dead"}),
            ("d66", [2, 1], "Full Recovery", {"kind": "none"}),
            ("d66", [3, 1], "Old Battle Wound", {"kind": "special", "special": "Old Battle Wound"}),
            ("d66", [3, 2], "Nervous Condition", {"kind": "stat", "stat": "initiative", "change": -1}),
            ("d66", [3, 6], "Robbed", {"kind": "manual"}),
            ("d66", [6, 6], "Multiple Injuries", {"kind": "manual"}),
            ("d100", [30], "Chest Wound", {"kind": "stat", "stat": "toughness", "change": -1}),
            ("d100", [7], "Dead", {"kind": "dead"}),
            ("d6", [2], "Dead", {"kind": "dead"}),
            ("d6", [5], "Survives", {"kind": "none"}),
        ]
        for roll_type, rolls, label, effect in cases:
            with self.subTest(roll_type=roll_type, rolls=rolls):
                described = describe_roll(roll_type, rolls)
                self.assertEqual((described["result_label"], described["effect"]), (label, effect))
                self.assertEqual(described["dead_suggestion"], effect["kind"] == "dead")


class InjuryFinaliseTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.heroes = [
            self.warband.heroes.create(name=name, unit_type="Champion", initiative=3)
            for name in ("Ana", "Bea", "Cy", "Di")
        ]
        self.group = self.warband.henchmen_groups.create(name="Sisters", unit_type="Sister")
        self.sister = self.group.henchmen.create(name="Eve")
        self.keys = [f"hero:{hero.id}" for hero in self.heroes] + [f"henchman:{self.sister.id}"]
        self.rat = f"hero:{self.rival.heroes.create(name='Rat', unit_type='Assassin').id}"

    def test_ticked_simple_results_are_applied_and_complex_ones_flagged(self):
        battle_id = self.to_postbattle({self.player: self.keys, self.viewer: [self.rat]})
        ana, bea, cy, di = self.keys[:4]
        rolls = {
            ana: [roll([1, 2])],  # dead
            bea: [roll([1, 1]), roll([3, 2])],  # re-rolled into Nervous Condition: initiative -1
            cy: [roll([3, 1])],  # Old Battle Wound: a special
            di: [roll([2, 2], apply=False)],  # Horrible Scars, unticked
            self.keys[4]: [roll([1], roll_type="d6")],  # a henchman's 1: dead
        }
        results = {key: unit_result(key, rolls=rolls.get(key), name=key) for key in self.keys}

        saved = self.ok(
            self.post_as(self.player, self.url(battle_id, "postbattle"), {"postbattle_json": draft(results)})
        )
        stored = saved.data["participants"][0]["postbattle_json"]["unit_results"][bea]["serious_injury_rolls"][-1]
        self.assertEqual((stored["result_label"], stored["apply"]), ("Nervous Condition", True))  # the server's label
        self.ok(self.finalize(self.player, battle_id, draft(results)))

        for unit in (*self.heroes, self.sister):
            unit.refresh_from_db()
        self.assertEqual([hero.dead for hero in self.heroes], [True, False, False, False])
        self.assertEqual([hero.initiative for hero in self.heroes], [3, 2, 3, 3])
        self.assertTrue(self.sister.dead)
        wound = Special.objects.get(name="Old Battle Wound")
        self.assertEqual((wound.campaign_id, wound.type), (self.campaign.id, "Injury"))
        self.assertEqual(
            list(HeroSpecial.objects.values_list("hero_id", "special__name")), [(self.heroes[2].id, "Old Battle Wound")]
        )

        logs = {log.payload["unit_name"]: log.payload for log in WarbandLog.objects.filter(entry_type="serious_injury")}
        self.assertEqual(sorted(logs), sorted(self.keys))
        self.assertEqual((logs[bea]["rerolls"], logs[bea]["applied"]), ([[1, 1]], True))
        self.assertEqual((logs[di]["applied"], logs[di]["apply_by_hand"]), (False, False))

    def test_a_catalogue_special_is_used_when_there_is_one(self):
        scars = Special.objects.create(name="Horrible Scars", type="Injury")
        ana = self.keys[0]
        battle_id = self.to_postbattle({self.player: [ana], self.viewer: [self.rat]})

        self.ok(self.finalize(self.player, battle_id, draft({ana: unit_result(ana, rolls=[roll([2, 4])])})))

        self.assertEqual(list(HeroSpecial.objects.values_list("special_id", flat=True)), [scars.id])
        self.assertEqual(Special.objects.filter(name="Horrible Scars").count(), 1)
