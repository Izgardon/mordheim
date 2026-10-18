"""Cursor pages and server-side filters for the warband log and the treasury (ECON-PERF-06).

Both used to answer the whole list, filtered in the browser. A client opts in with `?limit=` and follows
`next_cursor`; a request without `limit` or `cursor` still gets the whole list.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.warbands.models import LedgerAction, WarbandLog, WarbandTrade
from apps.warbands.services import ledger

from .roster_support import RosterTestCase

START = datetime(2026, 10, 1, tzinfo=UTC)


class LogPageTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.logs = []
        for minute, feature in enumerate(["battle", "items", "battle", "dice_roll", "battle"]):
            log = WarbandLog.objects.create(
                warband=self.warband, feature=feature, entry_type="t", payload={"n": minute}
            )
            WarbandLog.objects.filter(id=log.id).update(created_at=START + timedelta(minutes=minute // 2))
            self.logs.append(log)  # minutes 0, 0, 1, 1, 2: pairs share a timestamp
        WarbandLog.objects.create(warband=self.rival, feature="battle", entry_type="t", payload={"n": 9})

    def _get(self, query: str) -> Any:
        response = self.client.get(f"/api/warbands/{self.warband.id}/logs/{query}")
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def _ids(self, rows: list[dict[str, Any]]) -> list[int]:
        return [row["id"] for row in rows]

    def test_pages_follow_the_cursor_newest_first_without_repeats(self):
        newest_first = [log.id for log in reversed(self.logs)]

        first = self._get("?limit=2")
        second = self._get(f"?limit=2&cursor={first['next_cursor']}")
        last = self._get(f"?limit=2&cursor={second['next_cursor']}")

        self.assertEqual(list(first), ["results", "next_cursor", "features"])
        self.assertEqual(first["features"], ["battle", "dice_roll", "items"])
        self.assertEqual(list(second), ["results", "next_cursor"])  # the features come with the first page only
        self.assertEqual(self._ids(first["results"] + second["results"] + last["results"]), newest_first)
        self.assertIsNone(last["next_cursor"])

    def test_the_feature_filter_runs_on_the_server(self):
        battles = [log.id for log in reversed(self.logs) if log.feature == "battle"]

        first = self._get("?feature=BATTLE&limit=2")
        rest = self._get(f"?feature=battle&cursor={first['next_cursor']}")

        self.assertEqual(self._ids(first["results"] + rest["results"]), battles)
        self.assertIsNone(rest["next_cursor"])

    def test_without_a_limit_or_cursor_the_whole_log_comes_as_before(self):
        self.assertEqual(self._ids(self._get("")), [log.id for log in reversed(self.logs)])

    def test_a_bad_limit_or_cursor_is_refused(self):
        for query, field in (
            ("?limit=0", "limit"),
            ("?limit=101", "limit"),
            ("?limit=x", "limit"),
            ("?cursor=x", "cursor"),
        ):
            with self.subTest(query=query):
                response = self.client.get(f"/api/warbands/{self.warband.id}/logs/{query}")
                self.assertEqual((response.status_code, list(response.json())), (400, [field]))

    def test_a_page_costs_the_same_however_long_the_log(self):
        url = f"/api/warbands/{self.warband.id}/logs/?limit=2"
        with CaptureQueriesContext(connection) as before:
            first = self.client.get(url).json()
        WarbandLog.objects.bulk_create(
            WarbandLog(warband=self.warband, feature="battle", entry_type="t", payload={}) for _ in range(30)
        )
        with CaptureQueriesContext(connection) as after:
            self.client.get(url)
        with CaptureQueriesContext(connection) as next_page:
            self.client.get(f"{url}&cursor={first['next_cursor']}")

        # access (2), the page, the features; a later page skips the features
        self.assertEqual((len(before), len(after), len(next_page)), (4, 4, 3))


class TreasuryPageTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        rows = [
            ledger.record(self.warband, LedgerAction.STARTING_GOLD, 500, "Starting Gold"),
            ledger.record(self.warband, LedgerAction.BUY, -10, "Rope"),
        ]
        header = ledger.group_header(self.warband, "Recruited 2 Zealots")
        for name in ("Bo", "Cy"):
            ledger.record(self.warband, LedgerAction.RECRUIT, -20, f"{name} into Zealots", parent=header)
        rows += [header, ledger.record(self.warband, LedgerAction.SELL, 5, "Sword")]
        for minute, row in enumerate(rows):
            WarbandTrade.objects.filter(id=row.id).update(created_at=START + timedelta(minutes=minute))
        self.rows = rows

    def _get(self, query: str) -> Any:
        response = self.client.get(f"/api/warbands/{self.warband.id}/trades/{query}")
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def test_top_level_rows_come_in_pages_with_their_nested_rows(self):
        first = self._get("?limit=2")
        rest = self._get(f"?cursor={first['next_cursor']}")

        self.assertEqual(list(first), ["results", "next_cursor"])
        self.assertEqual([row["description"] for row in first["results"]], ["Sword", "Recruited 2 Zealots"])
        self.assertEqual(len(first["results"][1]["children"]), 2)
        self.assertEqual([row["description"] for row in rest["results"]], ["Rope", "Starting Gold"])
        self.assertIsNone(rest["next_cursor"])

    def test_the_action_filter_keeps_headers_whose_nested_rows_match(self):
        recruits = self._get("?action=recruit")
        spending = self._get("?action=Buy,Recruit&limit=5")

        self.assertEqual([row["description"] for row in recruits], ["Recruited 2 Zealots"])
        self.assertEqual(len(recruits[0]["children"]), 2)
        self.assertEqual([row["description"] for row in spending["results"]], ["Recruited 2 Zealots", "Rope"])

    def test_an_unknown_action_is_refused(self):
        response = self.client.get(f"/api/warbands/{self.warband.id}/trades/?action=Gifts")

        self.assertEqual((response.status_code, response.json()), (400, {"action": ["Unknown action: Gifts."]}))

    def test_without_a_limit_or_cursor_the_whole_treasury_comes_as_before(self):
        rows = self._get("")

        self.assertEqual(
            [row["description"] for row in rows], ["Sword", "Recruited 2 Zealots", "Rope", "Starting Gold"]
        )
