"""Trade timing (decision 8, BUG-69, ECON-UX-01).

A request waits 10 minutes for an answer. An accepted session stays open 10 minutes after each offer, lock or
unlock by either player, and at most 60 minutes after it was accepted. Responses and events carry the deadline
in force as `expires_at`. The clock is frozen with `at()`, never waited for.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest import mock

from apps.trades.models import TradeRequest

from .trade_support import TradeTestCase

T0 = datetime(2026, 10, 17, 12, 0, tzinfo=UTC)
EXPIRED = (400, {"detail": "Trade request expired"})


def at(minutes: float) -> Any:
    """Freeze `timezone.now()` (the services' clock and auto_now_add) `minutes` after T0."""
    return mock.patch("django.utils.timezone.now", return_value=T0 + timedelta(minutes=minutes))


def after(minutes: float) -> str:
    return (T0 + timedelta(minutes=minutes)).isoformat()


class TradeTimingTests(TradeTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.give_gold(self.warband, 100)

    def _accepted_at_t0(self) -> TradeRequest:
        with at(0):
            trade = self.request_trade()
            self.assertEqual(self.post_as(self.viewer, self.trade_url(trade, "accept")).status_code, 200)
        return trade

    def _answer(self, trade: TradeRequest, minutes: float) -> Any:
        with at(minutes):
            return self.post_as(self.viewer, self.trade_url(trade, "accept"))

    def test_a_request_waits_ten_minutes_for_an_answer(self):
        with at(0):
            late = self.request_trade()
        self.assertEqual(late.expires_at, T0 + timedelta(minutes=10))

        response = self._answer(late, 10)

        self.assertEqual((response.status_code, response.json()), EXPIRED)
        self.assertEqual(self.state(late)[0], "expired")
        with at(10):
            in_time = self.request_trade()
        self.assertEqual(self._answer(in_time, 19.9).status_code, 200)

    def test_accepting_starts_ten_minutes_on_the_sessions_clock(self):
        with at(0):
            trade = self.request_trade()

        response = self._answer(trade, 6)

        self.assertEqual(response.json()["expires_at"], after(16))
        self.assertEqual(self.trade_events.call_args.args[2]["expires_at"], after(16))  # trade.accepted
        self.assertEqual(self.user_events.call_args.args[2]["expires_at"], after(16))  # trade_accepted

    def test_each_offer_lock_or_unlock_keeps_the_session_open_ten_more_minutes(self):
        trade = self._accepted_at_t0()
        steps = [
            (8, self.player, "offer", {"gold": 5}),
            (15, self.viewer, "lock", {}),
            (24, self.viewer, "unlock", {}),
            (33, self.viewer, "offer", {"gold": 0}),
        ]
        for minutes, user, action, body in steps:
            with self.subTest(action=action, minutes=minutes):
                self.trade_events.reset_mock()
                with at(minutes):
                    response = self.post_as(user, self.trade_url(trade, action), body)

                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(response.json()["expires_at"], after(minutes + 10))
                self.assertEqual(self.trade_events.call_args.args[2]["expires_at"], after(minutes + 10))
                trade.refresh_from_db()
                self.assertEqual(trade.expires_at, T0 + timedelta(minutes=minutes + 10))

    def test_a_session_closes_an_hour_after_it_was_accepted_however_busy(self):
        trade = self._accepted_at_t0()
        for minutes in (9, 18, 27, 36, 45, 54, 59.9):
            with at(minutes):
                body = self.offer(self.player, trade, gold=1).json()
            self.assertEqual(body["expires_at"], after(min(minutes + 10, 60)))

        with at(60):
            response = self.offer(self.player, trade, gold=1)

        self.assertEqual((response.status_code, response.json()), EXPIRED)
        self.assertEqual(self.state(trade), ("expired", False, False))

    def test_a_refused_action_or_a_repeat_lock_leaves_the_clock(self):
        trade = self._accepted_at_t0()
        with at(5):
            self.assertEqual(self.offer(self.player, trade, gold=500).status_code, 400)  # more than it has
            trade.refresh_from_db()
            self.assertEqual(trade.expires_at, T0 + timedelta(minutes=10))
            self.assertEqual(self.lock(self.player, trade).json()["expires_at"], after(15))
        with at(9):
            self.assertEqual(self.lock(self.player, trade).json()["expires_at"], after(15))  # nothing changed

    def test_a_session_left_alone_runs_out_ten_minutes_after_its_last_action(self):
        trade = self._accepted_at_t0()
        with at(7):
            self.offer(self.player, trade, gold=1)

        with at(17):
            response = self.lock(self.viewer, trade)

        self.assertEqual((response.status_code, response.json()), EXPIRED)
        self.assertEqual(self.state(trade)[0], "expired")

    def test_a_session_open_at_deploy_keeps_its_acceptance_time(self):
        # opened under the old 5-minute rule: the hour still counts from when it was accepted
        trade = self.make_trade("accepted")
        TradeRequest.objects.filter(id=trade.id).update(
            created_at=T0 - timedelta(minutes=2), responded_at=T0, expires_at=T0 + timedelta(minutes=3)
        )

        with at(2):
            first = self.offer(self.player, trade, gold=1).json()
        with at(55):
            TradeRequest.objects.filter(id=trade.id).update(expires_at=T0 + timedelta(minutes=58))
            last = self.offer(self.player, trade, gold=1).json()

        self.assertEqual((first["expires_at"], last["expires_at"]), (after(12), after(60)))
