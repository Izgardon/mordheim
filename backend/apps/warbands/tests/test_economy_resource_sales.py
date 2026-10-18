"""Selling a resource in one request: POST resources/<id>/sell/ (pass 2 PR A, BUG-68).

It used to be a PATCH of the amount and then a POST of the "Sell" ledger row; when the second failed, the
resource was gone and no gold came in.
"""

from typing import Any

from apps.warbands.models import WarbandResource
from apps.warbands.services.summary import warband_gold

from .roster_support import RosterTestCase, trade_rows


class ResourceSaleTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.shards = WarbandResource.objects.create(warband=self.warband, name="Wyrdstone", amount=3)

    def _sell(self, resource_id: int | None = None, **body: Any) -> Any:
        url = f"/api/warbands/{self.warband.id}/resources/{resource_id or self.shards.id}/sell/"
        return self.client.post(url, body, format="json")

    def _amount(self) -> int:
        self.shards.refresh_from_db()
        return self.shards.amount

    def test_a_sale_takes_the_resource_and_writes_the_ledger_row_together(self):
        response = self._sell(quantity=2, price=35)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(list(body), ["resource", "trade", "summary"])
        self.assertEqual(
            body["resource"], {"id": self.shards.id, "warband_id": self.warband.id, "name": "Wyrdstone", "amount": 1}
        )
        self.assertEqual(
            (body["trade"]["action"], body["trade"]["description"], body["trade"]["price"]),
            ("Sell", "Wyrdstone x 2", 35),
        )
        self.assertEqual(body["summary"], self.client.get(f"/api/warbands/{self.warband.id}/summary/").json())
        self.assertEqual((self._amount(), warband_gold(self.warband.id), body["summary"]["gold"]), (1, 35, 35))
        self.assertEqual(trade_rows(self.warband), [("Sell", "Wyrdstone x 2", 35, None)])

        last = self._sell(quantity=1, price=0)
        self.assertEqual((last.json()["resource"]["amount"], last.json()["trade"]["description"]), (0, "Wyrdstone"))

    def test_selling_more_than_held_sells_nothing(self):
        response = self._sell(quantity=4, price=10)

        self.assertEqual(
            (response.status_code, response.json()),
            (400, {"detail": "Not enough Wyrdstone to sell.", "code": "not_enough_resource"}),
        )
        self.assertEqual((self._amount(), trade_rows(self.warband)), (3, []))

    def test_bad_sales_and_unknown_resources(self):
        theirs = WarbandResource.objects.create(warband=self.rival, name="Warpstone", amount=5)
        for body, errors in (
            ({"quantity": 0, "price": 1}, ["quantity"]),
            ({"quantity": 1, "price": -1}, ["price"]),
            ({"price": 1}, ["quantity"]),
            ({"quantity": 1}, ["price"]),
        ):
            with self.subTest(body=body):
                response = self._sell(**body)
                self.assertEqual((response.status_code, list(response.json())), (400, errors))
        for resource_id in (theirs.id, 999999):
            response = self._sell(resource_id, quantity=1, price=1)
            self.assertEqual((response.status_code, response.json()), (404, {"detail": "Not found"}))
        self.assertEqual((self._amount(), trade_rows(self.warband), trade_rows(self.rival)), (3, [], []))

    def test_only_editors_may_sell(self):
        for user, expected in ((self.viewer, 403), (self.outsider, 404), (self.manager, 200)):
            with self.subTest(user=user.email):
                self.client.force_authenticate(user=user)
                self.assertEqual(self._sell(quantity=1, price=1).status_code, expected)
        self.assertEqual(self._amount(), 2)
