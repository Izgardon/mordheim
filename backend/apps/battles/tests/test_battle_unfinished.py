"""Your unfinished battle, with a way back (decision 1, BATL-NEW-01): every battle the list (and `?open=1`, which the
overview, the Rejoin button and the invite gate read) and the state return says where the reader stands in it,
`viewer`: his status, whether it is unfinished for him and the page where he carries on. The battle's
`last_activity_at` is its idle time; the create answer's player_busy warnings carry the page too."""

from typing import Any

from .battle_support import BattleTestCase, draft


class UnfinishedBattleTests(BattleTestCase):
    def open_battles(self, user: Any) -> dict[int, dict[str, Any]]:
        rows = self.ok(self.get_as(user, self.battles_url() + "?open=1")).data
        return {row["battle"]["id"]: row["viewer"] for row in rows}

    def viewer_of(self, user: Any, battle_id: int) -> dict[str, Any]:
        return dict(self.ok(self.get_as(user, self.url(battle_id, "state"))).data["viewer"])

    def test_the_page_follows_the_players_own_progress(self):
        battle_id = self.create_battle()
        invited = {"participant_status": "invited", "unfinished": True, "page": "prebattle"}  # the invite gate
        self.assertEqual(self.open_battles(self.viewer)[battle_id], invited)

        self.ok(self.post_as(self.viewer, self.url(battle_id, "join")))
        for user in (self.player, self.viewer):
            self.ok(self.post_as(user, self.url(battle_id, "ready"), {"ready": True}))
        self.ok(self.post_as(self.player, self.url(battle_id, "start")))
        self.ok(self.finish_mine(self.player, battle_id, "won"))  # decision 4: his postbattle while the other fights

        self.assertEqual(self.open_battles(self.player)[battle_id], {"participant_status": "finished_battle", "unfinished": True, "page": "postbattle"})  # fmt: skip
        self.assertEqual(self.viewer_of(self.viewer, battle_id), {"participant_status": "in_battle", "unfinished": True, "page": "active"})  # fmt: skip

        self.ok(self.finalize(self.player, battle_id, draft({})))
        done = {"participant_status": "confirmed_postbattle", "unfinished": False, "page": "postbattle"}  # waiting
        self.assertEqual(self.viewer_of(self.player, battle_id), done)

    def test_a_declined_battle_is_not_unfinished(self):
        battle_id = self.create_battle()
        self.ok(self.post_as(self.viewer, self.url(battle_id, "decline")))
        self.assertEqual(self.viewer_of(self.viewer, battle_id), {"participant_status": "declined", "unfinished": False, "page": None})  # fmt: skip

    def test_the_creator_is_told_where_to_finish_his_own(self):
        old = self.to_active()
        self.ok(self.finish_mine(self.player, old, "lost"))
        body = {"participant_user_ids": [self.viewer.id], "scenario": "Ford"}
        warnings = self.ok(self.post_as(self.player, self.battles_url(), body), 201).data["warnings"]
        mine = next(warning for warning in warnings if warning["user_id"] == self.player.id)
        self.assertEqual((mine["battle_id"], mine["battle_status"], mine["page"]), (old, "active", "postbattle"))
