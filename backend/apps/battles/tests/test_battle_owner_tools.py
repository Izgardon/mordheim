"""Settings > Active Battles for a battle manager (BATL-NEW-03): each battle's idle time and the tools that apply to
it, `actions`: End a stuck fight with its results (`finish/`), confirm a postbattle's results (`results/`), Close
postbattle, and Cancel before postbattle while nobody has applied his postbattle. The manager needn't be in it."""

from typing import Any

from .battle_support import BattleTestCase, draft

NO_TOOLS = {"end": False, "confirm_results": False, "close_postbattle": False, "cancel": False}


class OwnerToolTests(BattleTestCase):
    def listing(self) -> dict[int, dict[str, Any]]:
        rows = self.ok(self.get_as(self.campaign_owner, f"/api/campaigns/{self.campaign.id}/active-battles/")).data
        return {row["battle"]["id"]: row for row in rows}

    def test_each_battle_says_which_tools_apply_and_how_long_it_has_been_idle(self):
        inviting, prebattle, active = self.create_battle(), self.to_prebattle(), self.to_active()
        postbattle = self.to_postbattle()

        listing = self.listing()

        self.assertEqual(listing[inviting]["actions"], {**NO_TOOLS, "cancel": True})
        self.assertEqual(listing[prebattle]["actions"], {**NO_TOOLS, "cancel": True})
        self.assertEqual(listing[active]["actions"], {**NO_TOOLS, "end": True, "cancel": True})
        self.assertEqual(listing[postbattle]["actions"], {**NO_TOOLS, "confirm_results": True, "close_postbattle": True})  # fmt: skip
        self.assertEqual(
            listing[active]["battle"]["last_activity_at"], self.battle(active).last_activity_at.isoformat()
        )

    def test_a_manager_ends_a_stuck_fight_then_closes_its_postbattle(self):
        battle_id = self.to_active()
        self.ok(self.finish_mine(self.player, battle_id, "won"))
        self.ok(self.finalize(self.player, battle_id, draft({})))  # the viewer never finishes
        self.assertEqual(self.listing()[battle_id]["actions"], {**NO_TOOLS, "end": True})  # applied: no cancel

        body = {"winners": [self.warband.id], "losers": [self.rival.id]}
        data = self.ok(self.post_as(self.campaign_owner, self.url(battle_id, "finish"), body)).data

        self.assertEqual((data["battle"]["status"], data["battle"]["results_pending"]), ("postbattle", False))
        self.assertEqual(self.statuses(battle_id), ["confirmed_postbattle", "finished_battle"])
        self.assertEqual(self.listing()[battle_id]["actions"], {**NO_TOOLS, "confirm_results": True, "close_postbattle": True})  # fmt: skip
        self.ok(self.post_as(self.campaign_owner, self.url(battle_id, "close-postbattle")))
        self.assertEqual(self.battle(battle_id).status, "ended")
        self.assertNotIn(battle_id, self.listing())
        self.assertEqual((self.record(self.warband), self.record(self.rival)), ((1, None), (None, 1)))
