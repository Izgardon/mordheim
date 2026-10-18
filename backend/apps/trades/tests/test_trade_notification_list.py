"""GET /api/notifications/ shows a trade-request notification only while the request can be answered (decision 8).

A request that ran out is never written to (no clean-up job), so its notification stays unresolved in the
database; the list filters it out as it reads, in the same single query, and writes nothing.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.notifications.models import Notification
from apps.trades.models import TradeRequest

from .trade_support import TradeTestCase


class TradeNotificationListTests(TradeTestCase):
    def listed(self, user: Any) -> list[tuple[str, str]]:
        response = self.get_as(user, "/api/notifications/")
        self.assertEqual(response.status_code, 200)
        return [(row["notification_type"], row["reference_id"]) for row in response.json()]

    def test_a_request_that_ran_out_drops_out_of_the_list_without_a_write(self):
        live = self.request_trade()
        stale = self.make_trade()  # a second request waiting for viewer, written directly (one per pair via the API)
        for notification_type, reference in ((Notification.TYPE_TRADE_REQUEST, stale.id), ("battle_invite", 7)):
            Notification.objects.create(
                user=self.viewer,
                notification_type=notification_type,
                campaign_id=self.campaign.id,
                reference_id=str(reference),
                payload={},
            )
        self.expire(stale)

        with CaptureQueriesContext(connection) as captured:
            listed = self.listed(self.viewer)

        self.assertEqual(sorted(listed), [("battle_invite", "7"), ("trade_request", str(live.id))])
        self.assertEqual(len(captured), 1)
        self.assertEqual(self.state(stale)[0], "pending")
        self.assertFalse(Notification.objects.get(reference_id=str(stale.id)).is_resolved)

    def test_a_request_no_longer_pending_is_not_listed_even_if_unresolved(self):
        trade = self.request_trade()
        TradeRequest.objects.filter(id=trade.id).update(status=TradeRequest.STATUS_ACCEPTED)

        self.assertEqual(self.listed(self.viewer), [])
