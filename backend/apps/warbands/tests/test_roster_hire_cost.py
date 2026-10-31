"""Henchman hire cost (decision 7, BUG-66, BUG-85, henchmen loadouts).

One more member costs the group's base price, plus its loadout (one copy of each row: what every member carries),
plus twice its whole XP, in whole gc. The server charges it to a recruit whose entry names no cost, and every
henchmen payload carries it as `hire_cost`, so the roster card shows the server's figure.
"""

from decimal import Decimal
from typing import Any

from django.test import SimpleTestCase

from apps.warbands.models import HenchmenGroup
from apps.warbands.units.services.hire_cost import henchman_hire_cost

from .roster_support import HENCHMEN, RosterTestCase, make_unit, trade_rows, unit_url


class HireCostMathsTests(SimpleTestCase):
    def test_the_loadout_is_one_copy_of_each_row_and_an_unpriced_row_costs_nothing(self):
        self.assertEqual(henchman_hire_cost(0, 0, [10, 7, None]), 17)

    def test_the_cost_drops_half_xp_points_and_is_whole_gold(self):
        self.assertEqual(henchman_hire_cost(25, Decimal("20.5"), [10]), 25 + 10 + 40)
        self.assertEqual(henchman_hire_cost(None, None, []), 0)
        self.assertEqual(henchman_hire_cost(25, "3.9", []), 31)


class HireCostTests(RosterTestCase):
    group: HenchmenGroup

    def setUp(self) -> None:
        super().setUp()
        self.group = make_unit(HENCHMEN, self.warband, name="Zealots", price=25, xp=Decimal("4.5"), members=("A", "B"))
        self.group.henchmen_group_items.create(item=self.sword, cost=10)  # a sword each

    def _members(self) -> list[dict[str, Any]]:
        return [{"id": member.id} for member in self.group.henchmen.order_by("id")]

    def _patch(self, payload: dict[str, Any]) -> Any:
        response = self.client.patch(unit_url(HENCHMEN, self.warband.id, self.group.id), payload, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        return response.json()

    def test_payloads_carry_the_hire_cost(self):
        expected = 25 + 10 + 8  # price, the sword each, 2 x 4 whole XP
        detail = self.client.get(unit_url(HENCHMEN, self.warband.id, self.group.id)).json()
        listed = self.client.get(unit_url(HENCHMEN, self.warband.id)).json()
        sheet = self.client.get(f"/api/warbands/{self.warband.id}/sheet/").json()
        self.assertEqual(
            [detail["hire_cost"], listed[0]["hire_cost"], sheet["henchmen_groups"][0]["hire_cost"]], [expected] * 3
        )

    def test_a_recruit_without_a_cost_is_charged_the_hire_cost_shown_before_the_save(self):
        shown = self.client.get(unit_url(HENCHMEN, self.warband.id, self.group.id)).json()["hire_cost"]

        body = self._patch({"henchmen": [*self._members(), {"name": "C"}]})

        self.assertEqual(trade_rows(self.warband), [("Recruit", "C into Zealots", -shown, None)])
        self.assertEqual(body["hire_cost"], 25 + 10 + 8)
        self.assertEqual([item["carriers"] for item in body["items"]], [3])  # he carries the sword too

    def test_rows_bought_in_the_same_save_are_not_part_of_the_recruits_cost(self):
        items = [{"id": self.sword.id, "cost": 10}, {"id": self.axe.id, "cost": 15}]

        self._patch({"henchmen": [*self._members(), {"name": "C"}], "items": items})

        self.assertEqual(trade_rows(self.warband), [("Recruit", "C into Zealots", -43, None)])

    def test_an_explicit_cost_still_wins(self):
        self._patch({"henchmen": [*self._members(), {"name": "C", "cost": 12}]})
        self.assertEqual(trade_rows(self.warband), [("Recruit", "C into Zealots", -12, None)])

    def test_the_xp_and_price_sent_in_the_same_save_set_the_cost(self):
        self._patch({"henchmen": [*self._members(), {"name": "C"}], "xp": "7.5", "price": 30})
        self.assertEqual(trade_rows(self.warband), [("Recruit", "C into Zealots", -(30 + 10 + 14), None)])
