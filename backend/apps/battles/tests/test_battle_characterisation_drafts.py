"""Postbattle drafts, kills and finalise checks characterised (pass 3, step 0).

Fixed: the draft keeps the exploration roll, re-rolls warn and are logged (BUG-71, decision 9); drafts log
nothing and finalise logs each unit's final injury roll once (BUG-47, BATL-TEST-14; test_battle_injuries.py). Fixed: finalise and pivotal moments count the kill events and kill history lists ended battles only
(BUG-11, BATL-TEST-10; undo in test_battle_kills.py); a unit dismissed mid-battle is left out of finalise with a
warning (BUG-73).
"""

from typing import Any

from django.utils import timezone

from apps.battles.models import Battle
from apps.campaigns.models import PivotalMoment
from apps.special.models import Special
from apps.warbands.models import HeroSpecial, WarbandLog, WarbandResource

from .battle_support import BattleTestCase, draft, injury_roll, unit_result


class PostbattleDraftTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.hero = self.warband.heroes.create(name="Abbess", unit_type="Matriarch", is_leader=True)
        self.group = self.warband.henchmen_groups.create(name="Sisters", unit_type="Sister")
        self.sister = self.group.henchmen.create(name="Ana")
        self.rat = self.rival.heroes.create(name="Rat", unit_type="Assassin")
        self.h, self.s, self.r = f"hero:{self.hero.id}", f"henchman:{self.sister.id}", f"hero:{self.rat.id}"
        self.resource = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=0)

    def postbattle(self) -> int:
        return self.to_postbattle({self.player: [self.h, self.s], self.viewer: [self.r]})

    def save(self, battle_id: int, postbattle_json: dict[str, Any]) -> Any:
        return self.post_as(self.player, self.url(battle_id, "postbattle"), {"postbattle_json": postbattle_json})

    def results(self, **changes: dict[str, Any]) -> dict[str, dict[str, Any]]:
        return {key: unit_result(key, **changes.get(key, {})) for key in (self.h, self.s)}

    def injury_logs(self) -> list[list[int]]:
        rows = WarbandLog.objects.filter(warband=self.warband, entry_type="serious_injury").order_by("id")
        return [row.payload["rolls"] for row in rows]

    def test_drafts_log_nothing_and_a_skip_logs_nothing(self):
        # BUG-47, BATL-TEST-14: each draft save with a new roll wrote a permanent log, even if the player then skipped
        battle_id = self.postbattle()
        first, reroll = injury_roll([1, 1], label="Dead"), injury_roll([4, 5], label="Full Recovery")

        self.ok(self.save(battle_id, draft(self.results(**{self.h: {"rolls": [first]}}))))
        self.ok(self.save(battle_id, draft(self.results(**{self.h: {"rolls": [first, reroll]}}))))
        self.assertEqual(self.injury_logs(), [])
        self.ok(self.post_as(self.player, self.url(battle_id, "confirm")))
        self.assertEqual(self.injury_logs(), [])

    def test_finalise_logs_each_units_final_roll_once(self):
        # BUG-47: a roll that never went through a draft was never logged; finalise now logs every unit's last roll
        battle_id = self.postbattle()
        rolls = [injury_roll([1, 1], label="anything"), injury_roll([4, 5])]
        self.ok(self.finalize(self.player, battle_id, draft(self.results(**{self.h: {"rolls": rolls}}))))

        log = WarbandLog.objects.get(warband=self.warband, entry_type="serious_injury")
        self.assertEqual(
            (log.feature, log.payload),
            (
                "personnel",
                {
                    "unit_name": self.h,
                    "roll_type": "d66",
                    "rolls": [4, 5],
                    "result_code": "45",
                    "result_label": "Sold to the Pits",
                    "dead_suggestion": False,
                    "effect": {"kind": "manual"},
                    "applied": False,
                    "apply_by_hand": True,
                    "rerolls": [[1, 1]],
                },
            ),
        )
        self.hero.refresh_from_db()
        self.assertFalse(self.hero.dead)  # the re-rolled Dead doesn't count

    def test_injury_specials_sent_with_the_draft_are_granted_once(self):
        # BUG-47: the frontend always sends special_ids: [], so this path is unreachable from the app today
        scar = Special.objects.create(name="Old Battle Wound", type="Injury")
        self.hero.hero_specials.create(special=scar)
        wound = Special.objects.create(name="Leg Wound", type="Injury")
        battle_id = self.postbattle()

        self.ok(
            self.finalize(self.player, battle_id, draft(self.results(**{self.h: {"specials": [scar.id, wound.id]}})))
        )

        granted = HeroSpecial.objects.filter(hero=self.hero).order_by("id").values_list("special__name", flat=True)
        self.assertEqual(list(granted), ["Old Battle Wound", "Leg Wound"])

    def test_a_draft_keeps_exploration_with_the_servers_amount(self):
        # BUG-71, decision 9: every draft save cleared exploration, so a reload lost the roll (a free re-roll)
        battle_id = self.postbattle()
        saved = draft(
            self.results(**{self.h: {"xp": 2}}),
            exploration={"dice_values": [6, 6], "resource_id": self.resource.id, "amount_override": 3},
            finds={"gold_crowns": 12, "items": []},
            upkeep={"pay_upkeep": False, "entries": {}},
        )

        data = self.ok(self.save(battle_id, saved)).data

        stored = self.participant(battle_id, self.player).postbattle_json
        self.assertEqual(
            stored["exploration"],
            {
                "dice_values": [6, 6],
                "resource_id": self.resource.id,
                "amount_override": 3,
                "previous_rolls": [],
                "amount": 3,
            },
        )
        self.assertEqual(
            (stored["finds"], stored["upkeep"]),
            ({"gold_crowns": 12, "items": []}, {"pay_upkeep": False, "entries": {}}),
        )
        self.assertEqual(stored["unit_results"][self.h]["xp_earned"], 2)
        self.assertEqual(
            (data["events"], self.sent()[-1]), ([], "battle_entered_postbattle")
        )  # a draft broadcasts nothing
        self.assertNotIn("warnings", data)

    def test_a_reroll_goes_ahead_with_a_warning_and_is_logged(self):
        # Decision 9: re-rolling saved dice warns and is logged, never refused; adding a die isn't a re-roll
        battle_id = self.postbattle()
        explore = {"resource_id": self.resource.id}
        self.ok(self.save(battle_id, draft(self.results(), exploration={**explore, "dice_values": [2]})))
        added = self.ok(self.save(battle_id, draft(self.results(), exploration={**explore, "dice_values": [2, 3]})))
        self.assertNotIn("warnings", added.data)

        rerolled = self.ok(self.save(battle_id, draft(self.results(), exploration={**explore, "dice_values": [6, 6]})))

        message = "Exploration was re-rolled (it was 2, 3); the re-roll is logged."
        self.assertEqual(
            rerolled.data["warnings"], [{"code": "exploration_rerolled", "message": message, "previous": [2, 3]}]
        )
        sneaky = {**explore, "dice_values": [6, 6], "previous_rolls": []}  # the history is the server's
        self.ok(self.finalize(self.player, battle_id, draft(self.results(), exploration=sneaky)))
        log = WarbandLog.objects.get(warband=self.warband, entry_type="exploration")
        self.assertEqual((log.payload["dice"], log.payload["rerolls"], log.payload["amount"]), ([6, 6], [[2, 3]], 3))

    def test_exploration_adds_the_table_amount_and_logs_the_roll(self):
        battle_id = self.postbattle()
        exploration = {"dice_values": [{"value": 6}, 5, 6], "resource_id": self.resource.id}

        self.ok(self.finalize(self.player, battle_id, draft(self.results(), exploration=exploration)))

        self.resource.refresh_from_db()
        self.assertEqual(self.resource.amount, 3)  # total 17: 12 to 17 give 3
        log = WarbandLog.objects.get(warband=self.warband, entry_type="exploration")
        expected = {"dice": [6, 5, 6], "amount": 3, "amount_override": None, "resource": "Wyrdstone", "rerolls": []}
        self.assertEqual(log.payload, expected)

    def test_finalise_validation(self):
        battle_id = self.postbattle()
        other_resource = WarbandResource.objects.create(warband=self.rival, name="Shards")
        rival_sword = self.rival.hired_swords.create(name="Ogre", unit_type="Ogre")
        d6_hero = {self.h: {"rolls": [injury_roll([3], roll_type="d6")]}}
        d66_henchman = {self.s: {"rolls": [injury_roll([3, 3])]}}
        cases: list[tuple[Any, str]] = [
            ([], "postbattle_json must be an object"),
            (draft({self.h: unit_result(self.h)}), "postbattle unit_results are missing selected units"),
            (draft(self.results(**d6_hero)), "hero serious_injury_rolls must use d66"),
            (draft(self.results(**d66_henchman)), "henchman serious_injury_rolls must use d6"),
            (draft(self.results(**{self.h: {"rolls": [injury_roll([3])]}})), "d66 serious_injury_roll must have exactly two rolls"),
            (draft(self.results(**{self.h: {"specials": [999_999]}})), "One or more selected injury specials are invalid"),
            (draft(self.results(), exploration={"resource_id": other_resource.id}), "Selected exploration resource is invalid"),
            (draft(self.results(), exploration={"dice_values": [1] * 11}), "postbattle exploration dice_values must contain at most 10 entries"),
            (draft(self.results(), upkeep={"entries": {f"hired_sword:{rival_sword.id}": {"cost": 5}}}), "One or more upkeep hired swords are invalid"),
        ]  # fmt: skip
        for postbattle_json, detail in cases:
            with self.subTest(detail=detail):
                response = self.finalize(self.player, battle_id, postbattle_json)
                self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))
                response = self.save(battle_id, postbattle_json)  # a draft save checks the same
                self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))
        self.assertEqual(self.participant(battle_id, self.player).status, "finished_battle")

    def test_a_unit_dismissed_mid_battle_is_left_out_with_a_warning(self):
        # BUG-73: it made finalise answer 400, leaving skip as the only way out
        battle_id = self.postbattle()
        self.warband.heroes.filter(id=self.hero.id).update(dismissed_at=timezone.now())
        self.group.henchmen.filter(id=self.sister.id).update(dismissed_at=timezone.now())

        response = self.ok(self.finalize(self.player, battle_id, draft(self.results(**{self.h: {"xp": 3}}))))

        self.assertEqual(
            response.data["warnings"],
            [
                {"code": "unit_left_warband", "message": f"{self.h} has left the warband, so his results were not applied.", "unit_key": self.h},
                {"code": "unit_left_warband", "message": f"{self.s} has left the warband, so his results were not applied.", "unit_key": self.s},
            ],
        )  # fmt: skip
        self.hero.refresh_from_db()
        self.assertEqual(self.hero.xp, 0)
        self.assertEqual(self.participant(battle_id, self.player).status, "confirmed_postbattle")

    def test_a_unit_killed_on_the_sheet_mid_battle_still_finalises(self):
        battle_id = self.postbattle()
        self.warband.heroes.filter(id=self.hero.id).update(dead=True, is_leader=False)

        self.ok(self.finalize(self.player, battle_id, draft(self.results(**{self.h: {"xp": 2}}))))

        self.hero.refresh_from_db()
        self.assertEqual((self.hero.dead, self.hero.xp), (True, 2))


class PostbattleKillTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.hero = self.warband.heroes.create(name="Abbess", unit_type="Matriarch")
        self.rat = self.rival.heroes.create(name="Rat", unit_type="Assassin")
        self.h, self.r = f"hero:{self.hero.id}", f"hero:{self.rat.id}"
        self.battle_id = self.to_active({self.player: [self.h], self.viewer: [self.r]})
        self.ok(self.kill(self.player, self.battle_id, self.h, self.r), 201)

    def test_the_kill_events_are_what_finalise_and_pivotal_moments_count(self):
        # BUG-11, BATL-TEST-10: finalise added the live counter while pivotal moments read the stepper (3 here);
        # now both count the kill events: the one tapped, plus one added in postbattle
        self.finish(self.battle_id, [self.warband])
        self.ok(self.kill(self.player, self.battle_id, self.h, victim_name="Ogre", source="postbattle"), 201)

        self.ok(
            self.finalize(self.player, self.battle_id, draft({self.h: unit_result(self.h, kills=3, name="Abbess")}))
        )
        self.ok(self.finalize(self.viewer, self.battle_id, draft({self.r: unit_result(self.r)})))

        self.hero.refresh_from_db()
        self.assertEqual(self.hero.kills, 2)
        moments = PivotalMoment.objects.filter(battle_id=self.battle_id).order_by("kind")
        self.assertEqual(
            list(moments.values_list("warband_id", "kind", "detail")),
            [
                (self.warband.id, "carried_the_fight", "Abbess scored 2 of 2 recorded kills."),
                (self.warband.id, "untouched_triumph", "Monks won without a single selected unit going out of action."),
            ],
        )

    def test_kill_history_lists_ended_battles_only(self):
        # BUG-11: a cancelled battle's kills were listed
        url = f"/api/warbands/{self.warband.id}/heroes/{self.hero.id}/kill-history/"
        self.ok(self.post_as(self.player, self.url(self.battle_id, "cancel-battle")))

        self.assertEqual(self.ok(self.get_as(self.player, url)).data, {"total_kills": 0, "named_kills_count": 0, "named_kills": []})  # fmt: skip

        Battle.objects.filter(id=self.battle_id).update(status=Battle.STATUS_ENDED)
        self.assertEqual(
            self.ok(self.get_as(self.player, url)).data["named_kills"],
            [{"victim_name": "Rat", "victim_warband_name": "Rats", "scenario_name": "Bridge"}],
        )
