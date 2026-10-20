"""Declining a battle invitation (BUG-45, BATL-NEW-05; every option of decision 4).

An invitee declines while the battle is inviting: his row is `declined`, his invitation resolved and the creator
told. With fewer than two players left the battle is cancelled; once everyone left has accepted, prebattle opens.
"""

from apps.battles.models import BattleEvent
from apps.notifications.models import Notification
from apps.realtime.channel_auth import authorize_private_channel
from apps.warbands.models import Warband

from .battle_support import BattleTestCase


class BattleDeclineTests(BattleTestCase):
    def setUp(self) -> None:
        super().setUp()
        Warband.objects.create(campaign=self.campaign, user=self.manager, name="Crows", faction="X")

    def decline(self, user, battle_id: int):
        return self.post_as(user, self.url(battle_id, "decline"))

    def test_an_invitee_declines_and_the_rest_play_on(self):
        battle_id = self.create_battle([self.viewer, self.manager])
        self.ok(self.post_as(self.manager, self.url(battle_id, "join")))

        data = self.ok(self.decline(self.viewer, battle_id)).data

        self.assertEqual(data["battle"]["status"], "prebattle")  # everyone left had accepted
        self.assertEqual(
            self.statuses(battle_id), ["joined_prebattle", "joined_prebattle", "declined"]
        )  # player, manager, viewer
        self.assertEqual(
            [(event["type"], event["payload_json"]) for event in data["events"]],
            [("participant_declined", {"participant_user_id": self.viewer.id, "reason": "declined"})],
        )
        invite = Notification.objects.get(user=self.viewer, reference_id=str(battle_id))
        self.assertTrue(invite.is_resolved)
        self.assertIn((self.player.id, "battle_invite_declined"), self.notified())
        self.assertNotIn((self.viewer.id, "battle_prebattle_opened"), self.notified())
        self.assertFalse(authorize_private_channel(self.viewer, f"private-battle-{battle_id}"))

        response = self.post_as(self.viewer, self.url(battle_id, "join"))  # a decline is final
        self.assertEqual((response.status_code, response.data["code"]), (400, "invite_declined"))
        self.assertEqual(self.ok(self.decline(self.viewer, battle_id)).data["events"], [])  # again: nothing new

    def test_a_decline_that_leaves_one_player_cancels_the_battle(self):
        battle_id = self.create_battle()

        data = self.ok(self.decline(self.viewer, battle_id)).data

        self.assertEqual(data["battle"]["status"], "canceled")
        self.assertEqual(self.statuses(battle_id), ["canceled_prebattle", "declined"])
        self.assertEqual([event["type"] for event in data["events"]], ["participant_declined", "battle_canceled"])
        self.assertEqual(data["events"][1]["payload_json"], {"canceled_by_user_id": self.viewer.id, "mode": "declined"})
        self.assertFalse(Notification.objects.filter(reference_id=str(battle_id), is_resolved=False).exists())

    def test_decline_is_for_invitees_before_the_battle_starts(self):
        battle_id = self.create_battle()
        response = self.decline(self.player, battle_id)
        self.assertEqual((response.status_code, response.data["code"]), (400, "creator_cannot_decline"))
        self.assertEqual(self.decline(self.outsider, battle_id).status_code, 404)

        self.ok(self.post_as(self.viewer, self.url(battle_id, "join")))  # prebattle opens
        response = self.decline(self.viewer, battle_id)
        self.assertEqual((response.status_code, response.data["code"]), (400, "not_inviting"))
        self.assertFalse(BattleEvent.objects.filter(battle_id=battle_id, type="participant_declined").exists())

    def test_declined_players_are_not_busy(self):
        battle_id = self.create_battle()
        self.ok(self.decline(self.viewer, battle_id))
        data = self.ok(self.post_as(self.player, self.battles_url(), {"participant_user_ids": [self.viewer.id], "scenario": "Ford"}), 201).data  # fmt: skip
        self.assertNotIn("warnings", data)
