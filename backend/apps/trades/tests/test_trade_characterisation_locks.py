"""Characterisation: locking, unlocking and completing a trade (pass 2, step 0).

Lock is `POST .../lock/` (the view is CampaignTradeOfferAcceptView); the second lock completes the trade
in the same request.
"""

from django.utils import timezone

from apps.items.models import Item
from apps.warbands.models import Hero, WarbandItem, WarbandLog
from apps.warbands.services.summary import warband_gold
from apps.warbands.utils.trades import TradeHelper

from .trade_support import TradeTestCase


class TradeLockTests(TradeTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.trade = self.open_trade()
        self.give_gold(self.warband, 100)
        self.give_gold(self.rival, 50)
        self.trade_events.reset_mock()

    def test_locking_one_side_spends_its_trader_and_waits_for_the_other(self):
        hero = self.trader(self.warband)
        self.assertEqual(self.offer(self.player, self.trade, trader_id=hero.id, gold=10).status_code, 200)

        response = self.lock(self.player, self.trade)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual((body["status"], body["from_accepted"], body["to_accepted"]), ("accepted", True, False))
        self.assertEqual(self.state(self.trade), ("accepted", True, False))
        self.assertFalse(self.trading_action(hero))
        self.assertEqual(self.trade_events.call_args_list[-1].args, (self.trade.id, "trade.locked", body))

    def test_locking_twice_spends_the_trader_once(self):
        hero = self.trader(self.warband)
        self.offer(self.player, self.trade, trader_id=hero.id)
        self.assertEqual(self.lock(self.player, self.trade).status_code, 200)

        response = self.lock(self.player, self.trade)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.state(self.trade), ("accepted", True, False))

    def test_a_trader_spent_or_dismissed_since_the_offer_cannot_lock(self):
        for change, detail in (
            ({"trading_action": False}, "Selected trader is unavailable."),
            ({"dismissed_at": timezone.now()}, "Trader not found."),
        ):
            with self.subTest(change=list(change)):
                hero = self.trader(self.warband)
                self.assertEqual(self.offer(self.player, self.trade, trader_id=hero.id).status_code, 200)
                Hero.objects.filter(id=hero.id).update(**change)

                response = self.lock(self.player, self.trade)

                self.assertEqual((response.status_code, response.json()), (400, {"detail": detail}))
                self.assertEqual(self.state(self.trade), ("accepted", False, False))

    def test_a_lock_is_not_tied_to_the_offer_it_was_shown(self):
        # Characterises current behaviour (BUG-35, pinned; flips in PR A; ECON-TEST-07): a lock carries no offer
        # identity, so a lock sent after the other side changed its offer locks the new offer
        self.assertEqual(self.offer(self.player, self.trade, gold=10).status_code, 200)
        shown = self.get_as(self.viewer, self.trade_url(self.trade)).json()
        self.assertEqual(self.offer(self.player, self.trade, gold=60).status_code, 200)

        response = self.post_as(
            self.viewer, self.trade_url(self.trade, "lock"), {"offer_version": 1, "from_offer": shown["from_offer"]}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.state(self.trade), ("accepted", False, True))
        self.assertEqual(self.trade.from_offer["gold"], 60)

    def test_unlocking_gives_the_trader_back(self):
        for user, warband in ((self.player, self.warband), (self.viewer, self.rival)):
            with self.subTest(user=user.email):
                hero = self.trader(warband)
                self.assertEqual(self.offer(user, self.trade, trader_id=hero.id).status_code, 200)
                self.assertEqual(self.lock(user, self.trade).status_code, 200)
                self.trade_events.reset_mock()

                response = self.unlock(user, self.trade)

                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    (self.state(self.trade), self.trading_action(hero)), (("accepted", False, False), True)
                )
                self.trade_events.assert_called_once_with(self.trade.id, "trade.offer_updated", response.json())

    def test_unlocking_an_unlocked_side_changes_nothing(self):
        hero = self.trader(self.warband, trading_action=False)
        self.trade.from_offer = {"trader_id": hero.id}
        self.trade.save(update_fields=["from_offer"])

        self.assertEqual(self.unlock(self.player, self.trade).status_code, 200)

        self.assertEqual((self.state(self.trade), self.trading_action(hero)), (("accepted", False, False), False))


class TradeCompletionTests(TradeTestCase):
    """Both sides offer, both lock: stash items and gold move in one transaction."""

    def setUp(self) -> None:
        super().setUp()
        self.trade = self.open_trade()
        self.give_gold(self.warband, 100)
        self.give_gold(self.rival, 50)
        self.stash(self.warband, self.sword, 3, cost=9)
        self.stash(self.warband, self.axe, 1, cost=7)
        self.stash(self.rival, self.axe, 2, cost=5)

    def _offer_both_ways(self, **player_offer: object) -> None:
        mine = {"gold": 30, "items": [{"id": self.sword.id, "quantity": 2}], **player_offer}
        self.assertEqual(self.offer(self.player, self.trade, **mine).status_code, 200)
        theirs = {"gold": 10, "items": [{"id": self.axe.id, "quantity": 1}]}
        self.assertEqual(self.offer(self.viewer, self.trade, **theirs).status_code, 200)

    def test_the_second_lock_moves_items_and_gold_and_completes_the_trade(self):
        self._offer_both_ways()
        self.assertEqual(self.lock(self.player, self.trade).status_code, 200)
        self.trade_events.reset_mock()

        response = self.lock(self.viewer, self.trade)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.trade.refresh_from_db()
        self.assertEqual((body["status"], body["from_accepted"], body["to_accepted"]), ("completed", True, True))
        self.assertEqual(self.state(self.trade), ("completed", True, True))
        assert self.trade.responded_at is not None
        self.assertEqual(body["responded_at"], self.trade.responded_at.isoformat())
        self.assertEqual((body["from_offer"], body["to_offer"]), (self.trade.from_offer, self.trade.to_offer))
        self.assertEqual(self.event_names(), ["trade.locked", "trade.completed"])
        self.assertEqual(self.trade_events.call_args_list[-1].args, (self.trade.id, "trade.completed", body))

        # Characterises current behaviour (BUG-40, pinned; flips in PR A): a new stash row for a traded item
        # has no cost (it would sell for 0); a row the receiver already had keeps its own cost
        self.assertEqual(self.stash_rows(self.warband), [("Axe", 2, 7), ("Sword", 1, 9)])
        self.assertEqual(self.stash_rows(self.rival), [("Axe", 1, 5), ("Sword", 2, None)])

        # "Trade sent" is stored positive like "Trade received"; the gold rule counts it as spending (BUG-37)
        self.assertEqual(
            self.ledger(self.warband),
            [
                ("Reward", "Purse", 100),
                ("Trade sent", "Gold sent to Rats", 30),
                ("Trade received", "Gold received from Rats", 10),
            ],
        )
        self.assertEqual(
            self.ledger(self.rival),
            [
                ("Reward", "Purse", 50),
                ("Trade received", "Gold received from Monks", 30),
                ("Trade sent", "Gold sent to Monks", 10),
            ],
        )
        self.assertEqual((warband_gold(self.warband.id), warband_gold(self.rival.id)), (80, 70))
        # ECON-CQ-02: a completed trade writes no log on either side
        self.assertFalse(WarbandLog.objects.exists())

    def test_either_side_may_lock_first(self):
        self._offer_both_ways()
        self.assertEqual(self.lock(self.viewer, self.trade).json()["to_accepted"], True)

        self.assertEqual(self.lock(self.player, self.trade).json()["status"], "completed")

        self.assertEqual(self.stash_rows(self.rival), [("Axe", 1, 5), ("Sword", 2, None)])

    def test_an_item_only_offer_writes_no_gold_rows(self):
        self.offer(self.player, self.trade, items=[{"id": self.sword.id, "quantity": 3}])
        self.lock(self.player, self.trade)

        self.assertEqual(self.lock(self.viewer, self.trade).json()["status"], "completed")

        self.assertEqual(self.stash_rows(self.warband), [("Axe", 1, 7)])  # the last copy's row is deleted
        self.assertEqual(self.ledger(self.warband), [("Reward", "Purse", 100)])
        self.assertEqual(self.ledger(self.rival), [("Reward", "Purse", 50)])

    def test_a_completed_trade_takes_no_more_changes(self):
        self._offer_both_ways()
        self.lock(self.player, self.trade)
        self.lock(self.viewer, self.trade)

        for action in ("offer", "lock", "unlock"):
            with self.subTest(action=action):
                response = self.post_as(self.player, self.trade_url(self.trade, action), {"gold": 1})
                self.assertEqual((response.status_code, response.json()), (400, {"detail": "Trade is not active"}))
        self.assertEqual(
            self.ledger(self.warband)[1:],
            [("Trade sent", "Gold sent to Rats", 30), ("Trade received", "Gold received from Rats", 10)],
        )

    def test_a_trader_blocks_completion(self):
        # Characterises current behaviour (BUG-05, pinned; flips in PR A): the lock spends the trader, then
        # completion re-validates the offer and refuses him as unavailable; the trade stays locked
        hero = self.trader(self.warband)
        self._offer_both_ways(trader_id=hero.id)
        self.assertEqual(self.lock(self.player, self.trade).status_code, 200)

        response = self.lock(self.viewer, self.trade)

        self.assertEqual((response.status_code, response.json()), (400, {"detail": "Selected trader is unavailable."}))
        self.assertEqual(self.state(self.trade), ("accepted", True, True))
        self.assertFalse(self.trading_action(hero))
        self.assertEqual(self.stash_rows(self.warband), [("Axe", 1, 7), ("Sword", 3, 9)])
        self.assertEqual(self.ledger(self.warband), [("Reward", "Purse", 100)])
        self.assertNotIn("trade.completed", self.event_names())
        # Locking again just repeats the failed completion
        again = self.lock(self.player, self.trade)
        self.assertEqual((again.status_code, self.state(self.trade)), (400, ("accepted", True, True)))

    def test_a_failed_completion_leaves_both_sides_locked(self):
        # Characterises current behaviour (BUG-41, pinned; flips in PR A; ECON-TEST-08): the flags are saved
        # before the completion transaction, so a completion error answers 400 and the trade is stuck
        def sell_two_swords() -> None:
            WarbandItem.objects.filter(warband=self.warband, item=self.sword).update(quantity=1)

        def spend_the_gold() -> None:
            TradeHelper.create_trade(warband=self.warband, action="Upkeep", description="Rent", price=90)

        for change, detail in (
            (sell_two_swords, "Not enough quantity for one or more items."),
            (spend_the_gold, "Not enough gold."),
        ):
            with self.subTest(change=change.__name__):
                WarbandItem.objects.filter(warband=self.warband, item=self.sword).update(quantity=3)
                self.trade = self.open_trade()
                self._offer_both_ways()
                self.lock(self.player, self.trade)
                change()

                response = self.lock(self.viewer, self.trade)

                self.assertEqual((response.status_code, response.json()), (400, {"detail": detail}))
                self.assertEqual(self.state(self.trade), ("accepted", True, True))
                self.assertEqual(self.stash_rows(self.rival), [("Axe", 2, 5)])

    def test_items_in_the_other_campaign_are_traded_too(self):
        # SEC-07 context: stash rows aren't scoped, so whatever the stash holds can be offered and traded
        foreign = Item.objects.create(name="Lizard Spear", type="Melee", campaign_id=self.foreign_race.campaign_id)
        self.stash(self.warband, foreign, 1, cost=3)
        self.offer(self.player, self.trade, items=[{"id": foreign.id, "quantity": 1}])
        self.lock(self.player, self.trade)

        self.assertEqual(self.lock(self.viewer, self.trade).json()["status"], "completed")
        self.assertEqual(self.stash_rows(self.rival), [("Axe", 2, 5), ("Lizard Spear", 1, None)])
