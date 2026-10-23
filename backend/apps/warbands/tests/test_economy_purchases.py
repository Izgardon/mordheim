"""POST purchases/: a purchase written on the server in one transaction (BUG-07; decisions 1, 2, 9 and 11).

It used to be a browser waterfall: the unit's whole item list PATCHed from page state (a second tab's changes
lost or resurrected), then the "Bought" row and the log posted with allSettled, so a failure left the item free.
"""

from typing import Any

from apps.items.models import Item, ItemAvailability
from apps.warbands.models import Hero, LedgerAction, WarbandItem, WarbandTrade
from apps.warbands.services import ledger

from .roster_support import HENCHMEN, HERO, RosterTestCase, log_rows, make_unit, trade_rows, unit_url

ANSWER_KEYS = ["target_type", "target_id", "updated_at", "items", "mount", "pets", "effective_stats", "group"]
ANSWER_KEYS += ["stash_item", "trade", "summary", "warnings"]  # mount to group: the bestiary rewrite step 4


class PurchaseTestCase(RosterTestCase):
    def buy(self, status: int = 201, **body: Any) -> Any:
        response = self.client.post(f"/api/warbands/{self.warband.id}/purchases/", body, format="json")
        self.assertEqual(response.status_code, status, response.content)
        return response.json()

    def gold(self) -> int:
        return int(self.client.get(f"/api/warbands/{self.warband.id}/summary/").json()["gold"])


class PurchaseTests(PurchaseTestCase):
    def test_a_stash_purchase_adds_the_copies_charges_and_logs_in_one_request(self):
        ledger.record(self.warband, LedgerAction.REWARD, 100, "Purse")

        body = self.buy(item_id=self.sword.id, quantity=2, price=12, target_type="stash")

        self.assertEqual(list(body), ANSWER_KEYS)
        self.assertEqual(
            (body["target_type"], body["target_id"], body["items"], body["warnings"]), ("stash", None, None, [])
        )
        self.assertEqual(body["stash_item"]["costs"], [{"cost": 12, "quantity": 2}])
        self.assertEqual((body["trade"]["action"], body["trade"]["price"]), ("Buy", -24))
        self.assertEqual(body["summary"]["gold"], 76)
        self.assertEqual(trade_rows(self.warband)[1:], [("Buy", "Sword x 2", -24, None)])
        self.assertEqual(
            log_rows(self.warband), [("loadout", "stash_item", {"item": "Sword", "price": 24, "quantity": 2}, None)]
        )

    def test_a_unit_purchase_appends_copies_and_leaves_the_others_alone(self):
        hero = make_unit(HERO, self.warband, name="Ana")
        hero.hero_items.create(item=self.sword, cost=10)

        body = self.buy(item_id=self.axe.id, price=5, target_type="hero", target_id=hero.id)

        self.assertEqual(body["items"], self.client.get(unit_url(HERO, self.warband.id, hero.id)).json()["items"])
        self.assertEqual([(entry["name"], entry["cost"]) for entry in body["items"]], [("Sword", 10), ("Axe", 5)])
        self.assertIsNone(body["stash_item"])
        self.assertEqual(
            log_rows(self.warband), [("loadout", "hero_item", {"hero": "Ana", "item": "Axe", "price": 5}, None)]
        )

    def test_each_kind_of_unit_can_buy(self):
        group = make_unit(HENCHMEN, self.warband, name="Zealots")

        body = self.buy(item_id=self.sword.id, price=10, target_type="henchmen_group", target_id=group.id)

        self.assertEqual([entry["name"] for entry in body["items"]], ["Sword"])
        self.assertEqual(log_rows(self.warband)[0][:2], ("loadout", "henchmen_item"))

    def test_without_a_price_a_copy_costs_the_current_campaign_price(self):
        # decision 11 ("Buy again"): the campaign's version of a book item (CAT-TWEAK-03; it was any same-named campaign
        # entry, BUG-18) replaces the book price; an availability sent must be the version's
        self.buy(item_id=self.sword.id, target_type="stash")  # one availability: 10
        house_axe = Item.objects.create(name="Axe", type="Melee", campaign=self.campaign, replaces=self.axe)
        ItemAvailability.objects.create(item=house_axe, cost=25, rarity=2)
        picked = ItemAvailability.objects.create(item=house_axe, cost=35, rarity=6)
        self.buy(item_id=self.axe.id, target_type="stash")  # the book Axe (5 / 15) under the version (25 / 35): 25
        self.buy(item_id=self.axe.id, availability_id=picked.id, target_type="stash")

        self.assertEqual(
            trade_rows(self.warband),
            [("Buy", "Sword", -10, None), ("Buy", "Axe", -25, None), ("Buy", "Axe", -35, None)],
        )

    def test_without_a_house_rule_the_lowest_listed_price_is_paid(self):
        self.buy(item_id=self.axe.id, target_type="stash")

        self.assertEqual(trade_rows(self.warband), [("Buy", "Axe", -5, None)])

    def test_a_purchase_may_leave_the_warband_in_debt_with_a_warning(self):
        # decision 2: the client confirmed "leaves the warband at -15 gc"; the server warns and allows
        body = self.buy(item_id=self.sword.id, price=15, target_type="stash")

        self.assertEqual(
            body["warnings"], [{"code": "gold_negative", "message": "This leaves the warband at -15 gc.", "gold": -15}]
        )
        self.assertEqual(self.gold(), -15)

    def test_a_gift_costs_nothing_and_is_logged_with_its_reason(self):
        body = self.buy(item_id=self.sword.id, is_buying=False, reason="Found in a crypt", target_type="stash")

        self.assertIsNone(body["trade"])
        self.assertEqual((trade_rows(self.warband), self.gold()), ([], 0))
        self.assertEqual(body["stash_item"]["costs"], [{"cost": 10, "quantity": 1}])  # the copy keeps a resale cost
        self.assertEqual(
            log_rows(self.warband), [("loadout", "stash_item", {"item": "Sword", "reason": "Found in a crypt"}, None)]
        )

    def test_refusals_leave_nothing_behind(self):
        hero = make_unit(HERO, self.warband)
        dead = make_unit(HERO, self.warband, dead=True)
        foreign = Item.objects.create(name="Their Spear", type="Melee", campaign=self.other_campaign())
        priceless = Item.objects.create(name="Relic", type="Misc")
        other_axe = ItemAvailability.objects.create(item=self.sword, cost=99, rarity=2)
        cases: list[tuple[dict[str, Any], int, str]] = [
            ({"item_id": foreign.id, "target_type": "stash"}, 404, "item_id"),
            ({"item_id": self.axe.id, "target_type": "hero", "target_id": dead.id}, 404, ""),
            ({"item_id": self.axe.id, "target_type": "hero"}, 400, "target_id"),
            ({"item_id": priceless.id, "target_type": "stash"}, 400, "price"),
            ({"item_id": self.axe.id, "availability_id": other_axe.id, "target_type": "stash"}, 400, "availability_id"),
            ({"item_id": self.axe.id, "price": -1, "target_type": "stash"}, 400, "price"),
            ({"item_id": self.axe.id, "quantity": 0, "target_type": "hero", "target_id": hero.id}, 400, "quantity"),
        ]
        for body, status, field in cases:
            with self.subTest(body=body):
                answer = self.buy(status=status, **body)
                if field:
                    self.assertIn(field, answer["fields"])
        self.assertEqual((trade_rows(self.warband), log_rows(self.warband)), ([], []))
        self.assertFalse(WarbandItem.objects.exists() or hero.hero_items.exists())

    def test_editors_buy_and_members_only_read(self):
        for user, status in ((self.viewer, 403), (self.outsider, 404), (self.manager, 201), (self.admin, 201)):
            with self.subTest(user=user.email):
                self.client.force_authenticate(user=user)
                self.buy(status=status, item_id=self.sword.id, price=1, target_type="stash")

    def other_campaign(self) -> Any:
        return self.foreign_race.campaign


class RarityRollPurchaseTests(PurchaseTestCase):
    """Decision 9: the roll is saved with the purchase and spends the searcher's trading action; warn, never refuse."""

    def _roll(self, hero: Hero, **roll: Any) -> dict[str, Any]:
        return {"hero_id": hero.id, "roll": 9, "modifier": 1, "rarity": "Rare 9", "success": True, **roll}

    def test_the_roll_spends_the_searchers_trading_action_and_is_logged(self):
        hero = make_unit(HERO, self.warband, name="Ana")

        body = self.buy(
            item_id=self.sword.id, price=10, target_type="stash", rarity_roll=self._roll(hero, reason="Lucky")
        )

        hero.refresh_from_db()
        self.assertEqual((hero.trading_action, body["warnings"][0]["code"]), (False, "gold_negative"))
        roll = {
            "hero": "Ana",
            "item": "Sword",
            "rarity": "Rare 9",
            "roll": 9,
            "modifier": 1,
            "reason": "Lucky",
            "success": True,
        }
        self.assertEqual(log_rows(self.warband)[0], ("trading_action", "rarity roll", roll, None))

    def test_a_spent_searcher_or_a_failed_roll_warns_and_the_purchase_goes_ahead(self):
        ana = make_unit(HERO, self.warband, name="Ana", trading_action=False)
        free: dict[str, Any] = {"item_id": self.sword.id, "price": 0, "target_type": "stash"}

        body = self.buy(**free, rarity_roll=self._roll(ana, success=False))

        self.assertEqual(
            body["warnings"],
            [
                {
                    "code": "trading_action_spent",
                    "message": "Ana already used his trading action this round.",
                    "hero_id": ana.id,
                },
                {"code": "rarity_roll_failed", "message": "Ana's rarity roll for Sword failed.", "hero_id": ana.id},
            ],
        )
        self.assertEqual(WarbandItem.objects.get(warband=self.warband).quantity, 1)

    def test_a_searcher_who_is_not_on_the_roster_is_refused(self):
        dead = make_unit(HERO, self.warband, dead=True)

        body = self.buy(status=400, item_id=self.sword.id, price=5, target_type="stash", rarity_roll=self._roll(dead))

        self.assertEqual(body["fields"], {"rarity_roll.hero_id": ["Not a hero on this warband's roster."]})
        self.assertFalse(WarbandTrade.objects.exists() or WarbandItem.objects.exists())


class RarityRollWithoutPurchaseTests(PurchaseTestCase):
    """POST rarity-rolls/: a search that found nothing (or wasn't bought) still spends the searcher's action."""

    def _post(self, status: int = 201, **body: Any) -> Any:
        response = self.client.post(f"/api/warbands/{self.warband.id}/rarity-rolls/", body, format="json")
        self.assertEqual(response.status_code, status, response.content)
        return response.json()

    def test_a_failed_search_is_saved_and_spends_the_action(self):
        ana = make_unit(HERO, self.warband, name="Ana")

        body = self._post(item_id=self.sword.id, hero_id=ana.id, roll=4, rarity="Rare 9", success=False)

        ana.refresh_from_db()
        self.assertEqual((body["hero_id"], body["trading_action"], ana.trading_action), (ana.id, False, False))
        self.assertEqual([warning["code"] for warning in body["warnings"]], ["rarity_roll_failed"])
        roll = {"hero": "Ana", "item": "Sword", "rarity": "Rare 9", "roll": 4, "modifier": 0, "success": False}
        self.assertEqual(log_rows(self.warband), [("trading_action", "rarity roll", roll, None)])
        self.assertEqual((trade_rows(self.warband), WarbandItem.objects.exists()), ([], False))

    def test_a_second_search_in_a_round_warns(self):
        ana = make_unit(HERO, self.warband, name="Ana", trading_action=False)

        body = self._post(item_id=self.sword.id, hero_id=ana.id, roll=11, success=True)

        self.assertEqual([warning["code"] for warning in body["warnings"]], ["trading_action_spent"])

    def test_refusals(self):
        dead = make_unit(HERO, self.warband, dead=True)
        theirs = make_unit(HERO, self.rival)
        for hero, status in ((dead, 400), (theirs, 400)):
            with self.subTest(hero=hero.id):
                body = self._post(status=status, item_id=self.sword.id, hero_id=hero.id, roll=4, success=True)
                self.assertEqual(body["fields"], {"hero_id": ["Not a hero on this warband's roster."]})
        self._post(status=400, item_id=self.sword.id, roll=4, success=True)  # no hero
        self.client.force_authenticate(user=self.viewer)
        self._post(status=403, item_id=self.sword.id, hero_id=dead.id, roll=4, success=True)
        self.assertEqual(log_rows(self.warband), [])
