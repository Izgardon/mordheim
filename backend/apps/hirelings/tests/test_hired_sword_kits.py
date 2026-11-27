"""The committed hired swords' kits resolve to the items they mean (the items audit, 27 Nov 2026).

A kit line names an item the book data spells its own way, and `core/book_lookups.py` reads it as ours: a Whip is our
Steel Whip (as `persona_item_names` makes Heinrich 'Altdorf' Schmidt's), never the Marauders' Barbed Whip; the
Highwayman's brace of pistols is two pistols; and the Clan Skryre Rat Ogre's claws are his own, never Clan Eshin's
Fighting Claws.
"""

import json
from pathlib import Path
from typing import Any, ClassVar

from django.test import TestCase

from apps.core.book_lookups import BookLookups
from apps.items.models import Item

DATA = Path(__file__).resolve().parents[1] / "data" / "hired-swords.json"
NAMES = ("Steel Whip", "Barbed Whip", "Pistol", "Fighting Claws", "Dagger", "Sword", "Rapier", "Buckler")


class HiredSwordKitTests(TestCase):
    rows: ClassVar[dict[str, dict[str, Any]]]

    @classmethod
    def setUpTestData(cls):
        for name in NAMES:
            Item.objects.create(name=name, type="Weapon")
        Item.objects.create(name="Light Armour", type="Armour")
        cls.rows = {row["name"]: row for row in json.loads(DATA.read_text())}

    def kit(self, name: str) -> dict[str, int]:
        lookups = BookLookups()
        links = lookups.links(self.rows[name], name)
        by_id = {item.id: item.name for item in Item.objects.all()}
        return {by_id[pk]: line.quantity for pk, line in links.equipment.items()}

    def test_a_whip_is_our_steel_whip(self):
        self.assertEqual(self.kit("Mule Skinner"), {"Steel Whip": 1, "Dagger": 1})
        self.assertEqual(self.kit("Coachman"), {"Steel Whip": 1, "Sword": 1, "Light Armour": 1})

    def test_the_highwaymans_brace_is_two_pistols(self):
        self.assertEqual(self.kit("Highwayman")["Pistol"], 2)

    def test_the_rat_ogre_fights_with_his_own_claws(self):
        self.assertEqual(self.kit("Clan Skryre Rat Ogre"), {})


class StaffKitTests(TestCase):
    """William, 27 Nov 2026: "Quarter staff is its own item with different rules, give it to people that have it,
    otherwise give ... staff as a nickname to hired swords that just have a mace/hammer named as a staff"."""

    rows: ClassVar[dict[str, dict[str, Any]]]

    @classmethod
    def setUpTestData(cls):
        for name in ("Mace", "Quarter Staff", "Bo", "Sword", "Throwing Knives/Stars/Axes"):
            Item.objects.create(name=name, type="Weapon")
        Item.objects.create(name="Elven Cloak", type="Miscellaneous")
        Item.objects.create(name="Toughened Leathers", type="Armour")
        cls.rows = {row["name"]: row for row in json.loads(DATA.read_text())}

    def kit(self, name: str) -> dict[str, tuple[int, str]]:
        links = BookLookups().links(self.rows[name], name)
        by_id = {item.id: item.name for item in Item.objects.all()}
        return {by_id[pk]: (line.quantity, line.shown_as) for pk, line in links.equipment.items()}

    def test_a_casters_plain_staff_is_our_mace_shown_as_his_staff(self):
        for name in ("Warlock", "Witch", "Dark Mage"):
            with self.subTest(hired_sword=name):
                self.assertEqual(self.kit(name), {"Mace": (1, "Staff")})
        self.assertEqual(self.kit("Elf Mage"), {"Mace": (1, "Staff"), "Elven Cloak": (1, "")})
        self.assertEqual(self.kit("Norse Shaman"), {"Mace": (1, "Rune Staff"), "Sword": (1, "")})

    def test_the_ninja_gnoblars_bo_is_his_own_weapon(self):
        self.assertEqual(
            self.kit("Ninja Gnoblar"),
            {"Toughened Leathers": (1, ""), "Throwing Knives/Stars/Axes": (1, ""), "Bo": (1, "")},
        )
