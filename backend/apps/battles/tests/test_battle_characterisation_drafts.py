"""Postbattle drafts, kills and finalise checks characterised (pass 3, step 0).

Pinned: a serious-injury log per draft re-roll (BUG-47, BATL-TEST-14); exploration cleared by every draft save
(BUG-71); live kills applied over the postbattle stepper while pivotal moments use the stepper, and kill
history listing a cancelled battle (BUG-11, BATL-TEST-10); a unit dismissed mid-battle making finalise
impossible (BUG-73).
"""

from typing import Any

from django.utils import timezone

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

    def test_each_draft_save_with_a_new_roll_writes_a_permanent_log(self):
        # Characterises current behaviour (BUG-47, BATL-TEST-14, pinned; flips in PR A: drafts log nothing, finalise
        # writes one log per unit)
        battle_id = self.postbattle()
        first, reroll = injury_roll([1, 1], label="Dead"), injury_roll([4, 5], label="Full Recovery")

        self.ok(self.save(battle_id, draft(self.results(**{self.h: {"rolls": [first]}}))))
        self.ok(self.save(battle_id, draft(self.results(**{self.h: {"rolls": [first]}}))))  # unchanged: no log
        self.ok(self.save(battle_id, draft(self.results(**{self.h: {"rolls": [first, reroll]}}))))
        self.assertEqual(self.injury_logs(), [[1, 1], [4, 5]])
        log = WarbandLog.objects.filter(entry_type="serious_injury").order_by("id").first()
        assert log is not None
        self.assertEqual(
            (log.feature, log.payload),
            (
                "personnel",
                {
                    "unit_name": self.h,
                    "roll_type": "d66",
                    "rolls": [1, 1],
                    "result_code": "11",
                    "result_label": "Dead",
                    "dead_suggestion": False,
                },
            ),
        )

        self.ok(self.save(battle_id, draft(self.results())))  # rolls removed: nothing is reverted
        self.ok(self.post_as(self.player, self.url(battle_id, "confirm")))  # and the player skips
        self.assertEqual(self.injury_logs(), [[1, 1], [4, 5]])

    def test_a_roll_that_never_went_through_a_draft_is_never_logged(self):
        battle_id = self.postbattle()
        self.ok(
            self.finalize(self.player, battle_id, draft(self.results(**{self.h: {"rolls": [injury_roll([2, 3])]}})))
        )
        self.assertEqual(self.injury_logs(), [])

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

    def test_a_draft_save_clears_exploration_and_keeps_the_rest(self):
        # Characterises current behaviour (BUG-71, pinned; flips in PR A: the draft keeps the roll)
        battle_id = self.postbattle()
        saved = draft(
            self.results(**{self.h: {"xp": 2}}),
            exploration={"dice_values": [6, 6], "resource_id": self.resource.id, "amount_override": 3},
            finds={"gold_crowns": 12, "items": []},
            upkeep={"pay_upkeep": False, "entries": {}},
        )

        data = self.ok(self.save(battle_id, saved)).data

        stored = self.participant(battle_id, self.player).postbattle_json
        self.assertEqual(stored["exploration"], {"dice_values": [], "resource_id": None})
        self.assertEqual(
            (stored["finds"], stored["upkeep"]),
            ({"gold_crowns": 12, "items": []}, {"pay_upkeep": False, "entries": {}}),
        )
        self.assertEqual(stored["unit_results"][self.h]["xp_earned"], 2)
        self.assertEqual(
            (data["events"], self.sent()[-1]), ([], "battle_entered_postbattle")
        )  # a draft broadcasts nothing

    def test_exploration_adds_the_table_amount_and_logs_only_the_dice(self):
        battle_id = self.postbattle()
        exploration = {"dice_values": [{"value": 6}, 5, 6], "resource_id": self.resource.id}

        self.ok(self.finalize(self.player, battle_id, draft(self.results(), exploration=exploration)))

        self.resource.refresh_from_db()
        self.assertEqual(self.resource.amount, 3)  # total 17: 12 to 17 give 3
        log = WarbandLog.objects.get(warband=self.warband, entry_type="exploration")
        self.assertEqual(log.payload, {"dice": [6, 5, 6]})

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

    def test_a_unit_dismissed_mid_battle_makes_finalise_impossible(self):
        # Characterises current behaviour (BUG-73, pinned; flips in PR A: the unit is left out, with a warning)
        battle_id = self.postbattle()
        self.warband.heroes.filter(id=self.hero.id).update(dismissed_at=timezone.now())

        response = self.finalize(self.player, battle_id, draft(self.results()))

        detail = "A selected hero is no longer available"
        self.assertEqual((response.status_code, response.data), (400, {"detail": detail}))
        self.ok(self.post_as(self.player, self.url(battle_id, "confirm")))  # skipping is the only way out

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

    def test_live_kills_are_applied_and_the_stepper_is_ignored_but_pivotal_moments_use_it(self):
        # Characterises current behaviour (BUG-11, BATL-TEST-10, pinned; flips in PR A: the postbattle number, from
        # the kill events, is what's saved and what pivotal moments read)
        self.finish(self.battle_id, [self.warband])

        self.ok(
            self.finalize(self.player, self.battle_id, draft({self.h: unit_result(self.h, kills=3, name="Abbess")}))
        )
        self.ok(self.finalize(self.viewer, self.battle_id, draft({self.r: unit_result(self.r)})))

        self.hero.refresh_from_db()
        self.assertEqual(self.hero.kills, 1)
        moments = PivotalMoment.objects.filter(battle_id=self.battle_id).order_by("kind")
        self.assertEqual(
            list(moments.values_list("warband_id", "kind", "detail")),
            [
                (self.warband.id, "carried_the_fight", "Abbess scored 3 of 3 recorded kills."),
                (self.warband.id, "untouched_triumph", "Monks won without a single selected unit going out of action."),
            ],
        )

    def test_kill_history_lists_kills_from_a_cancelled_battle(self):
        # Characterises current behaviour (BUG-11, pinned; flips in PR A: ended battles only)
        self.ok(self.post_as(self.player, self.url(self.battle_id, "cancel-battle")))

        history = self.ok(
            self.get_as(self.player, f"/api/warbands/{self.warband.id}/heroes/{self.hero.id}/kill-history/")
        )

        self.assertEqual(
            history.data,
            {
                "total_kills": 0,
                "named_kills_count": 1,
                "named_kills": [{"victim_name": "Rat", "victim_warband_name": "Rats", "scenario_name": "Bridge"}],
            },
        )
