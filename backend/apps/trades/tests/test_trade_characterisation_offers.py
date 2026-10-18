"""Characterisation: building an offer through POST .../offer/ (pass 2, step 0; ECON-TEST-09)."""

from typing import Any

from django.utils import timezone

from apps.items.models import Item
from apps.trades.models import TradeRequest
from apps.warbands.services.summary import warband_gold
from apps.warbands.utils.trades import TradeHelper

from .trade_support import PAYLOAD_KEYS, TradeTestCase


class TradeOfferTests(TradeTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.trade = self.open_trade()
        self.give_gold(self.warband, 100)
        self.stash(self.warband, self.sword, 3, cost=9)
        self.stash(self.warband, self.axe, 1, cost=7)
        self.flail = Item.objects.create(name="Flail", type="Melee")  # not in the player's stash
        self.trade_events.reset_mock()

    def test_an_offer_is_stored_normalised_on_the_senders_side(self):
        hero = self.trader(self.warband, name="Haggler")

        response = self.offer(
            self.player,
            self.trade,
            trader_id=hero.id,
            gold=40,
            items=[{"id": self.sword.id, "quantity": 2}, {"id": self.axe.id, "quantity": 1}],
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(list(body), PAYLOAD_KEYS)
        # BUG-40: offered items used to be valued from `Item.cost`, which doesn't exist (always 0); each copy is
        # now worth its stash row's cost
        offer = {
            "trader_id": hero.id,
            "trader_name": "Haggler",
            "gold": 40,
            "items": [
                {"id": self.sword.id, "name": "Sword", "quantity": 2, "cost": 9},
                {"id": self.axe.id, "name": "Axe", "quantity": 1, "cost": 7},
            ],
        }
        self.trade.refresh_from_db()
        self.assertEqual((body["from_offer"], body["to_offer"]), (offer, {}))
        self.assertEqual((self.trade.from_offer, self.trade.to_offer), (offer, {}))
        self.assertTrue(self.trading_action(hero))  # choosing a trader doesn't spend him; locking does
        self.trade_events.assert_called_once_with(self.trade.id, "trade.offer_updated", body, socket_id=None)

    def test_the_recipients_offer_goes_on_the_to_side(self):
        self.give_gold(self.rival, 20)

        body = self.offer(self.viewer, self.trade, gold=20).json()

        self.assertEqual(body["from_offer"], {})
        self.assertEqual(body["to_offer"], {"trader_id": None, "trader_name": None, "gold": 20, "items": []})

    def test_loose_values_are_coerced_or_dropped_silently(self):
        body = self.offer(
            self.player,
            self.trade,
            trader_id="abc",
            gold="lots",
            items=[
                {"id": str(self.sword.id), "quantity": "1"},
                {"id": self.sword.id, "quantity": 1},  # repeated ids add up
                {"id": self.axe.id, "quantity": 0},
                {"id": "x", "quantity": 1},
                {"quantity": 1},
                "sword",
            ],
        ).json()
        self.assertEqual(
            body["from_offer"],
            {
                "trader_id": None,
                "trader_name": None,
                "gold": 0,
                "items": [{"id": self.sword.id, "name": "Sword", "quantity": 2, "cost": 9}],
            },
        )

        for gold, items in ((-5, "all"), ("", None)):
            with self.subTest(gold=gold, items=items):
                offer = self.offer(self.player, self.trade, gold=gold, items=items).json()["from_offer"]
                self.assertEqual((offer["gold"], offer["items"]), (0, []))

    def test_gold_is_capped_at_the_warbands_gold(self):
        self.assertEqual(warband_gold(self.warband.id), 100)
        self.assertEqual(self.offer(self.player, self.trade, gold=100).status_code, 200)

        response = self.offer(self.player, self.trade, gold=101)

        self.assertEqual((response.status_code, response.json()), (400, {"detail": "Not enough gold."}))
        self.assertEqual(self.state(self.trade), ("accepted", False, False))
        self.trade.refresh_from_db()
        self.assertEqual(self.trade.from_offer["gold"], 100)  # the last valid offer stays

    def test_a_warband_in_debt_can_offer_no_gold(self):
        TradeHelper.create_trade(warband=self.rival, action="Upkeep", description="Rent", price=10)
        self.assertEqual(warband_gold(self.rival.id), -10)

        self.assertEqual(self.offer(self.viewer, self.trade, gold=0).status_code, 200)
        response = self.offer(self.viewer, self.trade, gold=1)
        self.assertEqual((response.status_code, response.json()), (400, {"detail": "Not enough gold."}))

    def test_invalid_offers_are_400_and_change_nothing(self):
        # a trader who already traded this round is no longer refused, only warned about (decision 9)
        dismissed = self.trader(self.warband, name="Gone", dismissed_at=timezone.now())
        foreign = self.trader(self.rival, name="Rat")
        too_few = "Not enough quantity for one or more items."
        cases: list[tuple[dict[str, Any], str]] = [
            ({"items": [{"id": self.sword.id, "quantity": 4}]}, too_few),
            ({"items": [{"id": self.sword.id, "quantity": 2}, {"id": self.sword.id, "quantity": 2}]}, too_few),
            ({"items": [{"id": self.flail.id, "quantity": 1}]}, "One or more items are not in the warchest."),
            ({"trader_id": dismissed.id}, "Trader not found."),
            ({"trader_id": foreign.id}, "Trader not found."),
            ({"trader_id": 999999}, "Trader not found."),
        ]
        for body, detail in cases:
            with self.subTest(body=body):
                response = self.offer(self.player, self.trade, **body)
                self.assertEqual((response.status_code, response.json()), (400, {"detail": detail}))
        self.trade.refresh_from_db()
        self.assertEqual((self.trade.from_offer, self.trade.to_offer), ({}, {}))
        self.trade_events.assert_not_called()

    def test_an_item_without_a_known_cost_is_offered_at_0(self):
        self.stash(self.warband, self.flail, 1)

        body = self.offer(self.player, self.trade, items=[{"id": self.flail.id, "quantity": 1}]).json()

        self.assertEqual(
            body["from_offer"]["items"], [{"id": self.flail.id, "name": "Flail", "quantity": 1, "cost": 0}]
        )

    def test_items_are_checked_against_the_senders_stash_only(self):
        self.stash(self.rival, self.flail, 1)

        response = self.offer(self.player, self.trade, items=[{"id": self.flail.id, "quantity": 1}])

        self.assertEqual(
            (response.status_code, response.json()), (400, {"detail": "One or more items are not in the warchest."})
        )

    def test_a_new_offer_unlocks_both_sides_and_gives_a_locked_trader_back(self):
        hero = self.trader(self.warband)
        self.assertEqual(self.offer(self.player, self.trade, trader_id=hero.id).status_code, 200)
        self.assertEqual(self.lock(self.player, self.trade).status_code, 200)
        self.assertEqual((self.state(self.trade), self.trading_action(hero)), (("accepted", True, False), False))

        response = self.offer(self.viewer, self.trade, gold=0)

        self.assertEqual(response.status_code, 200)
        self.assertEqual((self.state(self.trade), self.trading_action(hero)), (("accepted", False, False), True))
        self.trade.refresh_from_db()
        self.assertEqual(self.trade.from_offer["trader_id"], hero.id)  # the other side's offer is kept

    def test_offers_need_an_open_trade(self):
        pending = self.make_trade()
        for status in ("pending", "declined", "completed"):
            TradeRequest.objects.filter(id=pending.id).update(status=status)
            with self.subTest(status=status):
                response = self.offer(self.player, pending, gold=1)
                self.assertEqual((response.status_code, response.json()), (400, {"detail": "Trade is not active"}))

    def test_a_dead_or_dismissed_hero_cannot_trade(self):
        # BUG-109: the trader used to be looked up with not_dismissed, so a dead hero could trade
        for change in ({"dead": True}, {"dismissed_at": timezone.now()}):
            with self.subTest(change=list(change)):
                gone = self.trader(self.warband, name="Corpse", **change)

                response = self.offer(self.player, self.trade, trader_id=gone.id)

                self.assertEqual((response.status_code, response.json()), (400, {"detail": "Trader not found."}))
                self.assertTrue(self.trading_action(gone))
