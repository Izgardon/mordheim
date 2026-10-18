"""Characterisation: the treasury (trades/) and the warband log (logs/) (pass 2, step 0)."""

from datetime import UTC, datetime, timedelta
from typing import Any

from apps.warbands.models import WarbandLog, WarbandTrade
from apps.warbands.services.summary import warband_gold

from .roster_support import RosterTestCase, clear_ledger, log_rows, trade_rows

TREASURY_KEYS = [
    "id",
    "warband_id",
    "parent_id",
    "action",
    "description",
    "price",
    "notes",
    "created_by",
    "corrects_id",
    "children",
    "created_at",
    "updated_at",
]
CHILD_KEYS = ["id", "action", "description", "price", "notes", "created_by", "corrects_id", "created_at"]
LOG_KEYS = ["id", "warband_id", "parent_id", "feature", "entry_type", "payload", "created_at"]
START = datetime(2026, 10, 1, tzinfo=UTC)


class TreasuryTests(RosterTestCase):
    def _url(self) -> str:
        return f"/api/warbands/{self.warband.id}/trades/"

    def _entry(self, **body: Any) -> Any:
        return self.client.post(self._url(), {"description": "Entry", **body}, format="json")

    def test_a_manual_entry_is_named_from_the_vocabulary_and_signed_by_its_action(self):
        # (action sent, price sent, action stored, price stored = change in gold); decision 4, BUG-37
        cases = [
            ("Buy", 10, "Buy", -10),
            ("Recruit", 10, "Recruit", -10),
            ("Hire", 10, "Hire", -10),
            ("Upkeep", 10, "Upkeep", -10),
            ("Sell", 10, "Sell", 10),
            ("Reward", 10, "Reward", 10),
            ("Exploration", 10, "Exploration", 10),
            ("Starting gold", 10, "Starting gold", 10),
            ("buy", 10, "Buy", -10),  # any case
            ("Trade", 10, "Trade", 10),  # Trade and Adjustment go either way: the price carries the sign
            ("Trade", -10, "Trade", -10),
            ("Adjustment", 10, "Adjustment", 10),
            ("adjustment", -10, "Adjustment", -10),
            # older clients' names
            ("Bought", 10, "Buy", -10),
            ("Sold", 10, "Sell", 10),
            ("Recruited", 10, "Recruit", -10),
            ("Hired", 10, "Hire", -10),
            ("Starting Gold", 10, "Starting gold", 10),
            ("Trade sent", 10, "Trade", -10),
            ("Trade received", 10, "Trade", 10),
        ]
        for sent, price, action, stored in cases:
            with self.subTest(action=sent, price=price):
                clear_ledger(self.warband)
                response = self._entry(action=sent, price=price)
                self.assertEqual(response.status_code, 201)
                self.assertEqual((response.json()["action"], response.json()["price"]), (action, stored))
                self.assertEqual(warband_gold(self.warband.id), stored)

    def test_an_action_outside_the_vocabulary_is_refused(self):
        # BUG-37: any text used to be accepted and counted as income
        response = self._entry(action="Lost at dice", price=10)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {
                "action": [
                    "Unknown action. Use one of: Buy, Sell, Recruit, Hire, Upkeep, Reward, Exploration, Trade, "
                    "Adjustment, Starting gold, Group."
                ]
            },
        )
        self.assertEqual(trade_rows(self.warband), [])

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
                "created_by": {"id": self.player.id, "name": self.player.first_name},  # decision 6
                "corrects_id": None,  # decision 5
                "children": [],
            },
        )

    def test_each_manual_row_records_who_entered_it_and_automatic_rows_nobody(self):
        self.client.force_authenticate(user=self.admin)  # a campaign admin writing on the player's warband
        header = self._entry(action="Group", description="Purchases").json()
        self.client.force_authenticate(user=self.player)
        self._entry(action="Buy", description="Axe", price=5, parent_id=header["id"])
        stock = {"source_type": "stash", "item_id": self.sword.id, "quantity": 1, "price": 3}
        self.warband.warband_items.create(item=self.sword, quantity=1, cost=10)
        self.assertEqual(self.client.post(f"/api/warbands/{self.warband.id}/item-sales/", stock).status_code, 200)

        rows = {row["description"]: row for row in self.client.get(self._url()).json()}

        self.assertEqual(rows["Purchases"]["created_by"], {"id": self.admin.id, "name": self.admin.first_name})
        child = rows["Purchases"]["children"][0]
        self.assertEqual(child["created_by"], {"id": self.player.id, "name": self.player.first_name})
        self.assertIsNone(rows["Sword"]["created_by"])  # the sale was written by the server

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
        old_name = self.client.post(
            self._url(), {"action": "Trade sent", "description": "x", "price": -1}, format="json"
        )
        self.assertEqual(old_name.json(), {"price": ["Gold coins cannot be negative"]})
        header = self.client.post(self._url(), {"action": "Group", "description": "x", "price": 5}, format="json")
        self.assertEqual(header.json(), {"price": ["A group header moves no gold."]})
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

    def test_the_client_logs_only_what_the_server_cannot(self):
        # ECON-CQ-02: the client used to write any feature, including ones the server owns, with defaults
        refused = {"feature": ["The server writes this kind of log entry itself."]}
        for feature, entry_type in (("battle", "complete"), ("items", "sold"), ("personnel", "new_hero"), (" ", "x")):
            with self.subTest(feature=feature):
                body = {"feature": feature, "entry_type": entry_type, "payload": {"a": 1}}
                response = self.client.post(self._url(), body, format="json")
                self.assertEqual(response.status_code, 400)
                if feature.strip():
                    self.assertEqual(response.json(), refused)
        dice = {"feature": "dice_roll", "entry_type": "dice_roll", "payload": {"dice": "2d6", "rolls": [3, 4]}}
        roll = {"feature": "trading_action", "entry_type": "rarity roll", "payload": {"hero": "Ana", "roll": 9}}
        bought = {"feature": "loadout", "entry_type": "stash_item", "payload": {"item": "Rope", "price": 5}}
        for body in (dice, roll, bought):  # rarity rolls and purchases until purchases move to the server
            self.assertEqual(self.client.post(self._url(), body, format="json").status_code, 201)
        self.assertEqual(
            log_rows(self.warband),
            [
                ("dice_roll", "dice_roll", {"dice": "2d6", "rolls": [3, 4]}, None),
                ("trading_action", "rarity roll", {"hero": "Ana", "roll": 9}, None),
                ("loadout", "stash_item", {"item": "Rope", "price": 5}, None),
            ],
        )

    def test_a_posted_entry_needs_a_small_object_payload(self):
        dice = {"feature": "dice_roll", "entry_type": "dice_roll"}
        cases: list[tuple[dict[str, Any], int, Any]] = [
            (dice, 400, {"payload": ["This field is required."]}),
            ({**dice, "payload": {}}, 400, {"payload": ["Payload is required."]}),
            ({**dice, "payload": None}, 400, {"payload": ["This field may not be null."]}),
            ({**dice, "payload": [1]}, 400, {"payload": ["Payload must be an object."]}),
            (
                {**dice, "payload": {"rolls": [6] * 2000}},
                400,
                {"payload": ["Payload is too large (at most 4096 bytes)."]},
            ),
            ({"feature": "x" * 81, "entry_type": "dice_roll", "payload": {"a": 1}}, 400, None),
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
                body = {"feature": "dice_roll", "entry_type": "dice_roll", "payload": {"a": 1}}
                response = self.client.post(self._url(), body, format="json")
                self.assertEqual(response.status_code, write)
