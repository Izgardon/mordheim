"""The ledger's data migrations keep every warband's gold (pass 2, decision 4).

Rows are stored as the old writers stored them, then the migration's SQL runs on the test database.
"""

from importlib import import_module

from django.db import connection
from django.db.models import Sum

from apps.warbands.models import LedgerAction, Warband, WarbandTrade
from apps.warbands.services import ledger

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


def _rule_gold(warband: Warband) -> int:
    """The gold the summary read until PR B: the old rule over the rows as stored."""
    signed = import_module("apps.warbands.migrations.0029_backfill_warband_gold").SIGNED
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT COALESCE(SUM({signed}), 0) FROM warband_trades WHERE warband_id = %s", [warband.id])
        return int(cursor.fetchone()[0])


class SignedPricesMigrationTests(RosterTestCase):
    """0027 stores each row's price as the gold rule reads it."""

    def setUp(self) -> None:
        super().setUp()
        WarbandTrade.objects.bulk_create(
            WarbandTrade(warband=self.warband, action=action, description="row", price=price)
            for action, price, _counted in LEGACY_ROWS
        )
        self.gold = _rule_gold(self.warband)

    def _prices(self) -> list[int]:
        return list(WarbandTrade.objects.filter(warband=self.warband).order_by("id").values_list("price", flat=True))

    def _raw_sum(self, warband: Warband) -> int:
        return int(WarbandTrade.objects.filter(warband=warband).aggregate(total=Sum("price"))["total"] or 0)

    def test_every_row_is_stored_as_the_gold_rule_counts_it(self):
        self.assertNotEqual(self._raw_sum(self.warband), self.gold)

        _run("0027_signed_ledger_prices", "SIGN_PRICES")

        self.assertEqual(self._prices(), [counted for _action, _price, counted in LEGACY_ROWS])
        self.assertEqual(_rule_gold(self.warband), self.gold)
        self.assertEqual(self._raw_sum(self.warband), self.gold)

    def test_reversing_stores_the_old_writers_signs_and_keeps_the_gold(self):
        _run("0027_signed_ledger_prices", "SIGN_PRICES")

        _run("0027_signed_ledger_prices", "RESTORE_OLD_SIGNS")

        # negative only for the exact actions the old writer signed
        old_signs = [-10, 10, -10, -10, -10, -10, -10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 500, 10, 0, 10]
        self.assertEqual(self._prices(), old_signs)
        self.assertEqual(_rule_gold(self.warband), self.gold)


class BackfillGoldMigrationTests(RosterTestCase):
    """0029 fills in `Warband.gold` with what the old rule summed (ECON-TEST-11's cases, moved here)."""

    def _gold(self, warband: Warband) -> int:
        return Warband.objects.values_list("gold", flat=True).get(id=warband.id)

    def test_each_legacy_row_counts_as_the_old_rule_counted_it(self):
        for action, price, counted in LEGACY_ROWS:
            with self.subTest(action=action, price=price):
                self.warband.trades.all().delete()
                Warband.objects.filter(id=self.warband.id).update(gold=0)
                WarbandTrade.objects.create(warband=self.warband, action=action, description="row", price=price)

                _run("0029_backfill_warband_gold", "BACKFILL_GOLD")

                self.assertEqual(self._gold(self.warband), counted)

    def test_after_signing_every_balance_is_its_ledger_sum(self):
        for warband, rows in ((self.warband, LEGACY_ROWS), (self.rival, LEGACY_ROWS[:3])):
            WarbandTrade.objects.bulk_create(
                WarbandTrade(warband=warband, action=action, description="row", price=price)
                for action, price, _counted in rows
            )
        Warband.objects.update(gold=0)

        _run("0027_signed_ledger_prices", "SIGN_PRICES")
        _run("0029_backfill_warband_gold", "BACKFILL_GOLD")

        self.assertEqual(self._gold(self.warband), sum(counted for _action, _price, counted in LEGACY_ROWS))
        self.assertEqual(self._gold(self.rival), -10 + -10 + -10)
        self.assertEqual(ledger.gold_drift(), [])


class VocabularyMigrationTests(RosterTestCase):
    """0030 renames every row into the vocabulary (decision 4) without changing a price."""

    def setUp(self) -> None:
        super().setUp()
        WarbandTrade.objects.bulk_create(
            WarbandTrade(warband=self.warband, action=action, description="row", price=price)
            for action, price, _counted in LEGACY_ROWS
        )
        _run("0027_signed_ledger_prices", "SIGN_PRICES")

    def _rows(self) -> list[tuple[str, int, str]]:
        return list(
            WarbandTrade.objects.filter(warband=self.warband)
            .order_by("id")
            .values_list("action", "price", "description")
        )

    def _rename(self) -> None:
        _run("0030_ledger_vocabulary", "RENAME_ACTIONS")
        _run("0030_ledger_vocabulary", "FREE_TEXT_TO_ADJUSTMENTS")

    def test_old_names_are_renamed_and_free_text_becomes_an_adjustment(self):
        self._rename()

        self.assertEqual(
            self._rows(),
            [
                ("Buy", -10, "row"),
                ("Buy", -10, "row"),
                ("Recruit", -10, "row"),
                ("Recruit", -10, "row"),
                ("Hire", -10, "row"),
                ("Hire", -10, "row"),
                ("Upkeep", -10, "row"),
                ("Trade", -10, "row"),
                ("Buy", -10, "row"),
                ("Buy", -10, "row"),
                ("Adjustment", 10, "Buys: row"),
                ("Sell", 10, "row"),
                ("Sell", 10, "row"),
                ("Reward", 10, "row"),
                ("Reward", 10, "row"),
                ("Trade", 10, "row"),
                ("Starting gold", 500, "row"),
                ("Exploration", 10, "row"),
                ("Group", 0, "row"),
                ("Adjustment", 10, "Found a chest: row"),
            ],
        )
        self.assertFalse(WarbandTrade.objects.exclude(action__in=LedgerAction.values).exists())

    def test_reversing_keeps_the_gold_the_previous_release_reads(self):
        gold = _rule_gold(self.warband)
        ledger.record(self.warband, LedgerAction.ADJUSTMENT, -25, "Correction")  # written by this release
        self._rename()

        _run("0030_ledger_vocabulary", "RESTORE_SPENDING_ADJUSTMENTS")
        _run("0030_ledger_vocabulary", "RESTORE_TRADE_NAMES")

        self.assertEqual(_rule_gold(self.warband), gold - 25)
        self.assertEqual(self._rows()[-1], ("Buy", -25, "Adjustment: Correction"))
        self.assertEqual([row[0] for row in self._rows() if "Trade" in row[0]], ["Trade sent", "Trade received"])
