"""A wizard in armour is warned (William, 27 Nov 2026: "If a unit is marked as a wizard and they have armour in their
equipment then it should warn the player they can't have armour. This shouldn't affect priests.").

His Wizard rule reads "He may cast no spell while he wears armour (including shields)", so any Armour item he holds
(a shield or a helmet too, not a mount's barding) puts a warning in his payload (`warnings`) and in the answer of a
purchase that arms him. Nothing is refused, and a priest is never warned.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.items.models import Item, ItemAvailability

from .roster_support import HERO, HIRELING, Kind, RosterTestCase, make_unit, unit_url

WARNING = {"code": "wizard_in_armour", "message": "A wizard may cast no spell while he wears armour (Shield)."}


def _armour(name: str, subtype: str) -> Item:
    item = Item.objects.create(name=name, type="Armour", subtype=subtype, save_value="6+")
    ItemAvailability.objects.create(item=item, cost=5)
    return item


class WizardArmourTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.shield = _armour("Shield", "Shield")
        self.helmet = _armour("Helmet", "Helmet")
        self.barding = _armour("Barding", "Barding")

    def _payload(self, kind: Kind, unit: Any) -> Any:
        response = self.client.get(unit_url(kind, self.warband.id, unit.pk))
        self.assertEqual(response.status_code, 200, response.data)
        return response.json()

    def test_a_wizard_holding_armour_is_warned_on_every_kind_with_a_caster(self):
        for kind in (HERO, HIRELING):
            with self.subTest(kind=kind):
                unit = make_unit(kind, self.warband, name=f"Magister {kind}", caster="Wizard")
                getattr(unit, kind.items).create(item=self.shield, cost=5)
                getattr(unit, kind.items).create(item=self.sword, cost=10)

                self.assertEqual(self._payload(kind, unit)["warnings"], [WARNING])

    def test_the_warning_names_each_piece_once(self):
        hero = make_unit(HERO, self.warband, caster="Wizard")
        for item in (self.shield, self.helmet, self.shield):
            hero.hero_items.create(item=item, cost=5)

        message = self._payload(HERO, hero)["warnings"][0]["message"]

        self.assertEqual(message, "A wizard may cast no spell while he wears armour (Shield, Helmet).")

    def test_a_priest_a_plain_hero_a_wizard_without_armour_and_his_horses_barding_are_not_warned(self):
        cases = (("Priest", self.shield), ("No", self.shield), ("Wizard", self.sword), ("Wizard", self.barding))
        for caster, item in cases:
            with self.subTest(caster=caster, item=item.name):
                hero = make_unit(HERO, self.warband, caster=caster)
                hero.hero_items.create(item=item, cost=5)
                self.assertEqual(self._payload(HERO, hero)["warnings"], [])

    def test_the_sheet_carries_it_without_a_query_more_per_unit(self):
        def sheet() -> tuple[int, Any]:
            with CaptureQueriesContext(connection) as captured:
                response = self.client.get(f"/api/warbands/{self.warband.id}/sheet/")
            self.assertEqual(response.status_code, 200)
            return len(captured), response.json()

        make_unit(HERO, self.warband, caster="Wizard").hero_items.create(item=self.shield, cost=5)
        first, body = sheet()
        for _ in range(3):
            make_unit(HERO, self.warband, caster="Wizard").hero_items.create(item=self.helmet, cost=5)
        again, body = sheet()

        self.assertEqual(again, first)
        self.assertEqual([hero["warnings"][0]["code"] for hero in body["heroes"]], ["wizard_in_armour"] * 4)

    def test_buying_armour_for_a_wizard_warns_and_goes_ahead(self):
        wizard = make_unit(HERO, self.warband, name="Ulric", caster="Wizard")
        priest = make_unit(HERO, self.warband, name="Brother", caster="Priest")
        url = f"/api/warbands/{self.warband.id}/purchases/"

        bought = self.client.post(
            url, {"item_id": self.shield.id, "price": 5, "target_type": "hero", "target_id": wizard.id}
        )
        blessed = self.client.post(
            url, {"item_id": self.shield.id, "price": 5, "target_type": "hero", "target_id": priest.id}
        )

        self.assertEqual(bought.status_code, 201, bought.data)
        message = "Ulric is a wizard: a wizard may cast no spell while he wears armour (Shield)."
        self.assertIn({"code": "wizard_in_armour", "message": message, "unit_id": wizard.id}, bought.json()["warnings"])
        self.assertEqual(wizard.hero_items.count(), 1)
        self.assertEqual([w["code"] for w in blessed.json()["warnings"] if w["code"] == "wizard_in_armour"], [])
