"""services/ledger.py: every gold change is a signed row and the same change to `Warband.gold` (decision 4)."""

from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db.models import Sum

from apps.warbands.models import Warband, WarbandTrade
from apps.warbands.services import ledger

from .roster_support import RosterTestCase, trade_rows


class LedgerRecordTests(RosterTestCase):
    def _stored_gold(self, warband: Warband) -> int:
        return Warband.objects.values_list("gold", flat=True).get(id=warband.id)

    def test_a_row_and_its_change_to_the_balance_are_written_together(self):
        row = ledger.record(self.warband, "Sold", 15, "Sword", notes="Half price")
        ledger.record(self.warband, "Buy", -40, "Shield")

        self.assertEqual((row.action, row.description, row.price, row.notes), ("Sold", "Sword", 15, "Half price"))
        self.assertEqual(self._stored_gold(self.warband), -25)
        self.assertEqual(self.warband.gold, -25)  # the caller's instance shows the new balance

    def test_several_warbands_are_written_in_one_insert_and_one_update(self):
        entries = [
            ledger.Entry(self.warband, "Trade sent", -30, "Gold sent"),
            ledger.Entry(self.rival, "Trade received", 30, "Gold received"),
            ledger.Entry(self.rival, "Trade sent", -10, "Gold sent back"),
        ]

        with self.assertNumQueries(2):
            rows = ledger.record_entries(entries)

        self.assertEqual([row.price for row in rows], [-30, 30, -10])
        self.assertEqual((self._stored_gold(self.warband), self._stored_gold(self.rival)), (-30, 20))
        self.assertEqual((self.warband.gold, self.rival.gold), (-30, 20))

    def test_a_row_that_moves_no_gold_leaves_the_balance_alone(self):
        with self.assertNumQueries(1):
            header = ledger.group_header(self.warband, "Recruited 2 Zealots")

        ledger.record(self.warband, "Recruited", -20, "Bo into Zealots", parent=header)
        self.assertEqual(trade_rows(self.warband)[0], ("Group", "Recruited 2 Zealots", 0, None))
        self.assertEqual(self._stored_gold(self.warband), -20)

    def test_nothing_to_write_writes_nothing(self):
        with self.assertNumQueries(0):
            self.assertEqual(ledger.record_entries([]), [])

    def test_a_hand_entered_price_is_signed_by_its_action(self):
        self.assertEqual(
            [ledger.sign_for(action, 10) for action in ("Buy", " bought ", "Reward", "Found")], [-10, -10, 10, 10]
        )
        self.assertEqual(ledger.sign_for("Sell", -10), 10)


class StartingGoldRewriteTests(RosterTestCase):
    """Until BUG-78 (pass 4) a new campaign starting gold rewrites the oldest row; the balance follows it."""

    def test_the_oldest_row_is_rewritten_and_the_balance_moves_by_the_difference(self):
        ledger.record(self.warband, "Starting Gold", 500, "Starting Gold")
        ledger.record(self.warband, "Buy", -40, "Shield")

        ledger.rewrite_starting_gold(self.warband, 300)

        self.assertEqual(
            trade_rows(self.warband),
            [("Starting Gold", "Starting Gold", 300, None), ("Buy", "Shield", -40, None)],
        )
        self.assertEqual(Warband.objects.get(id=self.warband.id).gold, 260)

    def test_any_oldest_row_becomes_the_starting_gold_as_before(self):
        # BUG-78, pinned: the rewrite doesn't look at the row's action
        ledger.record(self.warband, "Buy", -40, "Shield")

        ledger.rewrite_starting_gold(self.warband, 500)

        self.assertEqual(trade_rows(self.warband), [("Starting Gold", "Starting Gold", 500, None)])
        self.assertEqual(Warband.objects.get(id=self.warband.id).gold, 500)

    def test_a_warband_without_rows_gets_its_starting_gold(self):
        ledger.rewrite_starting_gold(self.warband, 500)

        self.assertEqual(trade_rows(self.warband), [("Starting Gold", "Starting Gold", 500, None)])
        self.assertEqual(Warband.objects.get(id=self.warband.id).gold, 500)


class StaleWarbandSaveTests(RosterTestCase):
    def test_saving_a_warband_loaded_earlier_keeps_the_gold_written_since(self):
        stale = Warband.objects.get(id=self.warband.id)
        ledger.record(self.warband, "Reward", 50, "Purse")

        stale.name = "Renamed"
        stale.save()

        self.assertEqual(Warband.objects.values_list("name", "gold").get(id=self.warband.id), ("Renamed", 50))

    def test_editing_a_warband_through_the_api_keeps_its_gold(self):
        ledger.record(self.warband, "Reward", 50, "Purse")

        response = self.client.patch(f"/api/warbands/{self.warband.id}/", {"name": "Renamed"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Warband.objects.get(id=self.warband.id).gold, 50)


class CheckGoldCommandTests(RosterTestCase):
    def _check(self, *args: str) -> str:
        out = StringIO()
        call_command("check_gold", *args, stdout=out)
        return out.getvalue()

    def test_matching_gold_is_reported_as_such(self):
        ledger.record(self.warband, "Reward", 50, "Purse")

        self.assertIn("every stored gold matches its ledger", self._check())

    def test_a_difference_is_reported_and_is_an_error(self):
        ledger.record(self.warband, "Reward", 50, "Purse")
        WarbandTrade.objects.create(warband=self.warband, action="Buy", description="Written around it", price=-20)

        out = StringIO()
        with self.assertRaisesMessage(CommandError, "1 of"):
            call_command("check_gold", stdout=out)

        self.assertIn(
            f"Warband {self.warband.id} (Monks): stored 50 gc, ledger 30 gc, difference 20 gc", out.getvalue()
        )

    def test_fix_sets_the_gold_to_the_ledger_sum(self):
        WarbandTrade.objects.create(warband=self.warband, action="Reward", description="Written around it", price=20)

        output = self._check("--fix")

        self.assertIn("Set the gold of 1 warbands to their ledger sum.", output)
        total = WarbandTrade.objects.filter(warband=self.warband).aggregate(total=Sum("price"))["total"]
        self.assertEqual(Warband.objects.get(id=self.warband.id).gold, total)
        self.assertEqual(ledger.gold_drift(), [])
