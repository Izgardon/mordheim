"""The suggestions come with the end of the fight (item 8): the write that puts a player into postbattle answers his
`suggested_postbattle` and `rules`, and its broadcast carries every player's who is in his own postbattle, under
Pusher's 10 KB limit (what doesn't fit is flagged, and those pages read `state/?view=postbattle`)."""

import json
from typing import Any
from unittest import mock

from apps.battles.services import broadcast

from .battle_support import BattleTestCase, build_fixture_warband, catalogue_item


class EndSnapshotTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.fixture = build_fixture_warband(self.warband, catalogue_item("Rope", 5))
        self.rat = self.rival.heroes.create(name="Rat", unit_type="Assassin")
        self.r = f"hero:{self.rat.id}"

    def guide(self, user: Any, battle_id: int) -> dict[str, Any]:
        return dict(self.ok(self.get_as(user, self.url(battle_id, "state") + "?view=postbattle")).data)

    def last_message(self) -> dict[str, Any]:
        return dict(self.battle_events.call_args.kwargs)

    def test_finishing_answers_what_his_postbattle_suggests(self):
        battle_id = self.to_active({self.player: self.fixture.keys, self.viewer: [self.r]})

        data = self.ok(self.finish_mine(self.player, battle_id, "won")).data

        self.assertEqual(data["suggested_postbattle"]["exploration"], {"dice_count": 6})  # 5 heroes, +1 declared win
        guide = self.guide(self.player, battle_id)
        self.assertEqual((data["suggested_postbattle"], data["rules"]), (guide["suggested_postbattle"], guide["rules"]))
        self.assertNotIn("postbattle", self.last_message())  # nobody else needs his

    def test_the_end_of_the_fight_and_the_results_carry_everyones_suggestions(self):
        battle_id = self.to_active({self.player: self.fixture.keys, self.viewer: [self.r]})
        self.ok(self.finish_mine(self.player, battle_id, "lost"))

        data = self.ok(self.finish_mine(self.viewer, battle_id, "won")).data

        self.assertEqual(data["suggested_postbattle"]["exploration"], {"dice_count": 2})  # his hero, +1 for the win
        message = self.last_message()
        self.assertEqual(self.battle_events.call_args.args[1], "battle_entered_postbattle")
        suggested = message["postbattle"]["suggested"]
        self.assertEqual(sorted(suggested), sorted([str(self.player.id), str(self.viewer.id)]))
        self.assertEqual(suggested[str(self.player.id)], self.guide(self.player, battle_id)["suggested_postbattle"])
        self.assertEqual(message["postbattle"]["rules"], data["rules"])
        self.assertLessEqual(len(json.dumps({key: message[key] for key in ("battle", "participants", "postbattle")})), 9000)  # fmt: skip

        data = self.ok(self.post_as(self.viewer, self.url(battle_id, "results"), {"winners": [self.warband.id]})).data

        self.assertEqual(data["suggested_postbattle"]["exploration"], {"dice_count": 1})  # the win went
        suggested = self.last_message()["postbattle"]["suggested"]
        self.assertEqual(suggested[str(self.player.id)]["exploration"], {"dice_count": 6})  # now a winner

    def test_a_managers_end_broadcasts_them_and_answers_none_to_a_manager_who_did_not_play(self):
        battle_id = self.to_active({self.player: self.fixture.keys, self.viewer: [self.r]})
        data = self.ok(self.post_as(self.campaign_owner, self.url(battle_id, "finish"), {"winners": []})).data
        self.assertNotIn("suggested_postbattle", data)
        self.assertEqual(sorted(self.last_message()["postbattle"]["suggested"]), sorted([str(self.player.id), str(self.viewer.id)]))  # fmt: skip

    def test_what_does_not_fit_under_the_limit_is_left_out_and_flagged(self):
        battle = {"id": 1, "status": "postbattle", "flow_type": "normal", "created_by_user_id": 3}
        snapshot = {"battle": battle, "participants": [{"id": 7, "user": {"id": 3}, "status": "finished_battle", "notes": "x" * 100}]}  # fmt: skip
        postbattle = {"rules": {"tables": "r" * 3000}, "suggested": {"7": {"unit_results": "s" * 3000}}}
        fields = broadcast._snapshot_fields
        with mock.patch.object(broadcast, "SNAPSHOT_LIMIT_BYTES", 7000):
            self.assertEqual(fields(snapshot, broadcast.ALL, postbattle)["postbattle"], postbattle)
        with mock.patch.object(broadcast, "SNAPSHOT_LIMIT_BYTES", 4000):
            self.assertEqual(fields(snapshot, broadcast.ALL, postbattle)["postbattle"], {"suggested": postbattle["suggested"], "rules_omitted": True})  # fmt: skip
        with mock.patch.object(broadcast, "SNAPSHOT_LIMIT_BYTES", 1000):
            trimmed = fields(snapshot, broadcast.ALL, postbattle)
            self.assertEqual((trimmed["participants"], trimmed["postbattle_omitted"]), (snapshot["participants"], True))  # fmt: skip
            self.assertNotIn("postbattle", trimmed)
        with mock.patch.object(broadcast, "SNAPSHOT_LIMIT_BYTES", 50):
            trimmed = fields(snapshot, broadcast.ALL, postbattle)
            self.assertEqual((trimmed["snapshot_omitted"], trimmed["postbattle_omitted"]), (True, True))
