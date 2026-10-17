"""Characterisation: gold, the sum of the ledger (pass 2, step 0; ECON-TEST-11, ECON-TEST-12).

Warbands have no gold column: `warband_gold()` adds `abs(price)` for every ledger row and subtracts it for
the actions in `EXPENSE_ACTIONS` (matched lower-cased and trimmed). The writers used to store mixed signs, so
a plain `SUM(price)` wasn't the gold (BUG-37); they now store each row signed by that rule, and migration
0027 re-signed the old rows. This is the safety net for PR B's ledger migration: the migration may change
stored prices but must keep every number asserted on `summary.gold`.
"""

from typing import Any

from django.db.models import Sum

from apps.warbands.models import WarbandItem, WarbandTrade
from apps.warbands.services.summary import warband_gold
from apps.warbands.utils.trades import TradeHelper

from .roster_support import RosterTestCase, trade_rows


class GoldPerActionTests(RosterTestCase):
    """ECON-TEST-11: how one stored row counts towards gold, per action text."""

    def test_each_action_counts_its_absolute_price_as_spending_or_income(self):
        cases = [
            # (action as stored, stored price, counted towards gold)
            ("Buy", -10, -10),
            ("Bought", 10, -10),
            ("Recruit", -10, -10),
            ("Recruited", -10, -10),
            ("Hire", -10, -10),
            ("Hired", -10, -10),
            ("Upkeep", -10, -10),
            ("Trade sent", 10, -10),
            (" BOUGHT ", 10, -10),  # matched lower-cased and trimmed
            ("Buys", -10, 10),  # anything else is income, whatever the stored sign
            ("Sold", 10, 10),
            ("Sell", 10, 10),
            ("Reward", 10, 10),
            ("Reward", -10, 10),
            ("Trade received", 10, 10),
            ("Starting Gold", 500, 500),
            ("Exploration", 10, 10),
            ("Group", 0, 0),
            ("Found a chest", 10, 10),
        ]
        for action, price, counted in cases:
            with self.subTest(action=action, price=price):
                self.warband.trades.all().delete()
                WarbandTrade.objects.create(warband=self.warband, action=action, description="row", price=price)
                self.assertEqual(warband_gold(self.warband.id), counted)

    def test_no_ledger_rows_is_zero_gold(self):
        self.assertEqual(warband_gold(self.warband.id), 0)
        self.assertEqual(self.client.get(f"/api/warbands/{self.warband.id}/summary/").json()["gold"], 0)

    def test_group_children_count_once_and_the_header_not_at_all(self):
        header = TradeHelper.create_group_header(warband=self.warband, description="Shopping")
        for price in (10, 5):
            WarbandTrade.objects.create(
                warband=self.warband, parent=header, action="Bought", description="x", price=price
            )

        self.assertEqual(warband_gold(self.warband.id), -15)


class MixedLedgerGoldTests(RosterTestCase):
    """ECON-TEST-12: a ledger written by every writer gives today's `summary.gold`."""

    def _post(self, path: str, body: dict[str, Any], status: int = 201) -> Any:
        response = self.client.post(f"/api/warbands/{self.warband.id}/{path}", body, format="json")
        self.assertEqual(response.status_code, status, response.data)
        return response.json()

    def _write_mixed_ledger(self) -> None:
        TradeHelper.upsert_starting_gold_trade(self.warband, 500)  # warband create
        self._post("trades/", {"action": "Buy", "description": "Rope", "price": 25})  # manual entry
        self._post("trades/", {"action": "Bought", "description": "Sword", "price": 40})  # the buy dialog
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=1, cost=10)
        sale = {"source_type": "stash", "item_id": self.sword.id, "quantity": 1, "price": 15}
        self._post("item-sales/", sale, status=200)
        self._post("heroes/", {"name": "Ana", "unit_type": "Champion", "price": 30})
        self._post("hired-swords/", {"name": "Ogre", "unit_type": "Ogre", "price": 60})
        # two henchmen recruited together: a Group header with a Recruited child each (20 apiece)
        self._post(
            "henchmen-groups/",
            {"name": "Zealots", "unit_type": "Zealot", "price": 20, "henchmen": [{"name": "Bo"}, {"name": "Cy"}]},
        )
        TradeHelper.create_trade(warband=self.warband, action="Upkeep", description="Post-battle upkeep", price=20)
        TradeHelper.create_trade(warband=self.warband, action="Reward", description="Battle reward", price=50)
        # a completed trade writes these directly (trades/services/completion.py), "Trade sent" negative
        WarbandTrade.objects.create(
            warband=self.warband, action="Trade sent", description="Gold sent to Rats", price=-35
        )
        WarbandTrade.objects.create(
            warband=self.warband, action="Trade received", description="Gold received from Rats", price=45
        )
        # the roster Save's queued purchases: a Group header, then a "Bought" child per purchase
        header = self._post("trades/", {"action": "Group", "description": "Purchases", "price": 0})
        self._post("trades/", {"action": "Bought", "description": "Axe", "price": 10, "parent_id": header["id"]})
        self._post("trades/", {"action": "Bought", "description": "Shield", "price": 5, "parent_id": header["id"]})
        self._post("trades/", {"action": "Found a chest", "description": "Free text", "price": 12})
        self._post("trades/", {"action": " BUY ", "description": "Odd casing", "price": 7})

    def test_summary_gold_for_a_mixed_ledger(self):
        self._write_mixed_ledger()

        rows = trade_rows(self.warband)
        # henchmen are charged in the order the DB returns them, so their two children are compared sorted
        self.assertEqual(
            rows[:7] + sorted(rows[7:9]) + rows[9:],
            [
                ("Starting Gold", "Starting Gold", 500, None),
                ("Buy", "Rope", -25, None),
                ("Bought", "Sword", -40, None),  # used to be stored positive and counted as spending (BUG-37)
                ("Sold", "Sword", 15, None),
                ("Recruited", "Ana the Champion", -30, None),
                ("Hired", "Ogre the Ogre", -60, None),
                ("Group", "Recruited 2 Zealots", 0, None),
                ("Recruited", "Bo into Zealots", -20, "Recruited 2 Zealots"),
                ("Recruited", "Cy into Zealots", -20, "Recruited 2 Zealots"),
                ("Upkeep", "Post-battle upkeep", -20, None),
                ("Reward", "Battle reward", 50, None),
                ("Trade sent", "Gold sent to Rats", -35, None),
                ("Trade received", "Gold received from Rats", 45, None),
                ("Group", "Purchases", 0, None),
                ("Bought", "Axe", -10, "Purchases"),
                ("Bought", "Shield", -5, "Purchases"),
                ("Found a chest", "Free text", 12, None),  # unknown text counts as income
                ("BUY", "Odd casing", -7, None),  # stripped on save, signed and counted as "buy"
            ],
        )
        # 500 - 25 - 40 + 15 - 30 - 60 - 20 - 20 - 20 + 50 - 35 + 45 - 10 - 5 + 12 - 7
        gold = 350
        self.assertEqual(warband_gold(self.warband.id), gold)
        summary = self.client.get(f"/api/warbands/{self.warband.id}/summary/").json()
        self.assertEqual(summary["gold"], gold)

    def test_a_raw_sum_of_prices_is_the_gold(self):
        # BUG-37: the "Bought" (40 + 10 + 5), "Trade sent" (35) and " BUY " (7) rows used to be stored positive,
        # so the raw sum was 350 + 2 * 97; every row is now stored signed
        self._write_mixed_ledger()

        raw = WarbandTrade.objects.filter(warband=self.warband).aggregate(total=Sum("price"))["total"]

        self.assertEqual(raw, 350)
        self.assertEqual(raw, warband_gold(self.warband.id))

    def test_the_treasury_lists_top_level_rows_with_their_children(self):
        self._write_mixed_ledger()

        rows = self.client.get(f"/api/warbands/{self.warband.id}/trades/").json()

        self.assertEqual(len(rows), 14)  # 18 rows, less the 4 children nested under their Group headers
        purchases = next(row for row in rows if row["description"] == "Purchases")
        children = sorted((child["description"], child["price"]) for child in purchases["children"])
        # stored prices: the header itself is 0 and its "Bought" children negative (they used to be positive)
        self.assertEqual((purchases["price"], children), (0, [("Axe", -10), ("Shield", -5)]))
