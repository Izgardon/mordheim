"""A battle's activity and deadlines (BUG-10, decisions 1 and 2, BATL-NEW-02).

`last_activity_at` moves with every battle write; `closes_at` is 72 hours from creation for the invitation, none in
prebattle or active, and 72 hours from End battle for postbattle. Reading a battle reports `overdue` and writes
nothing.
"""

from datetime import timedelta

from django.utils import timezone

from apps.battles.models import Battle, BattleParticipant
from apps.warbands.models import Warband

from .battle_support import BattleTestCase, draft


class BattleDeadlineTests(BattleTestCase):
    def test_the_invitation_and_postbattle_each_have_72_hours(self):
        before = timezone.now()
        battle_id = self.create_battle()
        closes_at = self.battle(battle_id).closes_at
        assert closes_at is not None
        self.assertTrue(before + timedelta(hours=72) <= closes_at <= timezone.now() + timedelta(hours=72))

        self.ok(self.post_as(self.viewer, self.url(battle_id, "join")))
        self.assertIsNone(self.battle(battle_id).closes_at)  # prebattle and active: no deadline
        for user in (self.player, self.viewer):
            self.ok(self.post_as(user, self.url(battle_id, "ready"), {"ready": True}))
        self.ok(self.post_as(self.player, self.url(battle_id, "start")))
        self.assertIsNone(self.battle(battle_id).closes_at)

        ended = timezone.now()
        data = self.finish(battle_id, [self.warband]).data
        closes_at = self.battle(battle_id).closes_at
        assert closes_at is not None
        self.assertTrue(ended + timedelta(hours=72) <= closes_at <= timezone.now() + timedelta(hours=72))
        self.assertEqual((data["battle"]["closes_at"], data["battle"]["overdue"]), (closes_at.isoformat(), False))

    def test_a_read_reports_an_overdue_battle_without_writing(self):
        battle_id = self.create_battle()
        past = timezone.now() - timedelta(minutes=1)
        Battle.objects.filter(id=battle_id).update(closes_at=past)

        data = self.ok(self.get_as(self.player, self.url(battle_id, "state"))).data

        self.assertEqual((data["battle"]["status"], data["battle"]["overdue"]), ("inviting", True))
        self.assertEqual(self.statuses(battle_id), ["accepted", "invited"])

    def test_every_write_moves_the_last_activity(self):
        battle_id = self.to_postbattle()
        for action, user, body in (
            ("config", self.player, {"battle_notes": "only mine"}),  # not broadcast, but activity
            ("postbattle", self.viewer, {"postbattle_json": draft({})}),
            ("finalize-postbattle", self.player, {"postbattle_json": draft({})}),
        ):
            with self.subTest(action=action):
                long_ago = timezone.now() - timedelta(days=6)
                Battle.objects.filter(id=battle_id).update(last_activity_at=long_ago)
                self.ok(self.post_as(user, self.url(battle_id, action), body))
                self.assertGreater(self.battle(battle_id).last_activity_at, long_ago)


class BusyPlayersTests(BattleTestCase):
    def test_players_say_which_battle_keeps_a_player_busy(self):
        # BUG-10, decision 1: the /players/ busy entry carries the battle's id, status and last activity
        Warband.objects.create(campaign=self.campaign, user=self.manager, name="Crows", faction="X")
        battle_id = self.create_battle()
        BattleParticipant.objects.filter(battle_id=battle_id, user=self.viewer).update(status="invited")

        players = {entry["id"]: entry for entry in self.ok(self.get_as(self.player, f"/api/campaigns/{self.campaign.id}/players/")).data}  # fmt: skip

        battle = self.battle(battle_id)
        viewer = players[self.viewer.id]
        self.assertEqual(
            (viewer["battle_busy"], viewer["battle_busy_status"], viewer["battle_busy_battle_id"]),
            (True, "inviting", battle_id),
        )
        self.assertEqual(
            viewer["battle_busy_last_activity_at"].replace("Z", "+00:00"), battle.last_activity_at.isoformat()
        )
        manager = players[self.manager.id]
        self.assertEqual(
            (manager["battle_busy"], manager["battle_busy_battle_id"], manager["battle_busy_last_activity_at"]),
            (False, None, None),
        )
