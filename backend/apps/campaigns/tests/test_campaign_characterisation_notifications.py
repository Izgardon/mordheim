"""Clearing notifications that aren't battle results (IMP-78; CAMP-TWEAK-10).

Clear all resolves only the notifications that can no longer be answered and answers nothing: a pending trade
request, an invitation to a battle still inviting and a nudge about an open battle stay listed. It used to resolve
everything and decline pending trade requests on the way. Clearing one notification still declines a pending trade
request. Battle-result requests are pass 3's and are characterised in `apps/battles/tests`. Events to the requester go
out on commit; the helper is wrapped (still run, Pusher is off) to record them.
"""

from datetime import timedelta
from typing import Any
from unittest import mock

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.battles.models import Battle
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

    def test_clear_all_keeps_what_still_needs_an_answer_and_declines_nothing(self):
        # IMP-78, CAMP-TWEAK-10: Clear all used to resolve everything and decline pending trade requests on the way
        trade = self.request_trade()
        inviting = self.open_battle(Battle.STATUS_INVITING)
        gone = self.open_battle(Battle.STATUS_CANCELED)
        for battle in (inviting, gone):
            self.notify(self.player, Notification.TYPE_BATTLE_INVITE, battle.id)
            Notification.objects.create(
                user=self.player,
                notification_type=Notification.TYPE_BATTLE_NUDGE,
                campaign_id=self.campaign.id,
                reference_id=str(battle.id),
                payload={},
            )
        self.notify(self.player, Notification.TYPE_BATTLE_INVITE, 999999, campaign=self.elsewhere)
        self.notify(self.rival, Notification.TYPE_BATTLE_INVITE, inviting.id)

        response = self.clear_all(self.player)

        self.assertEqual((response.status_code, response.json()), (200, {"ok": True, "cleared": 3, "kept": 3}))
        self.assertEqual(
            self.listed_notifications(self.player),
            [
                (Notification.TYPE_BATTLE_INVITE, str(inviting.id), self.campaign.id),
                (Notification.TYPE_BATTLE_NUDGE, str(inviting.id), self.campaign.id),
                (Notification.TYPE_TRADE_REQUEST, str(trade.id), self.campaign.id),
            ],
        )
        self.assertEqual(self.status(trade), TradeRequest.STATUS_PENDING)
        self.assertNotIn("trade_declined", [call.args[1] for call in self.user_events.call_args_list])
        self.assertEqual(
            self.listed_notifications(self.rival),
            [(Notification.TYPE_BATTLE_INVITE, str(inviting.id), self.campaign.id)],
        )

    def test_clear_all_resolves_requests_that_ran_out_or_were_answered_and_leaves_the_trades_alone(self):
        overdue = self.request_trade()
        TradeRequest.objects.filter(id=overdue.id).update(expires_at=timezone.now() - timedelta(minutes=1))
        accepted = self.extra_trade()
        TradeRequest.objects.filter(id=accepted.id).update(status=TradeRequest.STATUS_ACCEPTED)

        self.assertEqual(self.clear_all(self.player).json(), {"ok": True, "cleared": 2, "kept": 0})

        self.assertEqual(self.status(overdue), TradeRequest.STATUS_PENDING)  # it reads as expired; nothing wrote it
        self.assertEqual(self.status(accepted), TradeRequest.STATUS_ACCEPTED)
        self.assertFalse(Notification.objects.filter(user=self.player, is_resolved=False).exists())
        self.assertNotIn("trade_declined", [call.args[1] for call in self.user_events.call_args_list])

    def test_removal_closes_the_trade_and_resolves_its_notification_first(self):
        # BUG-50: a removed player's Clear all used to decline a request in the campaign he had left; removal now
        # closes the trade (declined, he was its recipient) and resolves the notification, so Clear all finds nothing
        trade = self.request_trade()
        with self.captureOnCommitCallbacks(execute=True):
            self.delete_as(self.owner, self.url(f"members/{self.player.id}/"))

        self.assertEqual(self.status(trade), TradeRequest.STATUS_DECLINED)
        self.assertFalse(Notification.objects.filter(user=self.player, is_resolved=False).exists())
        self.assertEqual(self.listed_notifications(self.player), [])
        self.assertEqual(self.post_as(self.player, self.url(f"trade-requests/{trade.id}/decline/")).status_code, 404)

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

    def test_clear_all_costs_two_queries_whatever_it_clears(self):
        # one UPDATE that leaves out, in subqueries, what still needs an answer, and one COUNT of what stays listed;
        # it was 4 queries plus 3 per pending trade request
        for reference in range(5):
            self.notify(self.player, Notification.TYPE_BATTLE_INVITE, reference)
        self.extra_trade()
        self.extra_trade()

        with CaptureQueriesContext(connection) as captured:
            response = self.clear_all(self.player)

        self.assertEqual(response.json(), {"ok": True, "cleared": 5, "kept": 2})
        self.assertEqual(len(captured), 2)
