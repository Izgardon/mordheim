"""Decision 4: each player finishes his own battle, the last one to finish ends the fight and confirms the results.

`finish-mine/` (won, lost or undecided) sends a player to his own postbattle while the others play on; when nobody
is left fighting the battle enters postbattle with the declared winners and waits for `results/` from the last one
to finish (or a battle manager). Wins and losses still count once, when the battle ends (decision 3).
"""

from typing import Any

from apps.battles.models import BattleEvent
from apps.warbands.models import Hero

from .battle_support import BattleTestCase, draft, status_changed, unit_result


class FinishMineTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.abbess = self.warband.heroes.create(name="Abbess", unit_type="Matriarch")
        self.rat = self.rival.heroes.create(name="Rat", unit_type="Assassin")
        self.a, self.r = f"hero:{self.abbess.id}", f"hero:{self.rat.id}"

    def active(self) -> int:
        return self.to_active({self.player: [self.a], self.viewer: [self.r]})

    def finalise(self, user: Any, battle_id: int) -> Any:
        key = self.a if user is self.player else self.r
        return self.ok(self.finalize(user, battle_id, draft({key: unit_result(key)})))

    def state(self, user: Any, battle_id: int, view: str = "full") -> dict[str, Any]:
        return dict(self.ok(self.get_as(user, self.url(battle_id, "state") + f"?view={view}")).data)

    def results(self, user: Any, battle_id: int, winners: list[int], losers: list[int] | None = None) -> Any:
        body: dict[str, Any] = {"winners": winners, "losers": losers or []}
        return self.post_as(user, self.url(battle_id, "results"), body)

    def test_each_player_finishes_his_own_battle_and_the_last_one_ends_the_fight(self):
        battle_id = self.active()

        data = self.ok(self.finish_mine(self.player, battle_id, "won")).data

        self.assertEqual((data["battle"]["status"], self.statuses(battle_id)), ("active", ["finished_battle", "in_battle"]))  # fmt: skip
        mine = next(entry for entry in data["participants"] if entry["user"]["id"] == self.player.id)
        self.assertEqual(mine["declared_result"], "won")
        finished = {"participant_user_id": self.player.id, "warband_id": self.warband.id, "declared_result": "won"}
        self.assertEqual([(event["type"], event["payload_json"]) for event in data["events"]], [("participant_finished_battle", finished)])  # fmt: skip
        self.assertNotIn("confirm_results", data)
        self.assertFalse(self.state(self.player, battle_id)["capabilities"]["finish_mine"])

        data = self.ok(self.finish_mine(self.viewer, battle_id, "lost")).data

        battle = data["battle"]
        self.assertEqual((battle["status"], battle["winner_warband_ids_json"]), ("postbattle", [self.warband.id]))
        self.assertEqual((battle["results_pending"], battle["results_confirmer_user_id"]), (True, self.viewer.id))
        self.assertIsNotNone(battle["closes_at"])  # 72 hours of postbattle (decision 2)
        entered = {
            "winner_warband_ids": [self.warband.id],
            "mode": "all_finished",
            "results_pending": True,
            "results_confirmer_user_id": self.viewer.id,
        }
        self.assertEqual([event["type"] for event in data["events"]], ["participant_finished_battle", "battle_entered_postbattle"])  # fmt: skip
        self.assertEqual(data["events"][1]["payload_json"], entered)
        sides = {"winners": [self.warband.id], "losers": [self.rival.id], "undecided": []}
        self.assertEqual(data["confirm_results"], sides)
        self.assertEqual(self.ok(self.finish_mine(self.viewer, battle_id, "won")).data["events"], [])  # a repeat

        confirmer = self.state(self.viewer, battle_id)
        self.assertTrue(confirmer["capabilities"]["confirm_results"])
        self.assertEqual(confirmer["confirm_results"], sides)
        other = self.state(self.player, battle_id)
        self.assertFalse(other["capabilities"]["confirm_results"])
        self.assertNotIn("confirm_results", other)

    def test_a_player_finalises_while_the_others_fight_and_the_results_decide(self):
        battle_id = self.active()
        self.ok(self.finish_mine(self.player, battle_id, "won"))
        guide = self.state(self.player, battle_id, "postbattle")["suggested_postbattle"]
        self.assertEqual(guide["exploration"], {"dice_count": 2})  # his hero, +1 for the win he declared
        self.ok(self.kill(self.player, battle_id, self.a, self.r, source="postbattle"), 201)  # his own postbattle
        self.finalise(self.player, battle_id)
        self.assertEqual((self.battle(battle_id).status, self.statuses(battle_id)), ("active", ["confirmed_postbattle", "in_battle"]))  # fmt: skip

        response = self.post_as(self.player, self.url(battle_id, "cancel-battle"))  # his results would stay applied
        self.assertEqual((response.status_code, response.data["code"]), (400, "postbattle_applied"))
        owner_cancel = f"/api/campaigns/{self.campaign.id}/active-battles/{battle_id}/cancel/"
        response = self.post_as(self.campaign_owner, owner_cancel)
        self.assertEqual((response.status_code, response.data["code"]), (400, "postbattle_applied"))
        self.assertFalse(self.state(self.player, battle_id)["capabilities"]["cancel"])

        self.ok(self.finish_mine(self.viewer, battle_id, "undecided"))
        self.ok(self.results(self.viewer, battle_id, [self.rival.id], [self.warband.id]))
        self.assertEqual(self.battle(battle_id).winner_warband_ids_json, [self.rival.id])
        self.assertEqual((self.record(self.warband), self.record(self.rival)), ((None, None), (None, None)))
        data = self.finalise(self.viewer, battle_id).data

        self.assertEqual(data["battle"]["status"], "ended")
        self.assertEqual((self.record(self.warband), self.record(self.rival)), ((None, 1), (1, None)))
        self.assertEqual(self.warband.logs.get(entry_type="complete").payload["result"], "lost")

    def test_the_battle_waits_for_its_results_and_ends_when_they_come(self):
        battle_id = self.active()
        self.ok(self.finish_mine(self.player, battle_id, "won"))
        self.ok(self.finish_mine(self.viewer, battle_id, "won"))
        for user in (self.player, self.viewer):
            self.finalise(user, battle_id)
        self.assertEqual(self.battle(battle_id).status, "postbattle")  # everyone has finished; the results haven't

        data = self.ok(self.results(self.viewer, battle_id, [self.warband.id])).data

        self.assertEqual(data["battle"]["status"], "ended")
        confirmed = {"winner_warband_ids": [self.warband.id], "loser_warband_ids": [self.rival.id], "confirmed_by_user_id": self.viewer.id}  # fmt: skip
        self.assertEqual([(event["type"], event["payload_json"]) for event in data["events"]][0], ("battle_results_confirmed", confirmed))  # fmt: skip
        self.assertEqual(data["events"][1]["type"], "battle_ended")
        self.assertEqual((self.record(self.warband), self.record(self.rival)), ((1, None), (None, 1)))

    def test_results_come_from_the_last_player_or_a_manager_and_name_the_battles_warbands(self):
        battle_id = self.active()
        self.ok(self.finish_mine(self.player, battle_id, "won"))
        response = self.results(self.campaign_owner, battle_id, [self.warband.id])  # nothing to confirm yet
        self.assertEqual((response.status_code, response.data), (400, status_changed("Results can be confirmed in postbattle, until the battle ends", "active")))  # fmt: skip
        self.ok(self.finish_mine(self.viewer, battle_id, "lost"))

        response = self.results(self.player, battle_id, [self.warband.id])
        self.assertEqual((response.status_code, response.data["code"]), (403, "not_allowed"))
        self.assertEqual(self.results(self.outsider, battle_id, []).status_code, 404)
        for body, field in (({"winners": [self.warband.id + 999]}, "winners"), ({"losers": []}, "winners")):
            with self.subTest(body=body):
                response = self.post_as(self.viewer, self.url(battle_id, "results"), body)
                self.assertEqual((response.status_code, list(response.data["fields"])), (400, [field]))

        data = self.ok(self.results(self.campaign_owner, battle_id, [])).data  # "No winner" (decision 8)
        self.assertEqual((data["battle"]["winner_warband_ids_json"], data["battle"]["results_pending"]), ([], False))
        self.assertEqual(data["events"][0]["payload_json"]["loser_warband_ids"], [])
        self.assertEqual(self.ok(self.results(self.viewer, battle_id, [])).data["events"], [])  # the same again
        self.ok(self.results(self.viewer, battle_id, [self.rival.id]))  # changed until the battle ends
        self.assertEqual(self.battle(battle_id).winner_warband_ids_json, [self.rival.id])

    def test_closing_before_the_results_counts_the_declared_winners(self):
        battle_id = self.active()
        self.ok(self.finish_mine(self.player, battle_id, "won"))
        self.ok(self.finish_mine(self.viewer, battle_id, "lost"))

        self.ok(self.post_as(self.player, self.url(battle_id, "close-postbattle")))

        ended = BattleEvent.objects.filter(battle_id=battle_id, type="battle_ended").get().payload_json
        self.assertEqual((ended["winner_warband_ids"], ended["unconfirmed_results"]), ([self.warband.id], True))
        self.assertFalse(self.battle(battle_id).results_pending)
        self.assertEqual((self.record(self.warband), self.record(self.rival)), ((1, None), (None, 1)))

    def test_finishing_needs_an_active_battle_a_player_still_fighting_and_a_result(self):
        battle_id = self.to_prebattle()
        response = self.finish_mine(self.player, battle_id, "won")
        self.assertEqual((response.status_code, response.data), (400, status_changed("Battle has not started", "prebattle")))  # fmt: skip

        battle_id = self.active()
        for result in (None, "draw", ""):
            with self.subTest(result=result):
                response = self.post_as(self.player, self.url(battle_id, "finish-mine"), {"result": result})
                self.assertEqual((response.status_code, response.data["fields"]), (400, {"result": ["Choose won, lost or undecided."]}))  # fmt: skip
        self.assertEqual(self.statuses(battle_id), ["in_battle", "in_battle"])

    def test_trading_actions_come_back_when_each_player_finishes(self):
        # BUG-122: once per player, when he finishes, so an action spent in his postbattle stays spent
        battle_id = self.active()
        Hero.objects.update(trading_action=False)

        self.ok(self.finish_mine(self.player, battle_id, "won"))
        self.abbess.refresh_from_db()
        self.rat.refresh_from_db()
        self.assertEqual((self.abbess.trading_action, self.rat.trading_action), (True, False))

        Hero.objects.filter(id=self.abbess.id).update(trading_action=False)  # he trades in his postbattle
        self.ok(self.finish_mine(self.viewer, battle_id, "lost"))
        self.abbess.refresh_from_db()
        self.rat.refresh_from_db()
        self.assertEqual((self.abbess.trading_action, self.rat.trading_action), (False, True))
