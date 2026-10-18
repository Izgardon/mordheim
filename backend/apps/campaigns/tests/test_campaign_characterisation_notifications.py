"""Clearing notifications that aren't battle results (IMP-78; CAMP-TWEAK-10).

Clear all resolves every unresolved notification the user has and, on the way, answers what they could still
answer: a pending trade request is declined (or expired, if it ran out). Battle-result requests are pass 3's and are
characterised in `apps/battles/tests`. The decline's event to the requester goes out on commit; the helper is
wrapped (still run, Pusher is off) to record it.
"""

from datetime import timedelta
from typing import Any
from unittest import mock

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.notifications.models import Notification
from apps.realtime import services as realtime
from apps.trades.models import TradeRequest

from .campaign_support import CampaignTestCase


class NotificationClearTests(CampaignTestCase):
    def setUp(self) -> None:
        super().setUp()
        patcher = mock.patch("apps.realtime.services.send_user_notification", wraps=realtime.send_user_notification)
        self.user_events = patcher.start()
        self.addCleanup(patcher.stop)

    def request_trade(self) -> TradeRequest:
        """A trade request from rival to player through the API (player gets the notification)."""
        response = self.post_as(self.rival, self.url("trade-requests/"), {"target_user_id": self.player.id})
        self.assertEqual(response.status_code, 201, response.data)
        return TradeRequest.objects.get(id=response.json()["id"])

    def extra_trade(self) -> TradeRequest:
        """Another request from rival to player, written directly (the API allows one open trade per pair)."""
        trade = TradeRequest.objects.create(
            campaign=self.campaign,
            from_user=self.rival,
            to_user=self.player,
            from_warband=self.rival_warband,
            to_warband=self.warband,
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        self.notify(self.player, Notification.TYPE_TRADE_REQUEST, trade.id)
        return trade

    def clear_all(self, user: Any) -> Any:
        with self.captureOnCommitCallbacks(execute=True):
            return self.post_as(user, "/api/notifications/clear-all/")

    def status(self, trade: TradeRequest) -> str:
        trade.refresh_from_db()
        return trade.status

    def test_clear_all_resolves_everything_and_declines_pending_trade_requests(self):
        # Characterises current behaviour (IMP-78, pinned; flips in PR C: CAMP-TWEAK-10, Clear all never declines)
        trade = self.request_trade()
        self.notify(self.player, Notification.TYPE_BATTLE_INVITE, 41)
        self.notify(self.player, Notification.TYPE_BATTLE_INVITE, 7, campaign=self.elsewhere)
        self.notify(self.rival, Notification.TYPE_BATTLE_INVITE, 41)

        response = self.clear_all(self.player)

        self.assertEqual((response.status_code, response.json()), (200, {"ok": True}))
        self.assertEqual(self.listed_notifications(self.player), [])
        rows = Notification.objects.filter(user=self.player)
        self.assertEqual(sorted((row.is_resolved, row.resolved_at is not None) for row in rows), [(True, True)] * 3)
        self.assertEqual(self.status(trade), TradeRequest.STATUS_DECLINED)
        self.assertIsNotNone(trade.responded_at)
        declined = [call.args for call in self.user_events.call_args_list if call.args[1] == "trade_declined"]
        self.assertEqual(
            [(user_id, payload["status"]) for user_id, _, payload in declined], [(self.rival.id, "declined")]
        )
        self.assertEqual(
            self.listed_notifications(self.rival),
            [(Notification.TYPE_BATTLE_INVITE, "41", self.campaign.id)],
        )

    def test_clear_all_expires_a_request_that_ran_out_and_leaves_one_already_answered(self):
        overdue = self.request_trade()
        TradeRequest.objects.filter(id=overdue.id).update(expires_at=timezone.now() - timedelta(minutes=1))
        accepted = self.extra_trade()
        TradeRequest.objects.filter(id=accepted.id).update(status=TradeRequest.STATUS_ACCEPTED)

        self.clear_all(self.player)

        self.assertEqual(self.status(overdue), TradeRequest.STATUS_EXPIRED)
        self.assertEqual(self.status(accepted), TradeRequest.STATUS_ACCEPTED)
        self.assertFalse(Notification.objects.filter(user=self.player, is_resolved=False).exists())
        self.assertNotIn("trade_declined", [call.args[1] for call in self.user_events.call_args_list])

    def test_a_removed_player_still_declines_through_clear_all(self):
        # Characterises current behaviour (BUG-50, pinned; flips in PR A, where removal closes the trade and resolves
        # the notifications): the trade endpoints answer 404 to a player who left, but the clear only checks to_user
        trade = self.request_trade()
        self.delete_as(self.owner, self.url(f"members/{self.player.id}/"))
        self.assertEqual(self.post_as(self.player, self.url(f"trade-requests/{trade.id}/decline/")).status_code, 404)

        self.clear_all(self.player)

        self.assertEqual(self.status(trade), TradeRequest.STATUS_DECLINED)

    def test_clearing_one_notification_needs_an_unresolved_one_of_your_own(self):
        mine = self.notify(self.player, Notification.TYPE_BATTLE_INVITE, 41)
        other = self.notify(self.player, Notification.TYPE_BATTLE_INVITE, 42)
        theirs = self.notify(self.rival, Notification.TYPE_BATTLE_INVITE, 41)

        self.assertEqual(self.post_as(self.player, f"/api/notifications/{theirs.id}/clear/").status_code, 404)
        self.assertEqual(self.post_as(self.player, f"/api/notifications/{mine.id}/clear/").json(), {"ok": True})
        self.assertEqual(self.post_as(self.player, f"/api/notifications/{mine.id}/clear/").status_code, 404)

        self.assertEqual(
            self.listed_notifications(self.player),
            [(Notification.TYPE_BATTLE_INVITE, str(other.reference_id), self.campaign.id)],
        )
        self.assertFalse(Notification.objects.get(id=theirs.id).is_resolved)

    def test_clear_all_costs_a_constant_four_queries_plus_three_per_pending_trade_request(self):
        def clear_all_queries() -> int:
            with CaptureQueriesContext(connection) as captured:
                self.clear_all(self.player)
            return len(captured)

        for reference in range(5):
            self.notify(self.player, Notification.TYPE_BATTLE_INVITE, reference)
        invites_only = clear_all_queries()  # read, SAVEPOINT, one UPDATE, RELEASE
        self.extra_trade()
        self.extra_trade()
        two_trades = clear_all_queries()

        self.assertEqual(invites_only, 4)
        self.assertEqual(two_trades - invites_only, 2 * 3)  # each: the locked request, its UPDATE, its notifications
