"""The postbattle state's `suggested_postbattle` and `rules` (IMP-52): today's suggestions and tables, from the
server instead of the postbattle page's own copies (BATL-CQ-03)."""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.battles.services.exploration import table_amount
from apps.battles.services.injuries import describe_roll

from .battle_support import BattleTestCase, build_fixture_warband, catalogue_item


class PostbattleGuideTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.fixture = build_fixture_warband(self.warband, catalogue_item("Rope", 5))
        sword = self.fixture.hired_swords[1]
        sword.no_level_ups = True
        sword.save(update_fields=["no_level_ups"])
        self.rat = self.rival.heroes.create(name="Rat", unit_type="Assassin")
        self.r = f"hero:{self.rat.id}"

    def guide(self, battle_id: int) -> dict[str, Any]:
        return dict(self.ok(self.get_as(self.player, self.url(battle_id, "state") + "?view=postbattle")).data)

    def test_suggestions_follow_todays_rule(self):
        heroes, henchmen = [f"hero:{hero.id}" for hero in self.fixture.heroes], self.fixture.henchmen
        battle_id = self.to_active({self.player: self.fixture.keys, self.viewer: [self.r]})
        self.ok(self.kill(self.player, battle_id, heroes[0], self.r), 201)
        self.ok(self.kill(self.player, battle_id, heroes[1], self.r, earned_xp=False), 201)  # earns no XP
        undone = self.ok(self.kill(self.player, battle_id, heroes[2], self.r), 201).data["events"][0]["id"]
        self.ok(self.post_as(self.player, f"{self.url(battle_id, 'events')}{undone}/void/"))  # a live kill no more
        self.ok(self.kill(self.player, battle_id, f"henchman:{henchmen[0].id}", self.r), 201)
        self.ok(self.post_as(self.player, self.url(battle_id, "unit-ooa"), {"unit_key": heroes[3], "out_of_action": True}), 201)  # fmt: skip
        self.finish(battle_id, [self.warband])

        suggested = self.guide(battle_id)["suggested_postbattle"]

        swords = [f"hired_sword:{sword.id}" for sword in self.fixture.hired_swords]
        group_xp = [2, 2, 2, 1, 1, 1, 1, 1]  # the first group shares its member's kill
        # the first hero leads a winning warband: Winning Leader +1 (BATL-NEW-09)
        expected_xp = dict(zip(heroes, [3, 1, 1, 1, 1], strict=True)) | {swords[0]: 1, swords[1]: 0}
        expected_xp |= {f"henchman:{member.id}": xp for member, xp in zip(henchmen, group_xp, strict=True)}
        self.assertEqual({key: entry["xp_earned"] for key, entry in suggested["unit_results"].items()}, expected_xp)
        reasons = {key: entry["reasons"] for key, entry in suggested["unit_results"].items()}
        survived, no_level_ups = {"label": "survived", "xp": 1}, {"label": "no level-ups", "xp": 0}
        leader = [survived, {"label": "1 kill", "xp": 1}, {"label": "winning leader", "xp": 1}]
        self.assertEqual((reasons[heroes[0]], reasons[heroes[1]]), (leader, [survived]))
        self.assertEqual((reasons[swords[0]], reasons[swords[1]]), ([survived], [no_level_ups]))
        group_kill = [survived, {"label": "1 group kill", "xp": 1}]
        self.assertEqual((reasons[f"henchman:{henchmen[0].id}"], reasons[f"henchman:{henchmen[3].id}"]), (group_kill, [survived]))  # fmt: skip
        self.assertEqual(suggested["exploration"], {"dice_count": 5})  # 4 heroes in action, +1 for the win
        upkeep = {key: {"unit_name": f"Sword {n}", "cost": 15} for n, key in enumerate(swords)}
        self.assertEqual(suggested["upkeep"], {"entries": upkeep})

    def test_rules_are_the_servers_tables(self):
        self.campaign_settings.hero_death_roll = "d100"
        self.campaign_settings.save()
        battle_id = self.to_postbattle({self.player: [f"hero:{self.fixture.heroes[0].id}"], self.viewer: [self.r]})

        rules = self.guide(battle_id)["rules"]

        self.assertEqual(rules["hero_death_roll"], "d100")
        self.assertEqual(rules["exploration_dice"], {"max": 10, "max_chosen": 6})
        for total in range(0, 40):
            row = next(
                row for row in rules["exploration_table"] if row["max_total"] is None or total <= row["max_total"]
            )
            self.assertEqual(row["amount"], table_amount([total]), total)
        rolls = {
            "d6": [[value] for value in range(1, 7)],
            "d66": [[tens, units] for tens in range(1, 7) for units in range(1, 7)],
            "d100": [[value] for value in range(1, 101)],
        }
        for roll_type, cases in rolls.items():
            for roll in cases:
                with self.subTest(roll_type=roll_type, roll=roll):
                    value = roll[0] * 10 + roll[1] if roll_type == "d66" else roll[0]
                    row = next(row for row in rules["injury_tables"][roll_type] if row["low"] <= value <= row["high"])
                    described = describe_roll(roll_type, roll)
                    self.assertEqual((row["label"], row["effect"]), (described["result_label"], described["effect"]))

    def test_only_the_postbattle_view_carries_them_at_two_reads_more(self):
        battle_id = self.to_postbattle({self.player: self.fixture.keys, self.viewer: [self.r]})
        full = self.ok(self.get_as(self.player, self.url(battle_id, "state"))).data
        self.assertNotIn("suggested_postbattle", full)
        self.assertNotIn("rules", full)

        self.client.force_authenticate(user=self.player)
        with CaptureQueriesContext(connection) as captured:
            self.ok(self.client.get(self.url(battle_id, "state") + "?view=postbattle"))
        self.assertLessEqual(len(captured), 6)  # state's 4, the player's battle roster, the live kill events

    def test_only_a_winning_leader_gets_winning_leader(self):
        # BATL-NEW-09: the warband's leader, when it won (the player's own declaration while the others fight)
        leader = f"hero:{self.fixture.heroes[0].id}"
        battle_id = self.to_active({self.player: [leader], self.viewer: [self.r]})
        self.ok(self.finish_mine(self.player, battle_id, "lost"))
        self.assertEqual(self.guide(battle_id)["suggested_postbattle"]["unit_results"][leader]["xp_earned"], 1)
        self.ok(self.finish_mine(self.viewer, battle_id, "won"))
        self.ok(self.post_as(self.viewer, self.url(battle_id, "results"), {"winners": [self.warband.id]}))
        reasons = self.guide(battle_id)["suggested_postbattle"]["unit_results"][leader]["reasons"]
        self.assertEqual([reason["label"] for reason in reasons], ["survived", "winning leader"])
