"""Reported results, notifications and the battle channel characterised (pass 3, step 0).

Fixed: clearing a pending reported result's notification only resolves it (BUG-46, BUG-121); a future battle date
is refused (BATL-TEST-18); the pending results are a routed campaign endpoint (test_battle_reported_results.py).
The battle channel authorises only current members still in the battle (SEC-08, fixed).
"""

from datetime import timedelta
from typing import Any
from unittest import mock

from django.utils import timezone

from apps.battles.models import BattleParticipant
from apps.campaigns.models import CampaignMembership
from apps.notifications.models import Notification
from apps.realtime import services as realtime
from apps.realtime.channel_auth import authorize_private_channel

from .battle_support import BattleTestCase


class ReportedResultTests(BattleTestCase):
    def report(self, **overrides: Any) -> Any:
        body = {
            "participant_user_ids": [self.viewer.id],
            "scenario": "Street Brawl",
            "battle_date": "2026-10-01",
            "winner_warband_ids": [self.warband.id],
        } | overrides
        return self.post_as(self.player, f"{self.battles_url()}report-result/", body)

    def result_notification(self, battle_id: int) -> Notification:
        return Notification.objects.get(
            user=self.viewer, notification_type=Notification.TYPE_BATTLE_RESULT_REQUEST, reference_id=str(battle_id)
        )

    def test_a_future_battle_date_is_refused_and_no_winner_is_allowed(self):
        # BATL-TEST-18 (BUG-46): a future date was accepted. Decision 8: "No winner" records no wins or losses
        tomorrow = (timezone.localdate() + timedelta(days=1)).isoformat()
        response = self.report(battle_date=tomorrow)
        expected: dict[str, Any] = {"detail": "battle_date can't be in the future", "code": "invalid"}
        expected |= {"fields": {"battle_date": ["Pick today or an earlier date."]}}
        self.assertEqual((response.status_code, response.data), (400, expected))
        today = timezone.localdate().isoformat()
        data = self.ok(self.report(battle_date=today), 201).data
        self.assertEqual(
            (data["battle"]["status"], data["battle"]["ended_at"][:10]), ("reported_result_pending", today)
        )
        self.assertEqual(self.statuses(data["battle"]["id"]), ["reported_result_approved", "reported_result_pending"])

        battle_id = self.ok(self.report(winner_warband_ids=[]), 201).data["battle"]["id"]
        self.ok(self.post_as(self.viewer, self.url(battle_id, "approve-result")))
        self.assertEqual(self.battle(battle_id).status, "ended")
        self.assertEqual((self.record(self.warband), self.record(self.rival)), ((None, None), (None, None)))
        complete = self.rival.logs.get(entry_type="complete")
        self.assertEqual(complete.payload, {"result": "no_winner", "with": [], "against": ["Monks"]})

    def test_clear_all_keeps_a_pending_results_notification(self):
        # BUG-46: Clear all declined the result for everyone, without saying so; pass 3 made it only resolve the
        # notification; CAMP-TWEAK-10 (pass 4): it still needs his answer, so Clear all leaves it listed
        battle_id = self.ok(self.report(), 201).data["battle"]["id"]
        sent = self._record_realtime()

        with self.captureOnCommitCallbacks(execute=True):
            self.ok(self.post_as(self.viewer, "/api/notifications/clear-all/"))

        self.assertEqual(self.battle(battle_id).status, "reported_result_pending")
        self.assertEqual(self.statuses(battle_id), ["reported_result_approved", "reported_result_pending"])
        self.assertFalse(self.result_notification(battle_id).is_resolved)
        self.assertFalse([call for call in sent.call_args_list if call.args[1] == "battle_result_updated"])
        self.ok(self.post_as(self.viewer, self.url(battle_id, "approve-result")))  # still answerable
        self.assertEqual(self.battle(battle_id).status, "ended")

    def test_clearing_the_one_notification_only_resolves_it(self):
        # BUG-46
        battle_id = self.ok(self.report(), 201).data["battle"]["id"]

        self.ok(self.post_as(self.viewer, f"/api/notifications/{self.result_notification(battle_id).id}/clear/"))

        self.assertEqual(self.battle(battle_id).status, "reported_result_pending")
        self.assertEqual(self.participant(battle_id, self.viewer).status, "reported_result_pending")

    def test_clearing_a_battle_invite_only_resolves_it(self):
        battle_id = self.create_battle()
        invite = Notification.objects.get(user=self.viewer, reference_id=str(battle_id))

        self.ok(self.post_as(self.viewer, f"/api/notifications/{invite.id}/clear/"))

        invite.refresh_from_db()
        self.assertTrue(invite.is_resolved)
        self.assertEqual(
            (self.battle(battle_id).status, self.statuses(battle_id)), ("inviting", ["accepted", "invited"])
        )

    def _record_realtime(self) -> mock.MagicMock:
        patcher = mock.patch.object(realtime, "send_user_notification", wraps=realtime.send_user_notification)
        recorded = patcher.start()
        self.addCleanup(patcher.stop)
        return recorded


class BattleChannelTests(BattleTestCase):
    def test_only_current_members_still_in_the_battle_are_authorised(self):
        # SEC-08 (battle half): a removed member and a cancelled participant were still authorised, even once the
        # battle was cancelled
        battle_id = self.create_battle()
        channel = f"private-battle-{battle_id}"
        self.assertEqual(
            [
                authorize_private_channel(user, channel)
                for user in (self.player, self.viewer, self.manager, self.outsider)
            ],
            [True, True, False, False],
        )

        BattleParticipant.objects.filter(battle_id=battle_id, user=self.player).update(status="canceled_prebattle")
        CampaignMembership.objects.filter(campaign=self.campaign, user=self.viewer).delete()

        self.assertEqual(
            [authorize_private_channel(user, channel) for user in (self.player, self.viewer)], [False, False]
        )
        BattleParticipant.objects.filter(battle_id=battle_id, user=self.player).update(
            status="reported_result_declined"
        )
        self.assertFalse(authorize_private_channel(self.player, channel))
        self.assertFalse(authorize_private_channel(self.player, f"private-battle-{battle_id + 99}"))
