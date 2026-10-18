"""A trader who already used his trading action this round warns, never refuses (decision 9, ECON-TWEAK-01).

The offer and the lock go ahead and the acting player's answer carries `warnings`; events never do. The hero
stays spent: only completion spends a trading action, and it records only a hero it actually spent. Dead or
dismissed heroes stay refused (BUG-109): that's data, not a game rule.
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
        return {"code": "trading_action_spent", "message": message, "hero_id": hero.id}

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

    def test_a_spent_hero_locks_with_a_warning_and_stays_spent(self):
        self.offer(self.player, self.trade, trader_id=self.hero.id)

        locked = self.lock(self.player, self.trade)

        self.assertEqual(locked.status_code, 200)
        self.assertEqual(locked.json()["warnings"], [self.warning()])
        self.assertEqual(self.state(self.trade), ("accepted", True, False))
        self.assertIsNone(self.trade.from_trader_spent_id)  # this trade spent nothing
        self.assertNotIn("warnings", self.trade_events.call_args.args[2])  # trade.locked

        self.assertEqual(self.unlock(self.player, self.trade).status_code, 200)
        self.assertFalse(self.trading_action(self.hero))  # still spent
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


class TraderCandidateTests(TradeTestCase):
    """The trader picker lists the sheet's heroes, whose `trading_action` is the spent flag; a completed trade's
    payload names the hero it spent on each side, so the client can mark him without re-reading the sheet."""

    def setUp(self) -> None:
        super().setUp()
        self.trade = self.open_trade()
        self.give_gold(self.warband, 100)
        self.fresh = self.trader(self.warband, name="Fresh")
        self.spent = self.trader(self.warband, name="Spent", trading_action=False)

    def sheet_flags(self) -> dict[str, bool]:
        heroes = self.get_as(self.player, f"/api/warbands/{self.warband.id}/sheet/").json()["heroes"]
        return {hero["name"]: hero["trading_action"] for hero in heroes}

    def test_the_sheet_says_which_candidates_are_spent(self):
        self.assertEqual(self.sheet_flags(), {"Fresh": True, "Spent": False})

    def test_the_completed_payload_names_the_trader_it_spent(self):
        self.offer(self.player, self.trade, trader_id=self.fresh.id)
        self.assertIsNone(self.lock(self.viewer, self.trade).json()["to_trader_spent_id"])  # no trader: nothing spent

        locked = self.lock(self.player, self.trade).json()

        self.assertEqual((locked["status"], locked["from_trader_spent_id"]), ("completed", self.fresh.id))
        self.assertEqual(self.sheet_flags(), {"Fresh": False, "Spent": False})

    def test_nothing_before_completion_names_a_trader_and_a_hero_spent_elsewhere_never_is(self):
        # decision 9 (simplified): the lock used to spend and name the trader; only completion does now
        self.offer(self.player, self.trade, trader_id=self.fresh.id)
        self.assertIsNone(self.lock(self.player, self.trade).json()["from_trader_spent_id"])
        self.assertIsNone(self.trade_events.call_args.args[2]["from_trader_spent_id"])
        self.assertIsNone(self.unlock(self.player, self.trade).json()["from_trader_spent_id"])
        self.assertEqual(self.sheet_flags(), {"Fresh": True, "Spent": False})

        self.offer(self.player, self.trade, trader_id=self.spent.id)
        self.lock(self.viewer, self.trade)
        completed = self.lock(self.player, self.trade).json()

        self.assertEqual((completed["status"], completed["from_trader_spent_id"]), ("completed", None))
        self.assertEqual(self.sheet_flags(), {"Fresh": True, "Spent": False})
