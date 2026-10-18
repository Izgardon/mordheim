"""Reported results, notifications and the battle channel characterised (pass 3, step 0).

Pinned: Clear and Clear all declining a pending reported result for everyone (BUG-46); the pending-results view
unrouted and N+1 (BUG-46, BATL-TEST-15's baseline); a future battle date accepted (BATL-TEST-18); a removed member
or a cancelled participant still authorised on the battle channel (SEC-08).
"""

from datetime import timedelta
from typing import Any
from unittest import mock

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import get_resolver
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.battles.models import Battle, BattleParticipant
from apps.battles.views.lifecycle import PendingReportedBattleResultRequestsView
from apps.campaigns.models import CampaignMembership
from apps.notifications.models import Notification
from apps.realtime import services as realtime
from apps.realtime.channel_auth import authorize_private_channel

from .battle_support import BattleTestCase


def routed_view_classes() -> set[Any]:
    classes: set[Any] = set()

    def walk(patterns: list[Any]) -> None:
        for pattern in patterns:
            if hasattr(pattern, "url_patterns"):
                walk(pattern.url_patterns)
            else:
                classes.add(getattr(pattern.callback, "view_class", None))

    walk(get_resolver().url_patterns)
    return classes


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

    def test_a_future_battle_date_is_accepted_and_a_winner_is_required(self):
        # Characterises current behaviour (BATL-TEST-18, decision 8, pinned; flips in PR A: a future date is refused
        # and an empty winner list means "No winner")
        tomorrow = (timezone.localdate() + timedelta(days=1)).isoformat()
        data = self.ok(self.report(battle_date=tomorrow), 201).data
        self.assertEqual(
            (data["battle"]["status"], data["battle"]["ended_at"][:10]), ("reported_result_pending", tomorrow)
        )
        self.assertEqual(self.statuses(data["battle"]["id"]), ["reported_result_approved", "reported_result_pending"])

        response = self.report(winner_warband_ids=[])
        self.assertEqual((response.status_code, response.data), (400, {"detail": "Select at least one winner"}))

    def test_clear_all_declines_a_pending_result_for_everyone(self):
        # Characterises current behaviour (BUG-46, pinned; flips in PR A: clearing only resolves the notification)
        battle_id = self.ok(self.report(), 201).data["battle"]["id"]
        sent = self._record_realtime()

        with self.captureOnCommitCallbacks(execute=True):
            self.ok(self.post_as(self.viewer, "/api/notifications/clear-all/"))

        self.assertEqual(self.battle(battle_id).status, "canceled")
        self.assertEqual(self.statuses(battle_id), ["reported_result_approved", "reported_result_declined"])
        self.assertTrue(self.result_notification(battle_id).is_resolved)
        self.assertEqual((self.record(self.warband), self.record(self.rival)), ((None, None), (None, None)))
        updates = sorted(call.args[0] for call in sent.call_args_list if call.args[1] == "battle_result_updated")
        self.assertEqual(updates, sorted([self.player.id, self.viewer.id]))

    def test_clearing_the_one_notification_declines_it_too(self):
        # Characterises current behaviour (BUG-46, pinned; flips in PR A)
        battle_id = self.ok(self.report(), 201).data["battle"]["id"]

        self.ok(self.post_as(self.viewer, f"/api/notifications/{self.result_notification(battle_id).id}/clear/"))

        self.assertEqual(self.battle(battle_id).status, "canceled")
        self.assertEqual(self.participant(battle_id, self.viewer).status, "reported_result_declined")

    def test_clearing_a_battle_invite_only_resolves_it(self):
        battle_id = self.create_battle()
        invite = Notification.objects.get(user=self.viewer, reference_id=str(battle_id))

        self.ok(self.post_as(self.viewer, f"/api/notifications/{invite.id}/clear/"))

        invite.refresh_from_db()
        self.assertTrue(invite.is_resolved)
        self.assertEqual(
            (self.battle(battle_id).status, self.statuses(battle_id)), ("inviting", ["accepted", "invited"])
        )

    def test_the_pending_results_view_is_unrouted_and_costs_a_query_per_result(self):
        # Characterises current behaviour (BUG-46, BATL-TEST-15 baseline, pinned; flips in PR A: a routed campaign
        # endpoint with constant queries)
        self.assertNotIn(PendingReportedBattleResultRequestsView, routed_view_classes())
        view = PendingReportedBattleResultRequestsView.as_view()

        def queries() -> tuple[int, list[int]]:
            request = APIRequestFactory().get("/pending-results/")
            force_authenticate(request, user=self.viewer)
            with CaptureQueriesContext(connection) as captured:
                response = view(request)
            return len(captured), [entry["battle_id"] for entry in response.data]

        first = self.ok(self.report(), 201).data["battle"]["id"]
        one, listed = queries()
        self.assertEqual(listed, [first])
        for _ in range(2):
            self.ok(self.report(), 201)
        three, listed = queries()
        self.assertEqual((len(listed), three - one), (3, 2))

    def _record_realtime(self) -> mock.MagicMock:
        patcher = mock.patch.object(realtime, "send_user_notification", wraps=realtime.send_user_notification)
        recorded = patcher.start()
        self.addCleanup(patcher.stop)
        return recorded


class BattleChannelTests(BattleTestCase):
    def test_a_removed_member_and_a_cancelled_participant_are_still_authorised(self):
        # Characterises current behaviour (SEC-08 battle half, pinned; flips in PR A: current members whose
        # participation wasn't declined or cancelled)
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
            [authorize_private_channel(user, channel) for user in (self.player, self.viewer)], [True, True]
        )
        Battle.objects.filter(id=battle_id).update(status=Battle.STATUS_CANCELED)
        self.assertTrue(authorize_private_channel(self.viewer, channel))  # even once the battle is over
