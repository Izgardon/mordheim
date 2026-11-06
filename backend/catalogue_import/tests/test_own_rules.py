"""The hired swords' and dramatis personae's own rules (own_rules.py, the coordinator, 5 Nov 2026): each owner's is
his own row, and a name other owners' rules hold worded otherwise is named for each owner, as a rule kept apart is."""

import copy
import json
from typing import Any

from django.test import SimpleTestCase

from catalogue_import.own_rules import own_rules
from catalogue_import.shared_specials import SharedSpecials
from catalogue_import.sources import OUT

LIST: dict[str, Any] = {
    "shared": [{"name": "Fear", "type": "Psychology", "text": "Causes fear.", "aliases": ["Cause Fear"]}],
    "apart": [
        {"name": "Fear (Max)", "rule": "Fear", "owners": [{"dramatis_persona": "Max"}], "why": "An aura too."},
    ],
}


def owner(name: str, *rules: tuple[str, str]) -> dict[str, Any]:
    return {"name": name, "specials": [{"name": rule, "description": text} for rule, text in rules]}


class OwnRulesTests(SimpleTestCase):
    def setUp(self) -> None:
        self.shared = SharedSpecials(copy.deepcopy(LIST))

    def test_a_name_others_word_otherwise_is_named_for_each_owner_and_one_worded_alike_keeps_it(self) -> None:
        swords = [
            owner("Bertha", ("Hiring Fee", "Roll a D6."), ("Loner", "Alone.")),
            owner("Johann", ("Hiring Fee", "One portion of Crimson Shade."), ("Loner", "alone. ")),
        ]
        personae = [owner("Max", ("Fear", "Aura.")), owner("Ana", ("Cause Fear", "Fear."), ("Wizard", "Casts."))]

        rules = own_rules(self.shared, swords, personae)

        self.assertEqual(
            rules.names(),
            [
                {"owner": "Bertha", "rule": "Hiring Fee", "name": "Hiring Fee (Bertha)"},
                {"owner": "Johann", "rule": "Hiring Fee", "name": "Hiring Fee (Johann)"},
            ],
        )
        report = rules.render()
        self.assertIn("- Hiring Fee: Bertha; Johann.", report)
        self.assertIn("(the shared list could merge them):\n\n- Loner: Bertha; Johann.", report)
        # a shared name, the rule William's list keeps Max's apart and the book's general Wizard are no own rules
        self.assertEqual(set(rules.held), {"hiring fee", "loner"})


class CommittedOwnRulesTests(SimpleTestCase):
    def test_the_personae_hiring_fees_are_each_their_own(self) -> None:
        out = json.loads((OUT / "shared-specials.json").read_text(encoding="utf-8"))
        fees = [line["name"] for line in out["own_names"] if line["rule"] == "Hiring Fee"]
        self.assertEqual(
            fees,
            [
                "Hiring Fee (Bertha Bestraufrung, High Matriarch of the Sisterhood)",
                "Hiring Fee (Johann the Knife)",
                "Hiring Fee (Penthesilea, Mark of the Serpent)",
            ],
        )
