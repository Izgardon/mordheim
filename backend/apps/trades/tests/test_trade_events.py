"""Realtime trade events after pass 2 PR A (ECON-PERF-02).

A write that sends `X-Pusher-Socket-Id` gets its answer over HTTP, so the events it causes skip that socket;
`trade.completed` carries both warbands' summaries, so neither browser re-reads its own.
"""

from typing import Any
from unittest import mock

from apps.realtime.services import send_trade_event

from .trade_support import TradeTestCase


class TradeEventTests(TradeTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.trade = self.open_trade()
        self.give_gold(self.warband, 100)
        self.give_gold(self.rival, 50)
        self.stash(self.warband, self.sword, 2, cost=9)
        self.trade_events.reset_mock()

    def _offer_from(self, socket_header: str | None) -> Any:
        self.client.force_authenticate(user=self.player)
        extra: dict[str, Any] = {} if socket_header is None else {"HTTP_X_PUSHER_SOCKET_ID": socket_header}
        return self.client.post(self.trade_url(self.trade, "offer"), {"gold": 5}, format="json", **extra).json()

    def test_a_write_names_the_senders_socket_so_its_own_events_skip_it(self):
        body = self._offer_from("1234.5678")

        self.trade_events.assert_called_once_with(self.trade.id, "trade.offer_updated", body, socket_id="1234.5678")

    def test_a_missing_or_malformed_socket_id_sends_to_everyone(self):
        for header in (None, "abc", "1234", "1.2.3", " ", "12.34; drop"):
            with self.subTest(header=header):
                self.trade_events.reset_mock()
                body = self._offer_from(header)
                self.trade_events.assert_called_once_with(self.trade.id, "trade.offer_updated", body, socket_id=None)

    def test_pusher_is_asked_to_skip_the_named_socket(self):
        with mock.patch("apps.realtime.services.get_pusher_client") as get_client:
            with self.captureOnCommitCallbacks(execute=True):
                send_trade_event(self.trade.id, "trade.locked", {"n": 1}, socket_id="1.2")
                send_trade_event(self.trade.id, "trade.locked", {"n": 2})

        channel, data = f"private-trade-{self.trade.id}", {"type": "trade.locked", "payload": {"n": 1}}
        self.assertEqual(
            get_client.return_value.trigger.call_args_list,
            [
                mock.call(channel, "trade.event", data, socket_id="1.2"),
                mock.call(channel, "trade.event", {"type": "trade.locked", "payload": {"n": 2}}),
            ],
        )

    def test_a_completed_trade_carries_both_warbands_summaries(self):
        self.offer(self.player, self.trade, gold=30, items=[{"id": self.sword.id, "quantity": 1}])
        self.lock(self.player, self.trade)

        body = self.lock(self.viewer, self.trade).json()

        self.assertEqual(body["status"], "completed")
        self.assertEqual(
            body["from_summary"], self.get_as(self.player, f"/api/warbands/{self.warband.id}/summary/").json()
        )
        self.assertEqual(body["to_summary"], self.get_as(self.viewer, f"/api/warbands/{self.rival.id}/summary/").json())
        self.assertEqual((body["from_summary"]["gold"], body["to_summary"]["gold"]), (70, 80))
        self.assertEqual(self.trade_events.call_args_list[-1].args, (self.trade.id, "trade.completed", body))
        self.assertNotIn("from_summary", self.trade_events.call_args_list[-2].args[2])  # trade.locked stays as it was
