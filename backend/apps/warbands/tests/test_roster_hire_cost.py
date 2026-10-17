"""Henchman hire cost (decision 7, BUG-66, BUG-85).

One more member costs the group's base price, plus one member's share of the group's items, plus twice
its whole XP, in whole gc. The server charges it to a recruit whose entry names no cost, and every
henchmen payload carries it as `hire_cost`, so the roster card shows the server's figure.
"""

from decimal import Decimal
from typing import Any

from django.test import SimpleTestCase

from apps.warbands.models import HenchmenGroup
from apps.warbands.units.services.hire_cost import henchman_hire_cost, member_item_share

from .roster_support import HENCHMEN, RosterTestCase, make_unit, trade_rows, unit_url


class HireCostMathsTests(SimpleTestCase):
    def test_a_members_share_is_each_items_copies_over_the_members_at_least_one(self):
        cases: list[tuple[list[tuple[int, int | None]], int, int]] = [
            ([], 3, 0),
            ([(1, 10), (1, 10), (1, 10)], 3, 10),  # one sword each
            ([(1, 10)] * 8, 4, 20),  # two daggers each
            ([(1, 10)], 3, 10),  # fewer copies than members: still one copy
            ([(1, 10), (2, 7)], 0, 17),  # no members left: one copy of each
            ([(1, 10), (1, 4)], 2, 10),  # priced at the item's first row
            ([(1, None), (2, 5)], 1, 5),  # an unpriced row costs nothing
        ]
        for rows, members, expected in cases:
            with self.subTest(rows=rows, members=members):
                self.assertEqual(member_item_share(rows, members), expected)

    def test_the_cost_drops_half_xp_points_and_is_whole_gold(self):
        self.assertEqual(henchman_hire_cost(25, Decimal("20.5"), [(1, 10)], 1), 25 + 10 + 40)
        self.assertEqual(henchman_hire_cost(None, None, [], 0), 0)
        self.assertEqual(henchman_hire_cost(25, "3.9", [], 2), 31)


class HireCostTests(RosterTestCase):
    group: HenchmenGroup

    def setUp(self) -> None:
        super().setUp()
        self.group = make_unit(HENCHMEN, self.warband, name="Zealots", price=25, xp=Decimal("4.5"), members=("A", "B"))
        for _ in range(2):
            self.group.henchmen_group_items.create(item=self.sword, cost=10)

    def _members(self) -> list[dict[str, Any]]:
        return [{"id": member.id} for member in self.group.henchmen.order_by("id")]

    def _patch(self, payload: dict[str, Any]) -> Any:
        response = self.client.patch(unit_url(HENCHMEN, self.warband.id, self.group.id), payload, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        return response.json()

    def test_payloads_carry_the_hire_cost(self):
        expected = 25 + 10 + 8  # price, one sword, 2 x 4 whole XP
        detail = self.client.get(unit_url(HENCHMEN, self.warband.id, self.group.id)).json()
        listed = self.client.get(unit_url(HENCHMEN, self.warband.id)).json()
        sheet = self.client.get(f"/api/warbands/{self.warband.id}/sheet/").json()
        self.assertEqual(
            [detail["hire_cost"], listed[0]["hire_cost"], sheet["henchmen_groups"][0]["hire_cost"]], [expected] * 3
        )

    def test_a_recruit_without_a_cost_is_charged_the_hire_cost_shown_before_the_save(self):
        shown = self.client.get(unit_url(HENCHMEN, self.warband.id, self.group.id)).json()["hire_cost"]
        # the client sends the items with the recruit's sword already added, as the roster form does
        items = [{"id": self.sword.id, "cost": 10}] * 3

        body = self._patch({"henchmen": [*self._members(), {"name": "C"}], "items": items})

        self.assertEqual(trade_rows(self.warband), [("Recruited", "C into Zealots", -shown, None)])
        self.assertEqual(body["hire_cost"], 25 + 10 + 8)  # three swords for three members: still one each

    def test_items_bought_in_the_same_save_are_not_part_of_the_recruits_cost(self):
        items = [{"id": self.sword.id, "cost": 10}] * 3 + [{"id": self.axe.id, "cost": 15}] * 3

        self._patch({"henchmen": [*self._members(), {"name": "C"}], "items": items})

        self.assertEqual(trade_rows(self.warband), [("Recruited", "C into Zealots", -43, None)])

    def test_an_explicit_cost_still_wins(self):
        self._patch({"henchmen": [*self._members(), {"name": "C", "cost": 12}]})
        self.assertEqual(trade_rows(self.warband), [("Recruited", "C into Zealots", -12, None)])

    def test_the_xp_and_price_sent_in_the_same_save_set_the_cost(self):
        self._patch({"henchmen": [*self._members(), {"name": "C"}], "xp": "7.5", "price": 30})
        self.assertEqual(trade_rows(self.warband), [("Recruited", "C into Zealots", -(30 + 10 + 14), None)])

    def test_dead_and_dismissed_members_do_not_share_the_items(self):
        dead = self.group.henchmen.create(name="Fallen", dead=True)
        self.group.henchmen.create(name="Gone", dismissed_at="2026-01-01T00:00:00Z")
        for _ in range(2):  # the fallen and the gone carried two more swords
            self.group.henchmen_group_items.create(item=self.sword, cost=10)

        detail = self.client.get(unit_url(HENCHMEN, self.warband.id, self.group.id)).json()

        self.assertEqual(detail["hire_cost"], 25 + 20 + 8)  # four swords for two living members: two each
        self.assertTrue(self.group.henchmen.filter(id=dead.id).exists())
