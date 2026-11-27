"""William's answers of 15 November 2026 to the Mutiny in Marienburg write-up.

The duplicate stubs (decisions 1 and 3 to 9) are merged: in each case we hold a complete item from another setting and
the supplement contributes a bare price, so the stub is left out and its price becomes a price row of our item
labelled "Mutiny in Marienburg", in that setting, so it counts only where Marienburg is in play (27 Nov 2026) -- unless our item already shows that line, at
the same cost, dice and rarity and open to everyone too, when carrying it over would only say the same thing twice. The Handyman and the Beastmaster take the
document's extra words (decisions 21 and 22); the Pawnbroker and the Energy Focus keep their restrictions, which the
write-up recommended dropping and William did not (decisions 19 and 20).
"""

from collections import Counter
from typing import Any

from catalogue_import.common import load_json
from catalogue_import.mim import MERGE_LABEL
from catalogue_import.sources import OUT
from catalogue_import.tests.review_support import ReviewCase

Price = tuple[int | None, int | None, int | None, int | None]  # cost, dice, dice multiplier, rarity

# the stub, the item it joined, and the price the book printed for it, where that price says something our item did
# not: a price open to everyone where ours names warbands, a cost of its own, or an exclusion ours carries
CARRIED: list[tuple[str, str, Price]] = [
    ("Fish-hook Shot/Hunting Lasso", "Fish-Hook Shot", (10, None, None, 7)),  # ours: two warbands' rows
    ("Trade Wagon/Stage Coach", "Trade Wagon", (100, None, None, 7)),  # ours: 180 gc, the Merchant Caravans'
    ("Hochland Long Hunting Rifle", "Hunting Rifle", (200, None, None, 11)),  # ours shuts the Dark Elves out
    (
        "Double-barrelled Hunting Rifle",
        "Ostlander Double-barrelled Hunting Rifle",
        (300, None, None, 12),
    ),  # Ostlanders'  # noqa: E501
    ("Wild Boar/Pig", "War Boar", (90, None, None, 11)),  # ours: the Orc warbands' two rows (16 Nov 2026)
]
# the stubs whose price our item already showed, line for line: nothing was carried
TWINS: list[tuple[str, str]] = [
    ("Monkey's Paw", "Monkey's Paw"),
    ("Opulent Coach", "Opulent Coach"),
    ("Riverboat", "Riverboat"),
    ("Rowing Boat", "Rowboat"),
    ("Barge", "River Barge"),
]
# the stubs whose price William keeps off our item (27 Nov 2026: "wolf cloak doesn't really go to everyone due to its
# purchase path"): its own rows sell it to the warbands whose lists hunt for it
KEPT_OFF: list[tuple[str, str]] = [("Wolf Cloak/Norse Furs", "Wolfcloak")]
MERGES = [(stub, item) for stub, item, _price in CARRIED] + TWINS + KEPT_OFF


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
        for stub, item in MERGES:
            with self.subTest(stub=stub):
                self.assertEqual(names[stub], 1 if stub == item else 0)
        self.assertEqual([row["name"] for row in rows if row["origin"] == "mim" and row["variant"]], [])

    def test_a_price_that_says_something_ours_did_not_is_carried_onto_the_item(self) -> None:
        for _stub, item, price in CARRIED:
            with self.subTest(item=item):
                self.assertEqual(self.carried(item), [price])

    def test_a_price_our_item_already_showed_or_william_keeps_off_is_not_carried(self) -> None:
        for _stub, item in TWINS + KEPT_OFF:
            with self.subTest(item=item):
                self.assertEqual(self.carried(item), [])

    def test_no_item_shows_one_price_twice(self) -> None:
        """The rule the merge follows: a row open to everyone is not carried over when the item already has its
        cost, dice and rarity open to everyone, whatever either row is labelled."""
        for row in load_json(OUT / "items.json"):
            open_rows = Counter(
                (price["cost"], price["dice"], price["dice_multiplier"], price["rarity"])
                for price in row["availabilities"]
                if price["for_everyone"] and not price["warbands"]
            )
            with self.subTest(item=row["name"]):
                self.assertEqual([price for price, seen in open_rows.items() if seen > 1], [])

    def test_the_marienburg_price_is_open_to_everyone_as_the_book_prints_it(self) -> None:
        [row] = [row for row in self.items["Hunting Rifle"]["availabilities"] if row["label"] == MERGE_LABEL]
        # ours shuts the Dark Elves out, so this row is what lets them buy one at all, where Marienburg is in play
        self.assertEqual((row["for_everyone"], row["warbands"]), (True, []))
        [boar] = [row for row in self.items["War Boar"]["availabilities"] if row["label"] == MERGE_LABEL]
        # ours are the Orc warbands', so this row is what sells a boar to a Marienburg warband at all
        self.assertEqual((boar["for_everyone"], boar["warbands"]), (True, []))

    def test_the_stubs_name_and_the_hunting_lasso_are_tags_of_the_item_that_kept_it(self) -> None:
        self.assertIn("hunting lasso", self.items["Fish-Hook Shot"]["tags"])  # decision 1
        self.assertIn("fish-hook shot/hunting lasso", self.items["Fish-Hook Shot"]["tags"])
        self.assertIn("wolf cloak/norse furs", self.items["Wolfcloak"]["tags"])

    def test_the_hunting_rifle_keeps_its_name(self) -> None:
        # the write-up offered renaming it to Hochland Long Rifle, which its rules describe; William did not take it
        self.assertIn("Hunting Rifle", self.items)
        self.assertNotIn("Hochland Long Rifle", self.items)
        self.assertIn("hochland long hunting rifle", self.items["Hunting Rifle"]["tags"])


class MimSkillTests(ReviewCase):
    def test_the_handyman_covers_a_wagon_cart_or_coach_and_the_wheel_that_flew_off(self) -> None:
        text = self.skills["Handyman"]
        self.assertIn("minor damage on a wagon, cart or coach", text)
        self.assertIn("He can even set in a new wheel if it flew off.", text)

    def test_the_beastmaster_controls_one_animal_at_a_time(self) -> None:
        self.assertIn("No more than one animal can be controlled this way.", self.skills["Beastmaster"])

    def test_the_pawnbroker_and_the_energy_focus_keep_their_restrictions(self) -> None:
        # William overruled the write-up here (decisions 19 and 20): a player who wants one gives the unit the
        # skill group in Edit
        self.assertTrue(self.skills["Pawnbroker"].startswith("Merchant only."))
        self.assertTrue(self.skills["Energy Focus"].startswith("Dragon Monks only."))
