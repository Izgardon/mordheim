"""The tailored lists that sell the shared mutations (template_upgrades.mutation_upgrades, William, 5 Nov 2026): each
upgrade links the shared special at its price, on its list's terms (or the page's own group's) with its note, after
the page's own of the group; the committed templates hold what William settled for each warband."""

import copy
import json
from typing import Any

from django.test import SimpleTestCase

from catalogue_import.shared_specials import SharedSpecials
from catalogue_import.sources import OUT
from catalogue_import.template_upgrades import UpgradeLog, mutation_upgrades

LIST: dict[str, Any] = {
    "shared": [
        {"name": "Great Claw", "type": "Mutation", "text": "A claw.", "cost": 50, "aliases": []},
        {"name": "Wings", "type": "Mutation", "text": "Glides.", "cost": 45, "aliases": []},
        {"name": "Warts", "type": "Mutation", "text": "Warts.", "aliases": []},  # the random table's: no price
        {"name": "Suckers", "type": "Blessing of Nurgle", "text": "Climbs.", "cost": 25, "aliases": []},
        {"name": "Mark of Nurgle", "type": "Blessing of Nurgle", "text": "+1 W.", "cost": 35, "aliases": []},
    ],
    "apart": [],
}
CLAW = {"name": "Great Claw", "type": "Mutation"}


def template(name: str, *upgrades: dict[str, Any]) -> dict[str, Any]:
    return {"name": name, "fighters": [], "upgrades": list(upgrades)}


class MutationUpgradeTests(SimpleTestCase):
    def setUp(self) -> None:
        self.shared = SharedSpecials(copy.deepcopy(LIST))

    def test_the_cult_keeps_its_own_and_takes_the_rest_of_the_list_on_its_terms(self) -> None:
        own = {"group": "Mutations", "special": CLAW, "cost": 50, "note": "", "who": {}}
        cult = template("Cult of the Possessed", own)
        log = UpgradeLog()

        mutation_upgrades("cult-of-the-posessed", cult, self.shared, log)

        [_, wings] = cult["upgrades"]
        self.assertEqual((wings["special"], wings["cost"]), ({"name": "Wings", "type": "Mutation"}, 45))
        terms = (wings["who"], wings["later_double"], wings["at_recruit"], wings["max_per_fighter"])
        self.assertEqual(terms, ({"fighters": ["the-possessed", "mutants"]}, True, True, None))  # UPGRADE_TERMS'
        self.assertEqual(log.mutations, [("cult-of-the-posessed", "Mutations", 1, "who the-possessed, mutants; later double; at recruit", "")])  # fmt: skip

    def test_the_marauders_buy_with_the_skill_and_their_blessings_leave_out_the_mark(self) -> None:
        marauders = template("Marauders of Chaos")

        mutation_upgrades("marauders-of-chaos", marauders, self.shared, UpgradeLog())

        rows = [(row["group"], row["special"]["name"], row["cost"], row["note"]) for row in marauders["upgrades"]]
        onogal = "Mark of Onogal heroes with the Mutant skill, instead of a mutation."
        self.assertEqual(
            rows,
            [
                ("Mutations", "Great Claw", 50, "With the Mutant skill."),
                ("Mutations", "Wings", 45, "With the Mutant skill."),
                ("Blessings of Nurgle", "Suckers", 25, onogal),
            ],
        )
        first = marauders["upgrades"][0]
        self.assertEqual((first["later_double"], first["at_recruit"]), (False, False))  # neither is stated
        self.assertEqual([merged[2] for merged in self.shared.log.merged], ["Marauders of Chaos: Mutations"] * 2 + ["Marauders of Chaos: Blessings of Nurgle"])  # fmt: skip


class CommittedMutationUpgradeTests(SimpleTestCase):
    """What the committed templates sell (test_build checks the output is up to date)."""

    def test_each_warband_that_buys_mutations_has_its_tailored_list(self) -> None:
        templates = {row["name"]: row for row in json.loads((OUT / "warband-templates.json").read_text("utf-8"))}

        def groups(name: str) -> dict[str, list[str]]:
            found: dict[str, list[str]] = {}
            for row in templates[name]["upgrades"]:
                found.setdefault(row["group"], []).append(row["special"]["name"])
            return found

        cult = groups("Cult of the Possessed")["Mutations"]
        self.assertEqual(len(cult), 15)
        self.assertEqual(groups("Beastmen Raiders")["Mutations"], cult)
        marauders = groups("Marauders of Chaos")
        self.assertEqual((len(marauders["Mark of the Dark Gods"]), marauders["Mutations"]), (5, cult))
        self.assertEqual(
            marauders["Blessings of Nurgle"],
            ["Stream of Corruption", "Nurgle's Rot", "Cloud of Flies", "Bloated Foulness", "Suckers", "Plague Carrier"],
        )
        self.assertEqual(groups("Court of the Profane Pleasures"), {"Mutations": ["Extra Arm", "Tentacle", "Great Claw"]})  # fmt: skip
        self.assertEqual(len(groups("Carnival of Chaos")["Blessings of Nurgle"]), 6)  # unchanged
        court = templates["Court of the Profane Pleasures"]["upgrades"][0]
        self.assertEqual((court["who"], court["max_per_fighter"], court["at_recruit"], court["cost"]), ({"heroes": True}, 1, True, 40))  # fmt: skip
