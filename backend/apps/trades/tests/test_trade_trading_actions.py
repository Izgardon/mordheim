"""A trader's trading action is spent only when the trade completes (decision 9, simplified 2026-10-18).

Offering and locking only record the chosen trader. Completion spends each side's trader once (guarded UPDATE)
and records the hero it spent. So unlocking, a new offer, a failed completion, cancelling, declining and expiry
leave every hero's trading action as it was: there is nothing to give back.
"""

from collections.abc import Callable
from io import StringIO
from typing import Any

from django.core.management import call_command

from apps.trades.models import TradeRequest
from apps.warbands.models import Hero

from .trade_support import TradeTestCase


class TradeTradingActionTests(TradeTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.give_gold(self.warband, 100)
        self.haggler = self.trader(self.warband)
        self.fence = self.trader(self.rival, name="Fence")
        self.spent = self.trader(self.warband, name="Spent", trading_action=False)  # used elsewhere this round

    def actions(self) -> dict[str, bool]:
        return dict(Hero.objects.order_by("name").values_list("name", "trading_action"))

    def both_locked_with_traders(self) -> TradeRequest:
        trade = self.open_trade()
        self.assertEqual(self.offer(self.player, trade, trader_id=self.haggler.id, gold=10).status_code, 200)
        self.assertEqual(self.offer(self.viewer, trade, trader_id=self.fence.id).status_code, 200)
        self.assertEqual(self.lock(self.viewer, trade).status_code, 200)
        return trade

    def test_offering_and_locking_spend_nothing(self):
        before = self.actions()
        trade = self.open_trade()
        self.offer(self.player, trade, trader_id=self.haggler.id)
        self.offer(self.viewer, trade, trader_id=self.fence.id)

        self.assertEqual(self.lock(self.player, trade).status_code, 200)

        self.assertEqual(self.actions(), before)
        self.assertEqual((self.state(trade), trade.from_trader_spent_id), (("accepted", True, False), None))

    def test_cancel_decline_unlock_and_expiry_leave_trading_actions_untouched(self):
        def expire_on_write(trade: TradeRequest) -> Any:
            self.expire(trade)
            return self.offer(self.player, trade, gold=1)

        def expire_by_command(trade: TradeRequest) -> Any:
            self.expire(trade)
            call_command("expire_trades", stdout=StringIO())
            return None

        endings: list[tuple[str, Callable[[TradeRequest], Any], str]] = [
            ("cancelled by the sender", lambda t: self.post_as(self.player, self.trade_url(t, "close")), "cancelled"),
            ("declined by the recipient", lambda t: self.post_as(self.viewer, self.trade_url(t, "close")), "declined"),
            ("unlocked", lambda t: self.unlock(self.viewer, t), "accepted"),
            ("expired on a write", expire_on_write, "expired"),
            ("expired by expire_trades", expire_by_command, "expired"),
        ]
        for name, end, status in endings:
            with self.subTest(name):
                trade = self.both_locked_with_traders()
                before = self.actions()

                end(trade)

                self.assertEqual(self.state(trade)[0], status)
                self.assertEqual(self.actions(), before)
                self.assertEqual((trade.from_trader_spent_id, trade.to_trader_spent_id), (None, None))
                if status == "accepted":
                    self.post_as(self.player, self.trade_url(trade, "close"))

    def test_a_failed_completion_spends_nothing(self):
        trade = self.both_locked_with_traders()
        self.give_gold(self.warband, -95)  # can no longer pay the 10 gc offered
        before = self.actions()

        response = self.lock(self.player, trade)

        self.assertEqual((response.status_code, response.json()["code"]), (409, "trade_completion_failed"))
        self.assertEqual(self.actions(), before)

    def test_completion_spends_each_sides_trader_once_and_records_him(self):
        trade = self.both_locked_with_traders()

        body = self.lock(self.player, trade).json()

        self.assertEqual(body["status"], "completed")
        self.assertEqual(self.actions(), {"Fence": False, "Haggler": False, "Spent": False})
        self.assertEqual((body["from_trader_spent_id"], body["to_trader_spent_id"]), (self.haggler.id, self.fence.id))
        self.assertEqual(self.trade_events.call_args.args[2]["from_trader_spent_id"], self.haggler.id)

    def test_a_trader_who_already_traded_completes_without_being_recorded(self):
        trade = self.open_trade()
        self.offer(self.player, trade, trader_id=self.spent.id)
        self.lock(self.viewer, trade)

        body = self.lock(self.player, trade).json()

        self.assertEqual((body["status"], body["from_trader_spent_id"]), ("completed", None))
        self.assertEqual([warning["code"] for warning in body["warnings"]], ["trader_spent"])
        self.assertEqual(self.actions(), {"Fence": True, "Haggler": True, "Spent": False})
