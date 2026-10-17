"""Characterisation: the treasury (trades/) and the warband log (logs/) (pass 2, step 0)."""

from datetime import UTC, datetime, timedelta
from typing import Any

from apps.warbands.models import WarbandLog, WarbandTrade
from apps.warbands.services.summary import warband_gold

from .roster_support import RosterTestCase, log_rows, trade_rows

TREASURY_KEYS = [
    "id",
    "warband_id",
    "parent_id",
    "action",
    "description",
    "price",
    "notes",
    "children",
    "created_at",
    "updated_at",
]
CHILD_KEYS = ["id", "action", "description", "price", "notes", "created_at"]
LOG_KEYS = ["id", "warband_id", "parent_id", "feature", "entry_type", "payload", "created_at"]
START = datetime(2026, 10, 1, tzinfo=UTC)


class TreasuryTests(RosterTestCase):
    def _url(self) -> str:
        return f"/api/warbands/{self.warband.id}/trades/"

    def _entry(self, **body: Any) -> Any:
        return self.client.post(self._url(), {"description": "Entry", **body}, format="json")

    def test_a_manual_entry_is_signed_by_its_action(self):
        # (action, stored price, change in gold) for an entry of 10 gc: the stored price is the change (BUG-37)
        cases = [
            ("Buy", -10, -10),
            ("Recruit", -10, -10),
            ("Recruited", -10, -10),
            ("Hire", -10, -10),
            ("Hired", -10, -10),
            ("Upkeep", -10, -10),
            ("Bought", -10, -10),  # BUG-37: used to be stored as income and counted as spending
            ("Trade sent", -10, -10),
            ("buy", -10, -10),  # signed by the gold rule, which ignores case (the sign used not to)
            ("Sell", 10, 10),
            ("Sold", 10, 10),
            ("Reward", 10, 10),
            ("Exploration", 10, 10),
            ("Starting Gold", 10, 10),
            ("Trade received", 10, 10),
            ("Lost at dice", 10, 10),  # BUG-37: any text is accepted and counts as income
        ]
        for action, stored, change in cases:
            with self.subTest(action=action):
                self.warband.trades.all().delete()
                response = self._entry(action=action, price=10)
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.json()["price"], stored)
                self.assertEqual(warband_gold(self.warband.id), change)

    def test_an_entry_answers_with_the_treasury_row(self):
        response = self._entry(action="  Reward ", description=" Found coins ", notes="In a well")

        self.assertEqual(response.status_code, 201)
        body = response.json()
        row = WarbandTrade.objects.get(id=body["id"])
        self.assertEqual(list(body), TREASURY_KEYS)
        self.assertEqual(
            {key: body[key] for key in TREASURY_KEYS if key not in ("created_at", "updated_at")},
            {
                "id": row.id,
                "warband_id": self.warband.id,
                "parent_id": None,
                "action": "Reward",
                "description": "Found coins",
                "price": 0,  # price is optional
                "notes": "In a well",
                "children": [],
            },
        )

    def test_invalid_entries(self):
        cases = [
            ({"description": "x"}, ["action"]),
            ({"action": " ", "description": "x"}, ["action"]),
            ({"action": "Buy"}, ["description"]),
            ({"action": "Buy", "description": "x", "price": -1}, ["price"]),
            ({"action": "Buy", "description": "x", "price": "lots"}, ["price"]),
            ({"action": "Buy", "description": "x", "price": None}, ["price"]),
        ]
        for body, fields in cases:
            with self.subTest(body=body):
                response = self.client.post(self._url(), body, format="json")
                self.assertEqual((response.status_code, list(response.json())), (400, fields))
        negative = self.client.post(self._url(), {"action": "Buy", "description": "x", "price": -1}, format="json")
        self.assertEqual(negative.json(), {"price": ["Gold coins cannot be negative"]})
        self.assertEqual(trade_rows(self.warband), [])

    def test_children_nest_under_their_parent_and_unknown_parents_are_ignored(self):
        parent = self._entry(action="Group", description="Purchases").json()
        foreign = WarbandTrade.objects.create(warband=self.rival, action="Group", description="Theirs", price=0)
        child = self._entry(action="Bought", description="Axe", price=5, parent_id=parent["id"]).json()
        orphans = [
            self._entry(action="Bought", description=f"to {pid}", parent_id=pid).json() for pid in (999999, foreign.id)
        ]
        WarbandTrade.objects.filter(warband=self.warband).update(created_at=START)
        WarbandTrade.objects.filter(id=orphans[1]["id"]).update(created_at=START + timedelta(minutes=1))

        rows = self.client.get(self._url()).json()

        self.assertEqual((child["parent_id"], [o["parent_id"] for o in orphans]), (parent["id"], [None, None]))
        self.assertEqual(rows[0]["id"], orphans[1]["id"])  # newest first
        self.assertEqual(sorted(row["id"] for row in rows), sorted([parent["id"], orphans[0]["id"], orphans[1]["id"]]))
        nested = next(row for row in rows if row["id"] == parent["id"])["children"]
        self.assertEqual([list(entry) for entry in nested], [CHILD_KEYS])
        self.assertEqual((nested[0]["id"], nested[0]["price"]), (child["id"], -5))  # signed (BUG-37)

    def test_members_read_the_treasury_and_editors_write_it(self):
        for user, read, write in (
            (self.viewer, 200, 403),
            (self.manager, 200, 201),
            (self.admin, 200, 201),
            (self.outsider, 404, 404),
        ):
            with self.subTest(user=user.email):
                self.client.force_authenticate(user=user)
                self.assertEqual(self.client.get(self._url()).status_code, read)
                self.assertEqual(self._entry(action="Reward", price=1).status_code, write)


class LogTests(RosterTestCase):
    def _url(self, query: str = "") -> str:
        return f"/api/warbands/{self.warband.id}/logs/{query}"

    def _log(self, feature: str, minutes: int) -> WarbandLog:
        entry = WarbandLog.objects.create(warband=self.warband, feature=feature, entry_type="t", payload={"n": minutes})
        WarbandLog.objects.filter(id=entry.id).update(created_at=START + timedelta(minutes=minutes))
        return entry

    def test_the_whole_log_newest_first_optionally_by_feature(self):
        old, new, battle = self._log("trade", 1), self._log("Trade", 3), self._log("battle", 2)
        WarbandLog.objects.create(warband=self.rival, feature="trade", entry_type="t", payload={"n": 0})

        everything = self.client.get(self._url()).json()
        trades = self.client.get(self._url("?feature=%20TRADE%20")).json()

        self.assertEqual([row["id"] for row in everything], [new.id, battle.id, old.id])
        self.assertEqual(list(everything[0]), LOG_KEYS)
        self.assertEqual([row["id"] for row in trades], [new.id, old.id])  # case-insensitive, trimmed

    def test_a_posted_entry_takes_any_feature_with_defaults(self):
        # ECON-CQ-02: the client may write any feature, including ones the server owns
        forged = self.client.post(
            self._url(), {"feature": "battle", "entry_type": "complete", "payload": {"a": 1}}, format="json"
        )
        defaulted = self.client.post(self._url(), {"feature": " ", "payload": {"b": 2}, "parent_id": 1}, format="json")

        self.assertEqual((forged.status_code, defaulted.status_code), (201, 201))
        self.assertEqual(list(forged.json()), LOG_KEYS)
        self.assertEqual(
            log_rows(self.warband), [("battle", "complete", {"a": 1}, None), ("trade", "summary", {"b": 2}, None)]
        )

    def test_a_posted_entry_needs_an_object_payload(self):
        cases: list[tuple[dict[str, Any], int, Any]] = [
            ({"feature": "dice"}, 400, {"detail": "Payload is required"}),
            ({"feature": "dice", "payload": {}}, 400, {"detail": "Payload is required"}),
            ({"feature": "dice", "payload": None}, 400, {"payload": ["This field may not be null."]}),
            ({"feature": "dice", "payload": [1]}, 400, {"payload": ["Payload must be an object."]}),
            ({"feature": "x" * 81, "payload": {"a": 1}}, 400, None),
        ]
        for body, status_code, expected in cases:
            with self.subTest(body=body):
                response = self.client.post(self._url(), body, format="json")
                self.assertEqual(response.status_code, status_code)
                if expected is not None:
                    self.assertEqual(response.json(), expected)
        self.assertEqual(log_rows(self.warband), [])

    def test_members_read_the_log_and_editors_write_it(self):
        for user, read, write in ((self.viewer, 200, 403), (self.manager, 200, 201), (self.outsider, 404, 404)):
            with self.subTest(user=user.email):
                self.client.force_authenticate(user=user)
                self.assertEqual(self.client.get(self._url()).status_code, read)
                response = self.client.post(self._url(), {"payload": {"a": 1}}, format="json")
                self.assertEqual(response.status_code, write)
