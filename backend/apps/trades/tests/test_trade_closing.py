"""Every way a trade ends resolves its notifications and tells both players (decision 8, BUG-69).

Completed, declined, cancelled or expired: the recipient's trade-request notification is resolved in the same
transaction and both players get a `trade_closed` user event, after commit, carrying the trade as it ended.
"""

from collections.abc import Callable
from typing import Any
from unittest import mock

from django.urls import reverse

from apps.notifications.models import Notification
from apps.realtime import services as realtime
from apps.trades.models import TradeRequest

from .trade_support import TradeTestCase


class TradeClosingTests(TradeTestCase):
    def setUp(self) -> None:
        super().setUp()
        patcher = mock.patch(
            "apps.trades.services.closing.send_user_notification", wraps=realtime.send_user_notification
        )
        self.closing_events = patcher.start()
        self.addCleanup(patcher.stop)
        self.give_gold(self.warband, 10)

    def _closed_events(self) -> list[tuple[int, dict[str, Any]]]:
        return [(call.args[0], call.args[2]) for call in self.closing_events.call_args_list]

    def _assert_closed(self, trade: TradeRequest, status: str) -> None:
        self.assertEqual(self.state(trade)[0], status)
        self.assertTrue(self.notification(self.viewer, trade).is_resolved)
        events = self._closed_events()
        self.assertEqual([user_id for user_id, _ in events], [self.player.id, self.viewer.id])
        self.assertEqual({payload["status"] for _, payload in events}, {status})
        self.assertTrue(all(payload["id"] == str(trade.id) for _, payload in events))
        self.assertTrue(all(call.args[1] == "trade_closed" for call in self.closing_events.call_args_list))

    def _clear_notification(self, trade: TradeRequest) -> Any:
        notification = self.notification(self.viewer, trade)
        return self.post_as(self.viewer, reverse("notifications-clear", args=[notification.id]))

    def test_a_request_closed_by_either_player_or_a_cleared_notification(self):
        cases: list[tuple[str, Callable[[TradeRequest], Any], str]] = [
            ("declined", lambda t: self.post_as(self.viewer, self.trade_url(t, "decline")), "declined"),
            ("cancelled by its sender", lambda t: self.post_as(self.player, self.trade_url(t, "close")), "cancelled"),
            ("closed by its recipient", lambda t: self.post_as(self.viewer, self.trade_url(t, "close")), "declined"),
            ("notification cleared", self._clear_notification, "declined"),
        ]
        for name, finish, status in cases:
            with self.subTest(name):
                trade = self.request_trade()
                self.closing_events.reset_mock()

                self.assertEqual(finish(trade).status_code, 200)

                self._assert_closed(trade, status)

    def test_a_request_or_session_that_ran_out(self):
        for name in ("late answer", "late offer", "notification cleared"):
            with self.subTest(name):
                trade = self.request_trade()
                if name == "late offer":
                    self.assertEqual(self.post_as(self.viewer, self.trade_url(trade, "accept")).status_code, 200)
                self.expire(trade)
                self.closing_events.reset_mock()

                if name == "late answer":
                    response = self.post_as(self.viewer, self.trade_url(trade, "accept"))
                elif name == "late offer":
                    response = self.offer(self.player, trade, gold=1)
                else:
                    response = self._clear_notification(trade)

                self.assertEqual(response.status_code, 200 if name == "notification cleared" else 400)
                self._assert_closed(trade, "expired")

    def test_an_open_trade_closed_or_completed(self):
        for name, status in (("closed", "declined"), ("completed", "completed")):
            with self.subTest(name):
                trade = self.open_trade()
                self.assertEqual(self.offer(self.player, trade, gold=10).status_code, 200)
                self.closing_events.reset_mock()

                if name == "closed":
                    self.assertEqual(self.post_as(self.viewer, self.trade_url(trade, "close")).status_code, 200)
                else:
                    self.assertEqual(self.lock(self.player, trade).status_code, 200)
                    self.assertEqual(self._closed_events(), [])  # one lock doesn't end it
                    self.assertEqual(self.lock(self.viewer, trade).json()["status"], "completed")

                self._assert_closed(trade, status)

    def test_either_player_closing_an_open_trade_ends_it_for_both(self):
        # the sender's close cancels it, the recipient's declines it; either way both players are told and the
        # other one can no longer act on it
        for closer, partner, status in (
            (self.player, self.viewer, "cancelled"),
            (self.viewer, self.player, "declined"),
        ):
            with self.subTest(closer=closer.email):
                trade = self.open_trade()
                self.assertEqual(self.offer(partner, trade, gold=0).status_code, 200)
                self.closing_events.reset_mock()
                self.trade_events.reset_mock()

                response = self.post_as(closer, self.trade_url(trade, "close"))

                self.assertEqual((response.status_code, response.json()["status"]), (200, status))
                self._assert_closed(trade, status)
                self.assertEqual(self.event_names(), ["trade.closed"])
                for action in ("offer", "lock"):
                    late = self.post_as(partner, self.trade_url(trade, action), {"gold": 0})
                    self.assertEqual((late.status_code, late.json()), (400, {"detail": "Trade is not active"}))
                self.assertEqual(self.get_as(partner, self.trade_url(trade)).json()["status"], status)

    def test_nothing_is_closed_out_while_the_trade_goes_on_or_when_a_close_is_refused(self):
        trade = self.request_trade()
        self.assertEqual(self.post_as(self.viewer, self.trade_url(trade, "accept")).status_code, 200)
        self.offer(self.player, trade, gold=1)
        self.lock(self.player, trade)
        self.unlock(self.player, trade)
        self.assertEqual(self._closed_events(), [])

        TradeRequest.objects.filter(id=trade.id).update(status=TradeRequest.STATUS_COMPLETED)
        self.assertEqual(self.post_as(self.player, self.trade_url(trade, "close")).status_code, 400)
        self.assertEqual(self._closed_events(), [])

    def test_the_event_goes_out_after_commit(self):
        trade = self.request_trade()
        with mock.patch("apps.realtime.services.get_pusher_client") as get_client:
            with self.captureOnCommitCallbacks(execute=False) as queued:
                self.post_as(self.player, self.trade_url(trade, "close"))
            get_client.return_value.trigger.assert_not_called()
            for callback in queued:
                callback()

        triggered = [call.args for call in get_client.return_value.trigger.call_args_list]
        closed = [
            (channel, data["payload"]["status"]) for channel, _, data in triggered if data["type"] == "trade_closed"
        ]
        self.assertEqual(
            closed,
            [
                (f"private-user-{self.player.id}-notifications", "cancelled"),
                (f"private-user-{self.viewer.id}-notifications", "cancelled"),
            ],
        )
        self.assertEqual(Notification.objects.filter(is_resolved=False).count(), 0)
