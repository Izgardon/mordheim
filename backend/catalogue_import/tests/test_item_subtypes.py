"""overrides.json "item_subtypes": one subtype per kind (William, 25 Nov 2026: merge the near-duplicates)."""

import json
from collections import Counter
from typing import Any

from django.test import SimpleTestCase

from catalogue_import.item_subtypes import merge_subtypes
from catalogue_import.sources import OUT

MERGES = {"Missile": "Ranged", "Drug/Poison": "Poisons and Drugs", "Vehicle/Watercraft": "Vehicles"}


def item(name: str, subtype: str) -> dict[str, Any]:
    return {"name": name, "subtype": subtype}


class MergeSubtypesTests(SimpleTestCase):
    def test_a_merged_subtype_takes_the_one_it_merges_into_and_the_rest_keep_theirs(self) -> None:
        items = [item("Acid Bomb", "Missile"), item("Daemon Dust", "Drug/Poison"), item("Sword", "Melee"), item("Rope", "")]  # fmt: skip

        merge_subtypes(items, MERGES)

        self.assertEqual([entry["subtype"] for entry in items], ["Ranged", "Poisons and Drugs", "Melee", ""])

    def test_a_merge_into_a_name_merged_away_stops_the_build(self) -> None:
        with self.assertRaisesMessage(ValueError, "Ranged is merged away and merged into"):
            merge_subtypes([item("Bow", "Ranged")], {"Missile": "Ranged", "Ranged": "Shooting"})


class BookSubtypesTests(SimpleTestCase):
    """The import as built: no item is left under a subtype merged away."""

    def setUp(self) -> None:
        self.items = json.loads((OUT / "items.json").read_text(encoding="utf-8"))
        self.subtypes = Counter(entry["subtype"] for entry in self.items)

    def test_no_item_keeps_a_merged_subtype(self) -> None:
        for merged in MERGES:
            self.assertNotIn(merged, self.subtypes)

    def test_the_merged_items_sit_with_their_kind(self) -> None:
        by_name = {entry["name"]: entry for entry in self.items}
        self.assertEqual(by_name["Gladewood Bow"]["subtype"], "Ranged")
        self.assertEqual(by_name["Daemon Dust"]["subtype"], "Poisons and Drugs")
        self.assertEqual(by_name["Treasure Cart"]["subtype"], "Vehicles")

    def test_the_overrides_hold_the_merges(self) -> None:
        overrides = json.loads((OUT.parent / "overrides.json").read_text(encoding="utf-8"))
        self.assertEqual(overrides["item_subtypes"], MERGES)
