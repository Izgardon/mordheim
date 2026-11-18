"""overrides.json "item_saves": what equipping an item does to the wearer's save (William, 18 Nov 2026)."""

import json
from typing import Any

from django.test import SimpleTestCase

from catalogue_import.item_saves import set_saves
from catalogue_import.sources import OUT


def item(name: str, subtype: str = "") -> dict[str, Any]:
    return {"name": name, "subtype": subtype}


class SetSavesTests(SimpleTestCase):
    def test_a_bonus_its_slot_and_the_subtype_land_on_the_item(self) -> None:
        items = [item("Heavy Armour"), item("Sword", "Melee")]

        set_saves(items, {"Heavy Armour": {"bonus": 2, "slot": "body", "subtype": "Body Armour"}})

        self.assertEqual(items[0], {"name": "Heavy Armour", "subtype": "Body Armour", "save_bonus": 2, "save_slot": "body"})  # fmt: skip
        self.assertEqual(items[1], {"name": "Sword", "subtype": "Melee"})

    def test_an_item_with_no_bonus_takes_its_subtype_and_no_save_columns(self) -> None:
        items = [item("Helmet")]

        set_saves(items, {"Helmet": {"subtype": "Helmet", "why": "Helmets do nothing"}})

        self.assertEqual(items[0], {"name": "Helmet", "subtype": "Helmet"})

    def test_an_unknown_name_a_bonus_without_a_slot_and_a_silent_null_stop_the_build(self) -> None:
        with self.assertRaisesMessage(ValueError, "no item Mithril Shirt"):
            set_saves([item("Shield")], {"Mithril Shirt": {"bonus": 1, "slot": "body"}})
        with self.assertRaisesMessage(ValueError, "slot is ''"):
            set_saves([item("Shield")], {"Shield": {"bonus": 1}})
        with self.assertRaisesMessage(ValueError, "no bonus, so say why"):
            set_saves([item("Shield")], {"Shield": {"subtype": "Shield"}})


class BookSavesTests(SimpleTestCase):
    """The book's armour as the import writes it: its save read as steps from no save, which is 7+."""

    def setUp(self) -> None:
        self.items = {entry["name"]: entry for entry in json.loads((OUT / "items.json").read_text(encoding="utf-8"))}

    def saves(self, name: str) -> tuple[Any, Any, str]:
        entry = self.items[name]
        return entry.get("save_bonus"), entry.get("save_slot"), entry["subtype"]

    def test_the_armour_the_books_price_moves_the_save_by_its_steps(self) -> None:
        self.assertEqual(self.saves("Light Armour"), (1, "body", "Body Armour"))
        self.assertEqual(self.saves("Heavy Armour"), (2, "body", "Body Armour"))
        self.assertEqual(self.saves("Gromril Armour"), (3, "body", "Body Armour"))
        self.assertEqual(self.saves("Ithilmar Armour"), (2, "body", "Body Armour"))
        self.assertEqual(self.saves("Shield"), (1, "shield", "Shield"))
        self.assertEqual(self.saves("Barding"), (1, "extra", "Barding"))

    def test_a_helmet_and_a_conditional_save_move_nothing_and_every_armour_has_a_subtype(self) -> None:
        self.assertEqual(self.saves("Helmet"), (None, None, "Helmet"))
        self.assertEqual(self.saves("Kite Shield"), (None, None, "Shield"))  # 5+ on foot, 6+ mounted
        self.assertEqual(self.saves("Sea Dragon Cloak")[:2], (None, None))  # 5+ in combat, 4+ against missiles
        armour = [entry for entry in self.items.values() if entry["type"] == "Armour"]
        self.assertEqual([entry["name"] for entry in armour if not entry["subtype"]], [])
