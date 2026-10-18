"""A trader who already used his trading action this round warns, never refuses (decision 9, ECON-TWEAK-01).

The offer and the lock go ahead and the acting player's answer carries `warnings`; events never do. The hero
stays spent, and because this trade didn't spend him it records nothing, so unlocking or closing never gives him
an action back. Dead or dismissed heroes stay refused (BUG-109): that's data, not a game rule.
"""

from typing import Any

from django.utils import timezone

from apps.warbands.models import Hero

from .trade_support import TradeTestCase


class TradeSpentTraderTests(TradeTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.trade = self.open_trade()
        self.give_gold(self.warband, 100)
        self.hero = self.trader(self.warband, trading_action=False)  # searched for a rare item this round
        self.trade_events.reset_mock()

    def warning(self, hero: Hero | None = None) -> dict[str, Any]:
        hero = hero or self.hero
        message = f"{hero.name} already used his trading action this round."
        return {"code": "trader_spent", "message": message, "hero_id": hero.id}

    def test_a_spent_hero_can_be_offered_with_a_warning(self):
        response = self.offer(self.player, self.trade, trader_id=self.hero.id, gold=5)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["warnings"], [self.warning()])
        self.assertEqual(
            (body["from_offer"]["trader_id"], body["from_offer"]["trader_name"]), (self.hero.id, "Haggler")
        )
        self.trade.refresh_from_db()
        self.assertEqual(self.trade.from_offer["trader_id"], self.hero.id)
        event = self.trade_events.call_args.args[2]
        self.assertNotIn("warnings", event)
        self.assertEqual(event, {key: value for key, value in body.items() if key != "warnings"})

    def test_an_available_hero_or_no_trader_brings_no_warnings(self):
        fresh = self.trader(self.warband, name="Fresh")
        for body in ({"trader_id": fresh.id}, {"gold": 1}):
            with self.subTest(body=body):
                self.assertNotIn("warnings", self.offer(self.player, self.trade, **body).json())
        self.assertNotIn("warnings", self.lock(self.player, self.trade).json())

    def test_a_spent_hero_locks_with_a_warning_and_is_not_given_back(self):
        self.offer(self.player, self.trade, trader_id=self.hero.id)

        locked = self.lock(self.player, self.trade)

        self.assertEqual(locked.status_code, 200)
        self.assertEqual(locked.json()["warnings"], [self.warning()])
        self.assertEqual(self.state(self.trade), ("accepted", True, False))
        self.assertIsNone(self.trade.from_trader_spent_id)  # this trade spent nothing
        self.assertNotIn("warnings", self.trade_events.call_args.args[2])  # trade.locked

        self.assertEqual(self.unlock(self.player, self.trade).status_code, 200)
        self.assertFalse(self.trading_action(self.hero))  # still spent: no action farmed by lock and unlock
        self.lock(self.player, self.trade)
        self.assertEqual(self.post_as(self.player, self.trade_url(self.trade, "close")).status_code, 200)
        self.assertFalse(self.trading_action(self.hero))

    def test_a_hero_spent_elsewhere_since_the_offer_still_locks_and_completes(self):
        fresh = self.trader(self.warband, name="Fence")
        self.offer(self.player, self.trade, trader_id=fresh.id, gold=10)
        Hero.objects.filter(id=fresh.id).update(trading_action=False)  # another trade spent him meanwhile
        self.assertEqual(self.lock(self.viewer, self.trade).status_code, 200)

        completed = self.lock(self.player, self.trade)

        self.assertEqual(completed.status_code, 200)
        body = completed.json()
        self.assertEqual((body["status"], body["warnings"]), ("completed", [self.warning(fresh)]))
        self.assertIn("from_summary", body)
        self.assertNotIn("warnings", self.trade_events.call_args.args[2])  # trade.completed

    def test_a_dead_or_dismissed_hero_is_still_refused(self):
        for change in ({"dead": True}, {"dismissed_at": timezone.now()}):
            with self.subTest(change=list(change)):
                Hero.objects.filter(id=self.hero.id).update(**{"dead": False, "dismissed_at": None, **change})

                response = self.offer(self.player, self.trade, trader_id=self.hero.id)

                self.assertEqual((response.status_code, response.json()), (400, {"detail": "Trader not found."}))
