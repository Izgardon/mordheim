"""`manage.py expire_trades` (decision 8, BUG-69): the cron that closes trades that ran out, so reads never write."""

from datetime import timedelta
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.realtime import services as realtime
from apps.trades.models import TradeRequest
from apps.trades.services.lifecycle import expire_due_trades

from .trade_support import TradeTestCase


class ExpireTradesCommandTests(TradeTestCase):
    def setUp(self) -> None:
        super().setUp()
        patcher = mock.patch(
            "apps.trades.services.closing.send_user_notification", wraps=realtime.send_user_notification
        )
        self.closing_events = patcher.start()
        self.addCleanup(patcher.stop)
        # a request that ran out unanswered, and an open session that ran out with the sender's trader spent
        self.pending = self.request_trade()
        self.hero = self.trader(self.warband)
        self.session = self.make_trade("accepted")  # written directly: the API allows one open trade per pair
        self.assertEqual(self.offer(self.player, self.session, trader_id=self.hero.id).status_code, 200)
        self.assertEqual(self.lock(self.player, self.session).status_code, 200)
        self.live = self.make_trade("accepted", from_user=self.viewer, to_user=self.player)
        self.finished = self.make_trade("completed")
        for trade in (self.pending, self.session, self.finished):
            self.expire(trade)
        self.closing_events.reset_mock()

    def run_command(self, *args: str) -> str:
        out = StringIO()
        call_command("expire_trades", *args, stdout=out)
        return out.getvalue()

    def test_due_trades_expire_give_their_traders_back_and_are_closed_out(self):
        self.assertFalse(self.trading_action(self.hero))

        output = self.run_command()

        self.assertEqual(self.state(self.pending), ("expired", False, False))
        self.assertEqual(self.state(self.session), ("expired", False, False))
        self.assertTrue(self.trading_action(self.hero))
        self.assertTrue(self.notification(self.viewer, self.pending).is_resolved)
        closed = sorted((str(call.args[2]["id"]), call.args[0]) for call in self.closing_events.call_args_list)
        expected = [(str(self.pending.id), self.player.id), (str(self.pending.id), self.viewer.id)]
        expected += [(str(self.session.id), self.player.id), (str(self.session.id), self.viewer.id)]
        self.assertEqual(closed, sorted(expected))
        self.assertEqual(self.state(self.live)[0], "accepted")
        self.assertEqual(self.state(self.finished)[0], "completed")
        self.assertTrue(output.startswith("Expired 2 trade(s).\n"), output)
        self.assertIn(str(self.pending.id), output)
        self.assertIn(str(self.session.id), output)

        self.assertEqual(self.run_command(), "Expired 0 trade(s).\n")  # a second run has nothing left

    def test_a_dry_run_lists_the_due_trades_and_changes_nothing(self):
        with CaptureQueriesContext(connection) as captured:
            output = self.run_command("--dry-run")

        self.assertEqual(len(captured), 1)  # one read
        self.assertTrue(output.startswith("Would expire 2 trade(s).\n"), output)
        self.assertIn(f"{self.pending.id} pending Monks -> Rats", output)
        self.assertIn(f"{self.session.id} accepted Monks -> Rats", output)
        self.assertEqual((self.state(self.pending)[0], self.state(self.session)[0]), ("pending", "accepted"))
        self.assertFalse(self.trading_action(self.hero))
        self.closing_events.assert_not_called()

    def test_a_trade_extended_after_it_was_listed_stays_open(self):
        # listed as due, then a player's action extended it before the expiry took its lock
        TradeRequest.objects.filter(id=self.session.id).update(expires_at=timezone.now() + timedelta(minutes=5))

        expired = expire_due_trades([self.session.id, self.pending.id])

        self.assertEqual([trade.id for trade in expired], [self.pending.id])
        self.assertEqual(self.state(self.session), ("accepted", True, False))
        self.assertFalse(self.trading_action(self.hero))
