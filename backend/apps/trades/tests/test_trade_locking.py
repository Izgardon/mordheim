"""Locks, traders and completion after pass 2 PR A (BUG-05, BUG-08, BUG-41).

A trader's trading action is spent only when the trade completes (decision 9), so nothing that ends a lock has
anything to give back (see test_trade_trading_actions.py).
"""

from django.utils import timezone

from apps.warbands.models import Hero

from .trade_support import TradeTestCase


class TradeTraderTests(TradeTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.trade = self.open_trade()
        self.give_gold(self.warband, 100)
        self.give_gold(self.rival, 50)
        self.hero = self.trader(self.warband)

    def test_a_refused_offer_keeps_the_lock(self):
        self.offer(self.player, self.trade, trader_id=self.hero.id)
        self.lock(self.player, self.trade)

        response = self.offer(self.player, self.trade, trader_id=self.hero.id, gold=500)

        self.assertEqual((response.status_code, response.json()), (400, {"detail": "Not enough gold."}))
        self.assertEqual((self.state(self.trade), self.trading_action(self.hero)), (("accepted", True, False), True))

    def test_a_trader_who_left_the_roster_since_the_lock_stops_the_completion(self):
        for change in ({"dead": True}, {"dismissed_at": timezone.now()}):
            with self.subTest(change=list(change)):
                hero = self.trader(self.warband, name="Doomed")
                self.offer(self.player, self.trade, trader_id=hero.id)
                self.lock(self.player, self.trade)
                Hero.objects.filter(id=hero.id).update(**change)

                response = self.lock(self.viewer, self.trade)

                self.assertEqual((response.status_code, response.json()["detail"]), (409, "Trader not found."))
                self.assertEqual(self.state(self.trade), ("accepted", False, False))

    def test_a_late_write_leaves_a_finished_trade_alone(self):
        # Writes used to expire any trade past its expiry before checking its status, so a late offer, lock,
        # unlock, accept or decline turned a completed or declined trade into an expired one
        self.lock(self.player, self.trade)
        self.assertEqual(self.lock(self.viewer, self.trade).json()["status"], "completed")
        self.expire(self.trade)
        for user, action in (
            (self.player, "offer"),
            (self.player, "lock"),
            (self.player, "unlock"),
            (self.viewer, "accept"),
            (self.viewer, "decline"),
            (self.player, "close"),
        ):
            with self.subTest(action=action):
                response = self.post_as(user, self.trade_url(self.trade, action))
                self.assertEqual(response.status_code, 400)
                self.assertNotEqual(response.json(), {"detail": "Trade request expired"})
        self.assertEqual(self.get_as(self.player, self.trade_url(self.trade)).json()["status"], "completed")
        self.assertEqual(self.state(self.trade)[0], "completed")
