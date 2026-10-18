"""The server logs sales and moves in the same transaction as the change (ECON-CQ-02).

They used to leave no log (a sale wrote only its ledger row). Discards and completed trades are covered with
their endpoints (test_economy_characterisation_stash, trades' test_trade_characterisation_locks).
"""

from apps.warbands.models import WarbandItem

from .roster_support import HENCHMEN, HERO, RosterTestCase, log_rows, make_unit


class EconomyLogTests(RosterTestCase):
    def _post(self, path: str, body: dict) -> int:
        return self.client.post(f"/api/warbands/{self.warband.id}/{path}", body, format="json").status_code

    def test_a_sale_logs_the_item_its_price_and_where_it_came_from(self):
        hero = make_unit(HERO, self.warband, name="Ana")
        hero.hero_items.create(item=self.sword, cost=10)
        WarbandItem.objects.create(warband=self.warband, item=self.axe, quantity=3, cost=5)

        from_stash = {"source_type": "stash", "item_id": self.axe.id, "quantity": 2, "price": 6}
        from_hero = {"source_type": "hero", "source_id": hero.id, "item_id": self.sword.id, "quantity": 1, "price": 5}
        self.assertEqual((self._post("item-sales/", from_stash), self._post("item-sales/", from_hero)), (200, 200))

        stash = {"source_type": "stash", "source_name": None}
        self.assertEqual(
            log_rows(self.warband),
            [
                ("items", "sold", {"item": "Axe", "quantity": 2, "price": 6, **stash}, None),
                (
                    "items",
                    "sold",
                    {"item": "Sword", "quantity": 1, "price": 5, "source_type": "hero", "source_name": "Ana"},
                    None,
                ),
            ],
        )

    def test_a_move_logs_both_ends(self):
        hero = make_unit(HERO, self.warband, name="Ana")
        group = make_unit(HENCHMEN, self.warband, name="", unit_type="Zealot")  # no name: the type stands in
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=2, cost=10)

        to_hero = {"source_type": "stash", "target_type": "hero", "target_id": hero.id}
        to_group = {"source_type": "hero", "source_id": hero.id, "target_type": "henchmen_group", "target_id": group.id}
        self.assertEqual(self._post("item-transfers/", {**to_hero, "item_id": self.sword.id, "quantity": 2}), 200)
        self.assertEqual(self._post("item-transfers/", {**to_group, "item_id": self.sword.id, "quantity": 1}), 200)

        moved = {"item": "Sword", "source_type": "stash", "source_name": None, "target_type": "hero"}
        onward = {"item": "Sword", "source_type": "hero", "source_name": "Ana", "target_type": "henchmen_group"}
        self.assertEqual(
            log_rows(self.warband),
            [
                ("items", "moved", {**moved, "quantity": 2, "target_name": "Ana"}, None),
                ("items", "moved", {**onward, "quantity": 1, "target_name": "Zealot"}, None),
            ],
        )

    def test_a_refused_move_or_sale_logs_nothing(self):
        WarbandItem.objects.create(warband=self.warband, item=self.sword, quantity=1, cost=10)

        missing_target = {"source_type": "stash", "target_type": "hero", "target_id": 999999}
        too_many = {"source_type": "stash", "item_id": self.sword.id, "quantity": 2, "price": 5}
        self.assertEqual(
            self._post("item-transfers/", {**missing_target, "item_id": self.sword.id, "quantity": 1}), 404
        )
        self.assertEqual(self._post("item-sales/", too_many), 400)

        self.assertEqual(log_rows(self.warband), [])
