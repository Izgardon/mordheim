"""William's answers of 15 November 2026 to the Mutiny in Marienburg write-up.

The duplicate stubs (decisions 1 and 3 to 9) are merged: in each case we hold a complete item from another setting and
the supplement contributes a bare price, so the stub is left out and its price becomes a price row of our item
labelled "Mutiny in Marienburg" (a price row has no setting of its own). The Handyman and the Beastmaster take the
document's extra words (decisions 21 and 22); the Pawnbroker and the Energy Focus keep their restrictions, which the
write-up recommended dropping and William did not (decisions 19 and 20).
"""

from collections import Counter
from typing import Any

from catalogue_import.common import load_json
from catalogue_import.mim import MERGE_LABEL
from catalogue_import.sources import OUT
from catalogue_import.tests.review_support import ReviewCase

# the stub, the item it joined, and the price the book printed for it (cost, dice, dice multiplier, rarity)
MERGES: list[tuple[str, str, tuple[int | None, int | None, int | None, int | None]]] = [
    ("Fish-hook Shot/Hunting Lasso", "Fish-Hook Shot", (10, None, None, 7)),
    ("Monkey's Paw", "Monkey's Paw", (50, 1, None, 10)),
    ("Opulent Coach", "Opulent Coach", (250, None, None, 10)),
    ("Riverboat", "Riverboat", (100, None, None, 8)),
    ("Rowing Boat", "Rowboat", (40, None, None, 7)),
    ("Barge", "River Barge", (200, None, None, 9)),
    ("Trade Wagon/Stage Coach", "Trade Wagon", (100, None, None, 7)),
    ("Hochland Long Hunting Rifle", "Hunting Rifle", (200, None, None, 11)),
    ("Double-barrelled Hunting Rifle", "Ostlander Double-barrelled Hunting Rifle", (300, None, None, 12)),
    ("Wolf Cloak/Norse Furs", "Wolfcloak", (10, None, None, None)),
]


class MimMergeTests(ReviewCase):
    def carried(self, item: str) -> list[tuple[Any, ...]]:
        """The item's price rows that came from Mutiny in Marienburg, as (cost, dice, multiplier, rarity)."""
        return [
            (row["cost"], row["dice"], row["dice_multiplier"], row["rarity"])
            for row in self.items[item]["availabilities"]
            if row["label"] == MERGE_LABEL
        ]

    def test_each_duplicate_stub_is_left_out(self) -> None:
        rows = load_json(OUT / "items.json")
        names = Counter(row["name"] for row in rows)
        for stub, item, _price in MERGES:
            with self.subTest(stub=stub):
                self.assertEqual(names[stub], 1 if stub == item else 0)
        self.assertEqual([row["name"] for row in rows if row["origin"] == "mim" and row["variant"]], [])

    def test_each_stubs_price_is_carried_onto_the_item_it_joined(self) -> None:
        for _stub, item, price in MERGES:
            with self.subTest(item=item):
                self.assertEqual(self.carried(item), [price])

    def test_the_marienburg_price_is_open_to_everyone_as_the_book_prints_it(self) -> None:
        [row] = [row for row in self.items["Riverboat"]["availabilities"] if row["label"] == MERGE_LABEL]
        self.assertEqual((row["for_everyone"], row["warbands"]), (True, []))
        [cloak] = [row for row in self.items["Wolfcloak"]["availabilities"] if row["label"] == MERGE_LABEL]
        self.assertEqual(cloak["note"], "Special availability")  # the rarity the book prints for it

    def test_the_stubs_name_and_the_hunting_lasso_are_tags_of_the_item_that_kept_it(self) -> None:
        self.assertIn("hunting lasso", self.items["Fish-Hook Shot"]["tags"])  # decision 1
        self.assertIn("fish-hook shot/hunting lasso", self.items["Fish-Hook Shot"]["tags"])
        self.assertIn("wolf cloak/norse furs", self.items["Wolfcloak"]["tags"])

    def test_the_hunting_rifle_keeps_its_name(self) -> None:
        # the write-up offered renaming it to Hochland Long Rifle, which its rules describe; William did not take it
        self.assertIn("Hunting Rifle", self.items)
        self.assertNotIn("Hochland Long Rifle", self.items)
        self.assertIn("hochland long hunting rifle", self.items["Hunting Rifle"]["tags"])
