"""Characterisation: gold, the sum of the ledger (pass 2, step 0; ECON-TEST-11, ECON-TEST-12).

Gold is the stored balance `Warband.gold`, which `services/ledger.py` changes with every signed ledger row it
writes (decision 4). Until PR B it was summed from the rows by a rule on the action text (abs(price),
subtracted for the spending actions); the ledger's data migrations stored every row signed by that rule and
filled in the balance with it (gone since the migrations were reset to a fresh 0001). This is the safety net for
the ledger refactor: every number asserted on `summary.gold` must stay.
"""

from typing import Any

from django.db.models import Sum

from apps.warbands.models import LedgerAction, WarbandItem, WarbandTrade
from apps.warbands.services import ledger
from apps.warbands.services.summary import warband_gold

from .roster_support import RosterTestCase, trade_rows


class GoldTests(RosterTestCase):
    """ECON-TEST-11 (the per-action rule now lives in `services/ledger_names.py`, for `check_gold --fix`)."""

    def test_no_ledger_rows_is_zero_gold(self):
        self.assertEqual(warband_gold(self.warband.id), 0)
        self.assertEqual(self.client.get(f"/api/warbands/{self.warband.id}/summary/").json()["gold"], 0)

    def test_group_children_count_once_and_the_header_not_at_all(self):
        header = ledger.group_header(self.warband, "Shopping")
        for price in (10, 5):
            ledger.record(self.warband, LedgerAction.BUY, -price, "x", parent=header)

        self.assertEqual(warband_gold(self.warband.id), -15)


class MixedLedgerGoldTests(RosterTestCase):
    """ECON-TEST-12: a ledger written by every writer gives today's `summary.gold`."""

    def _post(self, path: str, body: dict[str, Any], status: int = 201) -> Any:
        response = self.client.post(f"/api/warbands/{self.warband.id}/{path}", body, format="json")
        self.assertEqual(response.status_code, status, response.data)
        return response.json()

    def _write_mixed_ledger(self) -> None:
        ledger.record(self.warband, LedgerAction.STARTING_GOLD, 500, "Starting Gold")  # warband create
        self._post("trades/", {"action": "Buy", "description": "Rope", "price": 25})  # manual entry
        self._post("trades/", {"action": "Bought", "description": "Sword", "price": 40})  # the buy dialog
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=1, cost=10)
        sale = {"source_type": "stash", "item_id": self.sword.id, "quantity": 1, "price": 15}
        self._post("item-sales/", sale, status=200)
        self._post("heroes/", {"name": "Ana", "unit_type": "Champion", "price": 30})
        self._post("hirelings/", {"name": "Ogre", "unit_type": "Ogre", "price": 60})
        # two henchmen recruited together: a Group header with a Recruit child each (20 apiece)
        self._post(
            "henchmen-groups/",
            {"name": "Zealots", "unit_type": "Zealot", "price": 20, "henchmen": [{"name": "Bo"}, {"name": "Cy"}]},
        )
        ledger.record(self.warband, LedgerAction.UPKEEP, -20, "Post-battle upkeep")  # postbattle
        ledger.record(self.warband, LedgerAction.REWARD, 50, "Battle reward")
        # a completed trade (trades/services/completion.py)
        ledger.record(self.warband, LedgerAction.TRADE, -35, "Gold sent to Rats")
        ledger.record(self.warband, LedgerAction.TRADE, 45, "Gold received from Rats")
        # the roster Save's queued purchases: a Group header, then a "Bought" child per purchase (old clients)
        header = self._post("trades/", {"action": "Group", "description": "Purchases", "price": 0})
        self._post("trades/", {"action": "Bought", "description": "Axe", "price": 10, "parent_id": header["id"]})
        self._post("trades/", {"action": "Bought", "description": "Shield", "price": 5, "parent_id": header["id"]})
        # free text is refused now (decision 4); a hand-entered row of income outside the vocabulary is an adjustment
        self._post("trades/", {"action": "Adjustment", "description": "Found a chest", "price": 12})
        self._post("trades/", {"action": " BUY ", "description": "Odd casing", "price": 7})

    def test_summary_gold_for_a_mixed_ledger(self):
        self._write_mixed_ledger()

        rows = trade_rows(self.warband)
        # henchmen are charged in the order the DB returns them, so their two children are compared sorted
        self.assertEqual(
            rows[:7] + sorted(rows[7:9]) + rows[9:],
            [
                ("Starting gold", "Starting Gold", 500, None),
                ("Buy", "Rope", -25, None),
                ("Buy", "Sword", -40, None),  # "Bought": stored positive until BUG-37, named "Buy" since decision 4
                ("Sell", "Sword", 15, None),
                ("Recruit", "Ana the Champion", -30, None),
                ("Hire", "Ogre", -60, None),  # named for its type: once (was "Ogre the Ogre")
                ("Group", "Recruited 2 Zealots", 0, None),
                ("Recruit", "Bo into Zealots", -20, "Recruited 2 Zealots"),
                ("Recruit", "Cy into Zealots", -20, "Recruited 2 Zealots"),
                ("Upkeep", "Post-battle upkeep", -20, None),
                ("Reward", "Battle reward", 50, None),
                ("Trade", "Gold sent to Rats", -35, None),
                ("Trade", "Gold received from Rats", 45, None),
                ("Group", "Purchases", 0, None),
                ("Buy", "Axe", -10, "Purchases"),
                ("Buy", "Shield", -5, "Purchases"),
                ("Adjustment", "Found a chest", 12, None),
                ("Buy", "Odd casing", -7, None),  # " BUY ": any case and spacing
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
