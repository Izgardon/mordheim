"""The random mutation table (random_mutations.py, William, 5 Nov 2026): each D66 result gives one shared special,
matched by what it does (its name or an alias in William's list); a result naming none, or a table that isn't 11-66
once each, stops the build."""

import copy
import json
from typing import Any

from django.test import SimpleTestCase

from catalogue_import.random_mutations import D66, RANDOM_SOURCE, build_random_mutations, render_random
from catalogue_import.shared_specials import SharedSpecials, load_shared
from catalogue_import.sources import OUT

LIST: dict[str, Any] = {
    "shared": [
        {"name": "Spit Acid", "type": "Bounty of Arkhar", "text": "Acid.", "cost": 35, "aliases": ["Acid Spray"]},
        {"name": "Warts", "type": "Mutation", "text": "Warts.", "aliases": []},
        {
            "name": "Burning Body",
            "type": "Mutation",
            "text": "Hot.",
            "apart_from": "Burning Body (Tchar)",
            "why": "S2.",
            "aliases": [],
        },
    ],
    "apart": [],
}


def table(*names: str) -> dict[str, Any]:
    results = [{"roll": roll, "name": "Warts"} for roll in D66]
    for at, name in enumerate(names):
        results[at] = {"roll": D66[at], "name": name}
    return {"results": results}


class RandomMutationTests(SimpleTestCase):
    def setUp(self) -> None:
        self.shared = SharedSpecials(copy.deepcopy(LIST))

    def test_a_result_gives_the_special_its_name_or_alias_names(self) -> None:
        rows = build_random_mutations(self.shared, table("Acid Spray", "Burning Body"))

        self.assertEqual(
            rows[:3],
            [
                {
                    "roll": 11,
                    "name": "Acid Spray",
                    "special": {"name": "Spit Acid", "type": "Bounty of Arkhar"},
                },
                {
                    "roll": 12,
                    "name": "Burning Body",
                    "special": {"name": "Burning Body", "type": "Mutation"},
                },
                {"roll": 13, "name": "Warts", "special": {"name": "Warts", "type": "Mutation"}},
            ],
        )
        report = render_random(rows, self.shared)
        self.assertIn("| 11 | Acid Spray | Spit Acid | Bounty of Arkhar | 35 |  |", report)
        self.assertIn("| 12 | Burning Body | the same | Mutation |  |  |", report)
        self.assertIn("- Burning Body and Burning Body (Tchar): S2.", report)

    def test_a_result_naming_no_special_or_a_roll_out_of_place_stops_the_build(self) -> None:
        with self.assertRaisesRegex(ValueError, "11 Eyestalks names no shared special"):
            build_random_mutations(self.shared, table("Eyestalks"))
        shuffled = table()
        shuffled["results"].reverse()
        with self.assertRaisesRegex(ValueError, "the rolls aren't 11-66 once each in order"):
            build_random_mutations(self.shared, shuffled)


class CommittedRandomMutationTests(SimpleTestCase):
    """The committed snapshot and output (test_build checks the output is up to date)."""

    def test_the_table_is_36_results_each_giving_a_shared_special_of_william_list(self) -> None:
        source = json.loads(RANDOM_SOURCE.read_text(encoding="utf-8"))
        self.assertEqual([row["roll"] for row in source["results"]], D66)
        self.assertEqual(source["url"], "https://mordheimer.net/docs/optional-rules/power-in-the-stones#random-mutation-table")  # fmt: skip
        out = json.loads((OUT / "random-mutations.json").read_text(encoding="utf-8"))
        shared = {(entry["name"], entry["type"]) for entry in load_shared().entries}
        self.assertEqual({(row["special"]["name"], row["special"]["type"]) for row in out} - shared, set())
        gives = {row["name"]: row["special"]["name"] for row in out}
        # matched by what each does (William's list): another name for a priced mutation keeps its family and price
        self.assertEqual(gives["Acid Spray"], "Spit Acid")
        self.assertEqual(gives["Mace Tail"], "Spiked Tail")
        self.assertEqual(gives["Iron Hard Skin"], "Iron-hard Skin")
        self.assertEqual(gives["Cloven Hooves"], "Cloven Hoofs")
        self.assertEqual((gives["Eyestalks"], gives["Skull Face"], gives["Moronic"]), ("Hideous", "Hideous", "Stupidity"))  # fmt: skip
        # kept apart where the effect differs
        self.assertEqual((gives["Burning Body"], gives["Fangs"], gives["Beaked"]), ("Burning Body", "Fangs", "Beaked"))  # fmt: skip
        self.assertEqual(gives["Plague Bearer"], "Plague Bearer")
