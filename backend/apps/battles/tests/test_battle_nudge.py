"""Who's holding up the battle, and Nudge (BATL-NEW-08).

Every participant in the state carries his status and `last_activity_at` (his last write or read, whichever is
later); `POST nudge/` sends a player who still has something to do a `battle_nudge` notification, at most once per
10 minutes per pair of players, and adds a `participant_nudged` event to the timeline.
"""

from datetime import timedelta
from typing import Any

from apps.battles.models import BattleEvent
from apps.notifications.models import Notification

from .battle_support import BattleTestCase, draft, status_changed


class NudgeTests(BattleTestCase):
    def nudge(self, user: Any, battle_id: int, target: Any) -> Any:
        return self.post_as(user, self.url(battle_id, "nudge"), {"user_id": target.id})

    def notifications(self, user: Any) -> list[dict[str, Any]]:
        return list(self.ok(self.get_as(user, "/api/notifications/")).data)

    def test_a_player_nudges_one_who_is_holding_up_the_battle(self):
        battle_id = self.to_active()
        self.ok(self.finish_mine(self.player, battle_id, "won"))

        data = self.ok(self.nudge(self.player, battle_id, self.viewer), 201).data

        nudged = {"target_user_id": self.viewer.id, "nudged_by_user_id": self.player.id}
        self.assertEqual([(event["type"], event["payload_json"]) for event in data["events"]], [("participant_nudged", nudged)])  # fmt: skip
        self.assertEqual(self.sent()[-1], "participant_nudged")
        self.assertEqual(self.notified()[-1], (self.viewer.id, "battle_nudge"))
        [notice] = [row for row in self.notifications(self.viewer) if row["notification_type"] == "battle_nudge"]
        self.assertEqual(notice["reference_id"], str(battle_id))
        payload = notice["payload"]
        self.assertEqual((payload["page"], payload["nudged_by_user_id"], payload["nudged_by_user_label"]), ("active", self.player.id, "playe"))  # fmt: skip

        again = self.nudge(self.player, battle_id, self.viewer)  # within 10 minutes
        self.assertEqual((again.status_code, again.data["code"]), (429, "nudged_recently"))
        self.assertTrue(0 < again.data["retry_after"] <= 600)
        self.ok(self.nudge(self.viewer, battle_id, self.player), 201)  # the other way round is another pair
        last = BattleEvent.objects.filter(battle_id=battle_id, actor_user=self.player, type="participant_nudged")
        last.update(created_at=last.get().created_at - timedelta(minutes=11))
        self.ok(self.nudge(self.player, battle_id, self.viewer), 201)

    def test_only_a_player_still_in_nudges_and_only_one_with_something_left_to_do(self):
        battle_id = self.to_active()
        response = self.nudge(self.player, battle_id, self.player)
        self.assertEqual((response.status_code, list(response.data["fields"])), (400, ["user_id"]))
        response = self.nudge(self.player, battle_id, self.manager)  # a member, not in the battle
        self.assertEqual((response.status_code, list(response.data["fields"])), (400, ["user_id"]))
        self.assertEqual(self.post_as(self.player, self.url(battle_id, "nudge"), {}).status_code, 400)
        self.assertEqual(self.nudge(self.outsider, battle_id, self.viewer).status_code, 404)

        self.ok(self.finish_mine(self.player, battle_id, "won"))
        self.ok(self.finalize(self.player, battle_id, draft({})))  # he has nothing left to do
        response = self.nudge(self.viewer, battle_id, self.player)
        self.assertEqual((response.status_code, response.data["code"]), (400, "not_holding_up"))

        self.ok(self.post_as(self.campaign_owner, self.url(battle_id, "finish"), {"winners": []}))
        self.ok(self.post_as(self.campaign_owner, self.url(battle_id, "close-postbattle")))
        response = self.nudge(self.player, battle_id, self.viewer)
        self.assertEqual((response.status_code, response.data), (400, status_changed("Only the players of an open battle can be nudged", "ended")))  # fmt: skip

    def test_a_nudge_is_gone_once_the_battle_is_over(self):
        battle_id = self.create_battle()
        self.ok(self.nudge(self.player, battle_id, self.viewer), 201)
        self.assertIn("battle_nudge", [row["notification_type"] for row in self.notifications(self.viewer)])

        self.ok(self.post_as(self.player, self.url(battle_id, "cancel-battle")))

        self.assertNotIn("battle_nudge", [row["notification_type"] for row in self.notifications(self.viewer)])
        self.assertTrue(Notification.objects.filter(notification_type="battle_nudge", is_resolved=False).exists())

    def test_the_state_says_who_is_where_and_since_when(self):
        battle_id = self.to_active()
        self.ok(self.post_as(self.viewer, self.url(battle_id, "config"), {"battle_notes": "flanking"}))

        state = self.ok(self.get_as(self.player, self.url(battle_id, "state") + "?view=active")).data

        self.assertTrue(state["capabilities"]["nudge"])
        rows = {entry["user"]["id"]: entry for entry in state["participants"]}
        viewer = self.participant(battle_id, self.viewer)
        self.assertEqual((rows[self.viewer.id]["status"], rows[self.viewer.id]["last_activity_at"]), ("in_battle", viewer.updated_at.isoformat()))  # fmt: skip

        state = self.ok(self.get_as(self.viewer, self.url(battle_id, "state") + "?view=active")).data
        player = self.participant(battle_id, self.player)  # his read is later than his last write
        assert player.last_seen_at is not None and player.last_seen_at > player.updated_at
        rows = {entry["user"]["id"]: entry for entry in state["participants"]}
        self.assertEqual(rows[self.player.id]["last_activity_at"], player.last_seen_at.isoformat())
