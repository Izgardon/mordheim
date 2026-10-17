"""The ledger's data migrations keep every warband's gold (pass 2, decision 4).

Rows are stored as the old writers stored them, then the migration's SQL runs on the test database.
"""

from importlib import import_module

from django.db import connection
from django.db.models import Sum

from apps.warbands.models import Warband, WarbandTrade
from apps.warbands.services.summary import warband_gold

from .roster_support import RosterTestCase

# (action, price as the old writers stored it, what the gold rule counted)
LEGACY_ROWS = [
    ("Buy", -10, -10),
    ("Bought", 10, -10),  # the buy dialog's row, stored positive (BUG-37)
    ("Recruit", -10, -10),
    ("Recruited", -10, -10),
    ("Hire", -10, -10),
    ("Hired", -10, -10),
    ("Upkeep", -10, -10),
    ("Trade sent", 10, -10),  # written by a completed trade, stored positive (BUG-37)
    (" BOUGHT ", 10, -10),  # matched lower-cased and trimmed
    ("buy", 10, -10),  # a hand-entered lower-case "buy", stored positive
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


def _run(migration: str, statement: str) -> None:
    with connection.cursor() as cursor:
        cursor.execute(getattr(import_module(f"apps.warbands.migrations.{migration}"), statement))


class SignedPricesMigrationTests(RosterTestCase):
    """0027 stores each row's price as the gold rule reads it."""

    def setUp(self) -> None:
        super().setUp()
        WarbandTrade.objects.bulk_create(
            WarbandTrade(warband=self.warband, action=action, description="row", price=price)
            for action, price, _counted in LEGACY_ROWS
        )
        self.gold = warband_gold(self.warband.id)

    def _prices(self) -> list[int]:
        return list(WarbandTrade.objects.filter(warband=self.warband).order_by("id").values_list("price", flat=True))

    def _raw_sum(self, warband: Warband) -> int:
        return int(WarbandTrade.objects.filter(warband=warband).aggregate(total=Sum("price"))["total"] or 0)

    def test_every_row_is_stored_as_the_gold_rule_counts_it(self):
        self.assertNotEqual(self._raw_sum(self.warband), self.gold)

        _run("0027_signed_ledger_prices", "SIGN_PRICES")

        self.assertEqual(self._prices(), [counted for _action, _price, counted in LEGACY_ROWS])
        self.assertEqual(warband_gold(self.warband.id), self.gold)
        self.assertEqual(self._raw_sum(self.warband), self.gold)

    def test_reversing_stores_the_old_writers_signs_and_keeps_the_gold(self):
        _run("0027_signed_ledger_prices", "SIGN_PRICES")

        _run("0027_signed_ledger_prices", "RESTORE_OLD_SIGNS")

        # negative only for the exact actions the old writer signed
        old_signs = [-10, 10, -10, -10, -10, -10, -10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 500, 10, 0, 10]
        self.assertEqual(self._prices(), old_signs)
        self.assertEqual(warband_gold(self.warband.id), self.gold)
