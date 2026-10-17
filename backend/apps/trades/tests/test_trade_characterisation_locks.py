"""Characterisation: locking, unlocking and completing a trade (pass 2, step 0).

Lock is `POST .../lock/` (the view is CampaignTradeOfferAcceptView); the second lock completes the trade
in the same request.
"""

from django.utils import timezone

from apps.items.models import Item
from apps.warbands.models import Hero, WarbandItem, WarbandLog
from apps.warbands.services import ledger
from apps.warbands.services.summary import warband_gold

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

    def test_a_trader_dead_or_dismissed_since_the_offer_cannot_lock(self):
        # one who traded elsewhere since the offer still locks, with a warning (decision 9)
        for change, detail in (
            ({"dismissed_at": timezone.now()}, "Trader not found."),
            ({"dead": True}, "Trader not found."),  # BUG-109: a dead hero used to be spent
        ):
            with self.subTest(change=list(change)):
                hero = self.trader(self.warband)
                self.assertEqual(self.offer(self.player, self.trade, trader_id=hero.id).status_code, 200)
                Hero.objects.filter(id=hero.id).update(**change)

                response = self.lock(self.player, self.trade)

                self.assertEqual((response.status_code, response.json()), (400, {"detail": detail}))
                self.assertEqual(self.state(self.trade), ("accepted", False, False))

    def test_a_lock_names_the_offer_version_it_was_shown(self):
        # BUG-35, ECON-TEST-07: a lock carried no offer identity, so a lock sent after the other side changed its
        # offer locked the new offer. Every offer now bumps offer_version; a lock naming another version is a 409.
        self.assertEqual(self.offer(self.player, self.trade, gold=10).json()["offer_version"], 1)
        shown = self.get_as(self.viewer, self.trade_url(self.trade)).json()
        self.assertEqual(self.offer(self.player, self.trade, gold=60).json()["offer_version"], 2)

        response = self.post_as(
            self.viewer, self.trade_url(self.trade, "lock"), {"offer_version": shown["offer_version"]}
        )

        body = response.json()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            {key: body[key] for key in ("detail", "code", "offer_version")},
            {
                "detail": "The offers changed since you last saw them. Check them and accept again.",
                "code": "offer_changed",
                "offer_version": 2,
            },
        )
        self.assertEqual((body["trade"]["from_offer"]["gold"], body["trade"]["offer_version"]), (60, 2))
        self.assertEqual(self.state(self.trade), ("accepted", False, False))
        self.assertNotIn("trade.locked", self.event_names())

        current = self.post_as(self.viewer, self.trade_url(self.trade, "lock"), {"offer_version": 2})
        self.assertEqual((current.status_code, self.state(self.trade)), (200, ("accepted", False, True)))

    def test_a_lock_without_a_version_locks_the_offers_as_they_stand(self):
        # clients from before pass 2 send no offer_version: their lock behaves as it always did
        self.offer(self.player, self.trade, gold=10)

        response = self.lock(self.viewer, self.trade)

        self.assertEqual((response.status_code, self.state(self.trade)), (200, ("accepted", False, True)))
        for bad in ("two", -1, True, 1.5):
            with self.subTest(offer_version=bad):
                response = self.post_as(self.player, self.trade_url(self.trade, "lock"), {"offer_version": bad})
                self.assertEqual((response.status_code, response.json()["code"]), (400, "invalid"))
        self.assertEqual(self.state(self.trade), ("accepted", False, True))

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
                self.trade_events.assert_called_once_with(
                    self.trade.id, "trade.offer_updated", response.json(), socket_id=None
                )

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

        # BUG-40: a new stash row for a traded item used to have no cost (it sold for 0); the copies now keep
        # their cost, and a row the receiver already had keeps its own
        self.assertEqual(self.stash_rows(self.warband), [("Axe", 2, 7), ("Sword", 1, 9)])
        self.assertEqual(self.stash_rows(self.rival), [("Axe", 1, 5), ("Sword", 2, 9)])

        # "Trade sent" is stored negative, as the gold rule counts it (BUG-37: it used to be stored positive)
        self.assertEqual(
            self.ledger(self.warband),
            [
                ("Reward", "Purse", 100),
                ("Trade sent", "Gold sent to Rats", -30),
                ("Trade received", "Gold received from Rats", 10),
            ],
        )
        self.assertEqual(
            self.ledger(self.rival),
            [
                ("Reward", "Purse", 50),
                ("Trade received", "Gold received from Monks", 30),
                ("Trade sent", "Gold sent to Monks", -10),
            ],
        )
        self.assertEqual((warband_gold(self.warband.id), warband_gold(self.rival.id)), (80, 70))
        # ECON-CQ-02: a completed trade writes no log on either side
        self.assertFalse(WarbandLog.objects.exists())

    def test_either_side_may_lock_first(self):
        self._offer_both_ways()
        self.assertEqual(self.lock(self.viewer, self.trade).json()["to_accepted"], True)

        self.assertEqual(self.lock(self.player, self.trade).json()["status"], "completed")

        self.assertEqual(self.stash_rows(self.rival), [("Axe", 1, 5), ("Sword", 2, 9)])

    def test_a_receivers_row_without_a_cost_takes_the_traded_copies_cost(self):
        WarbandItem.objects.filter(warband=self.warband, item=self.axe).update(cost=None)
        self._offer_both_ways()
        self.lock(self.player, self.trade)

        self.assertEqual(self.lock(self.viewer, self.trade).json()["status"], "completed")
        self.assertEqual(self.stash_rows(self.warband), [("Axe", 2, 5), ("Sword", 1, 9)])

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
            [("Trade sent", "Gold sent to Rats", -30), ("Trade received", "Gold received from Rats", 10)],
        )

    def test_a_trader_spent_by_the_lock_does_not_block_completion(self):
        # BUG-05: completion used to re-check the trader's trading action, which the lock had just spent, so
        # a trade with a trader never completed. It now only checks that he is still on the roster.
        hero = self.trader(self.warband)
        self._offer_both_ways(trader_id=hero.id)
        self.assertEqual(self.lock(self.player, self.trade).status_code, 200)
        self.trade_events.reset_mock()

        response = self.lock(self.viewer, self.trade)

        self.assertEqual((response.status_code, response.json()["status"]), (200, "completed"))
        self.assertEqual(self.state(self.trade), ("completed", True, True))
        self.assertEqual((self.trading_action(hero), self.trade.from_trader_spent_id), (False, hero.id))
        self.assertEqual(self.stash_rows(self.warband), [("Axe", 2, 7), ("Sword", 1, 9)])
        self.assertEqual(self.event_names(), ["trade.locked", "trade.completed"])

    def test_a_failed_completion_unlocks_both_sides_and_says_why(self):
        # BUG-41, ECON-TEST-08: the flags used to be saved before the completion transaction, so a completion
        # error answered 400 and left both sides locked. Lock and completion now share one transaction: a side
        # that can no longer pay unlocks both sides, gives the traders back, answers 409 and tells the other.
        def sell_two_swords() -> None:
            WarbandItem.objects.filter(warband=self.warband, item=self.sword).update(quantity=1)

        def spend_the_gold() -> None:
            ledger.record(self.warband, "Upkeep", -90, "Rent")

        self.assertEqual(self.post_as(self.player, self.trade_url(self.trade, "close")).status_code, 200)
        for change, detail in (
            (sell_two_swords, "Not enough quantity for one or more items."),
            (spend_the_gold, "Not enough gold."),
        ):
            with self.subTest(change=change.__name__):
                WarbandItem.objects.filter(warband=self.warband, item=self.sword).update(quantity=3)
                self.trade = self.open_trade()
                hero, theirs = self.trader(self.warband), self.trader(self.rival, name="Fence")
                self._offer_both_ways(trader_id=hero.id)
                self.assertEqual(self.offer(self.viewer, self.trade, trader_id=theirs.id, gold=10).status_code, 200)
                self.lock(self.player, self.trade)
                change()
                self.trade_events.reset_mock()

                response = self.lock(self.viewer, self.trade)

                body = response.json()
                self.assertEqual(response.status_code, 409)
                self.assertEqual(
                    {key: body[key] for key in ("detail", "code", "warband_id")},
                    {"detail": detail, "code": "trade_completion_failed", "warband_id": self.warband.id},
                )
                self.assertEqual(self.state(self.trade), ("accepted", False, False))
                self.assertEqual((body["trade"]["from_accepted"], body["trade"]["to_accepted"]), (False, False))
                self.assertEqual((self.trading_action(hero), self.trading_action(theirs)), (True, True))
                self.assertEqual(self.stash_rows(self.rival), [("Axe", 2, 5)])
                self.assertEqual(self.ledger(self.rival), [("Reward", "Purse", 50)])
                self.trade_events.assert_called_once_with(
                    self.trade.id,
                    "trade.offer_updated",
                    {**body["trade"], "error": {key: body[key] for key in body if key != "trade"}},
                    socket_id=None,
                )
                self.assertEqual(self.post_as(self.player, self.trade_url(self.trade, "close")).status_code, 200)

    def test_items_in_the_other_campaign_are_traded_too(self):
        # SEC-07 context: stash rows aren't scoped, so whatever the stash holds can be offered and traded
        foreign = Item.objects.create(name="Lizard Spear", type="Melee", campaign_id=self.foreign_race.campaign_id)
        self.stash(self.warband, foreign, 1, cost=3)
        self.offer(self.player, self.trade, items=[{"id": foreign.id, "quantity": 1}])
        self.lock(self.player, self.trade)

        self.assertEqual(self.lock(self.viewer, self.trade).json()["status"], "completed")
        self.assertEqual(self.stash_rows(self.rival), [("Axe", 2, 5), ("Lizard Spear", 1, 3)])
