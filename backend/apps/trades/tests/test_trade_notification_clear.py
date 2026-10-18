"""Clearing a trade-request notification answers the request under the trade's row lock (BUG-119)."""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse

from apps.trades.models import TradeRequest

from .trade_support import TradeTestCase


class TradeNotificationClearTests(TradeTestCase):
    def clear(self, trade: TradeRequest) -> Any:
        notification = self.notification(self.viewer, trade)
        return self.post_as(self.viewer, reverse("notifications-clear", args=[notification.id]))

    def test_clearing_declines_a_pending_request(self):
        trade = self.request_trade()

        response = self.clear(trade)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.state(trade)[0], TradeRequest.STATUS_DECLINED)

    def test_clearing_an_overdue_request_expires_it(self):
        trade = self.request_trade()
        self.expire(trade)

        self.clear(trade)

        self.assertEqual(self.state(trade)[0], TradeRequest.STATUS_EXPIRED)

    def test_clearing_leaves_an_accepted_trade_alone(self):
        trade = self.request_trade()
        TradeRequest.objects.filter(id=trade.id).update(status=TradeRequest.STATUS_ACCEPTED)

        self.clear(trade)

        self.assertEqual(self.state(trade)[0], TradeRequest.STATUS_ACCEPTED)

    def test_clearing_reads_the_request_under_its_row_lock(self):
        trade = self.request_trade()

        with CaptureQueriesContext(connection) as captured:
            self.clear(trade)

        reads = [
            query["sql"]
            for query in captured
            if query["sql"].lstrip().upper().startswith("SELECT") and 'FROM "trade_request"' in query["sql"]
        ]
        self.assertTrue(reads)
        self.assertTrue(all("FOR UPDATE" in sql for sql in reads), reads)
