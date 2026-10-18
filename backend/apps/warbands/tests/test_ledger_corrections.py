"""Corrections (pass 2 decision 5): ledger history is append-only.

A mistake is corrected with an "Adjustment" row (signed, its description the reason) that may name the row it
corrects. A row entered by hand keeps its description and notes editable (PATCH trades/<id>/); amounts,
actions and rows the server wrote never change, and no row is deleted.
"""

from typing import Any

from apps.warbands.models import LedgerAction, WarbandItem, WarbandTrade
from apps.warbands.services import ledger
from apps.warbands.services.summary import warband_gold

from .roster_support import RosterTestCase, trade_rows


class AdjustmentTests(RosterTestCase):
    def _url(self) -> str:
        return f"/api/warbands/{self.warband.id}/trades/"

    def _post(self, body: dict[str, Any]) -> Any:
        return self.client.post(self._url(), body, format="json")

    def test_an_adjustment_corrects_a_row_with_a_reason(self):
        reward = self._post({"action": "Reward", "description": "we", "price": 1000}).json()

        response = self._post(
            {
                "action": "Adjustment",
                "description": "Typo: the reward was 100",
                "price": -900,
                "corrects_id": reward["id"],
            }
        )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual((body["action"], body["price"], body["corrects_id"]), ("Adjustment", -900, reward["id"]))
        self.assertEqual(warband_gold(self.warband.id), 100)
        self.assertEqual(WarbandTrade.objects.get(id=reward["id"]).corrections.get().id, body["id"])
        listed = {row["id"]: row["corrects_id"] for row in self.client.get(self._url()).json()}
        self.assertEqual(listed, {reward["id"]: None, body["id"]: reward["id"]})

    def test_only_an_adjustment_corrects_and_only_a_row_of_this_ledger(self):
        row = ledger.record(self.warband, LedgerAction.BUY, -10, "Rope")
        theirs = ledger.record(self.rival, LedgerAction.BUY, -10, "Rope")
        cases = [
            ({"action": "Buy", "corrects_id": row.id}, {"corrects_id": ["Only an adjustment corrects another row."]}),
            (
                {"action": "Adjustment", "corrects_id": theirs.id},
                {"corrects_id": ["Not a row of this warband's ledger."]},
            ),
            ({"action": "Adjustment", "corrects_id": 999999}, {"corrects_id": ["Not a row of this warband's ledger."]}),
        ]
        for body, errors in cases:
            with self.subTest(body=body):
                response = self._post({"description": "Fix", "price": 5, **body})
                self.assertEqual((response.status_code, response.json()), (400, errors))
        self.assertEqual(trade_rows(self.warband), [("Buy", "Rope", -10, None)])
        self.assertEqual(warband_gold(self.warband.id), -10)


class RowEditTests(RosterTestCase):
    def _url(self, row_id: int) -> str:
        return f"/api/warbands/{self.warband.id}/trades/{row_id}/"

    def _manual_row(self) -> Any:
        body = {"action": "Buy", "description": "Rope", "price": 10, "notes": "From the docks"}
        return self.client.post(f"/api/warbands/{self.warband.id}/trades/", body, format="json").json()

    def test_a_hand_entered_rows_description_and_notes_can_change(self):
        row = self._manual_row()

        response = self.client.patch(
            self._url(row["id"]), {"description": " Rope, 10 yards ", "notes": ""}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual((body["description"], body["notes"], body["price"]), ("Rope, 10 yards", "", -10))
        self.assertEqual(body["created_by"], {"id": self.player.id, "name": self.player.first_name})
        self.assertEqual(trade_rows(self.warband), [("Buy", "Rope, 10 yards", -10, None)])

    def test_nothing_else_can_change(self):
        row = self._manual_row()
        message = ["Only the description and notes can change; correct the gold with an adjustment."]

        response = self.client.patch(
            self._url(row["id"]), {"description": "Rope", "price": 1, "action": "Sell", "parent_id": 1}, format="json"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"action": message, "parent_id": message, "price": message})
        self.assertEqual(trade_rows(self.warband), [("Buy", "Rope", -10, None)])
        self.assertEqual(warband_gold(self.warband.id), -10)

    def test_a_row_the_server_wrote_is_corrected_with_an_adjustment_instead(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=1, cost=10)
        sale = {"source_type": "stash", "item_id": self.sword.id, "quantity": 1, "price": 5}
        self.client.post(f"/api/warbands/{self.warband.id}/item-sales/", sale, format="json")
        sold = WarbandTrade.objects.get(warband=self.warband)

        response = self.client.patch(self._url(sold.id), {"description": "Sword (rusty)"}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "not_editable")
        self.assertEqual(trade_rows(self.warband), [("Sell", "Sword", 5, None)])

    def test_no_row_is_deleted_and_other_ledgers_are_out_of_reach(self):
        row = self._manual_row()
        theirs = ledger.record(self.rival, LedgerAction.BUY, -10, "Rope", created_by=self.viewer)

        self.assertEqual(self.client.delete(self._url(row["id"])).status_code, 405)
        self.assertEqual(self.client.patch(self._url(theirs.id), {"notes": "x"}, format="json").status_code, 404)
        self.assertEqual(self.client.patch(self._url(999999), {"notes": "x"}, format="json").status_code, 404)
        self.assertEqual(len(trade_rows(self.warband)), 1)

    def test_editors_edit_and_members_only_read(self):
        row = self._manual_row()
        for user, status in ((self.viewer, 403), (self.outsider, 404), (self.manager, 200), (self.admin, 200)):
            with self.subTest(user=user.email):
                self.client.force_authenticate(user=user)
                response = self.client.patch(self._url(row["id"]), {"notes": user.email}, format="json")
                self.assertEqual(response.status_code, status)
