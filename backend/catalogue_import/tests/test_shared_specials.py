"""The shared specials (shared_specials.py, William, 5 Nov 2026): a template fighter's rule or an upgrade of a shared
name or alias links the shared special, a rule the list keeps apart stays its owner's own under the list's name (one
row for owners in two templates), and the output words each special from the snapshot's psychology entry, the list's
text or the page that sells it."""

import copy
import json
from typing import Any

from django.test import SimpleTestCase

from catalogue_import.shared_specials import SharedSpecials, key, load_shared, render_shared
from catalogue_import.sources import OUT
from catalogue_import.templates import _share

DATA: dict[str, Any] = {
    "shared": [
        {
            "name": "Fear",
            "type": "Psychology",
            "psychology": "Fear",
            "first_line": "Causes fear.",
            "aliases": ["Cause Fear"],
        },
        {
            "name": "Cloud of Flies",
            "type": "Mutation",
            "upgrade_of": "Carnival",
            "subject": {"The Tainted One": "The model"},
            "aliases": [],
        },
    ],
    "apart": [
        {
            "name": "Stupidity (Rat Ogre)",
            "rule": "Stupidity",
            "owners": [{"warband": "Skaven", "fighter": "Rat Ogre"}, {"warband": "Pestilens", "fighter": "Rat Ogre"}],
            "why": "Not stupid near a Skaven Hero.",
        },
        {"name": "Fear (Max)", "rule": "Fear", "owners": [{"dramatis_persona": "Max"}], "why": "An aura too."},
    ],
}
FEAR = {"type": "psychology", "name": "Fear", "Rules": [{"ruleFull": "Fear is **a) If charged by _fear_.**"}]}
STUPID = 'A Rat Ogre is subject to stupidity unless a Skaven Hero is within 6".'


def fighter(template: str, name: str, *rules: tuple[str, str]) -> dict[str, Any]:
    specials = [{"name": rule, "type": f"Warband - {template}", "description": text} for rule, text in rules]
    return {"name": name, "plural": f"{name}s", "specials": [*specials, {"name": "Large", "type": "Trait"}]}


class SharedSpecialsTests(SimpleTestCase):
    def setUp(self) -> None:
        self.shared = SharedSpecials(copy.deepcopy(DATA))

    def test_a_fighters_shared_rules_link_it_once_and_a_rule_kept_apart_is_one_row_for_both_templates(self) -> None:
        skaven = [fighter("Skaven", "Rat Ogre", ("Cause Fear", "They cause fear."), ("Fear", "Fear."), ("Stupidity", STUPID))]  # fmt: skip
        pestilens = [fighter("Pestilens", "Rat Ogre", ("Stupidity", STUPID))]

        _share(skaven, [], "Skaven", self.shared)
        _share(pestilens, [], "Pestilens", self.shared)

        kept = {"name": "Stupidity (Rat Ogre)", "type": "Warband - Skaven", "description": STUPID}
        fear, large = {"name": "Fear", "type": "Psychology"}, {"name": "Large", "type": "Trait"}
        self.assertEqual(skaven[0]["specials"], [fear, kept, large])
        self.assertEqual(pestilens[0]["specials"], [kept, large])  # the Skaven's row
        self.assertEqual([owner for _name, _kind, owner, _rule in self.shared.log.merged], ["Skaven: Rat Ogre"] * 2)

    def test_an_owner_wording_a_rule_kept_apart_otherwise_stops_the_build(self) -> None:
        _share([fighter("Skaven", "Rat Ogre", ("Stupidity", STUPID))], [], "Skaven", self.shared)
        other = [fighter("Pestilens", "Rat Ogre", ("Stupidity", "A Rat Ogre is always stupid."))]
        with self.assertRaisesRegex(ValueError, "Rat Ogre words Stupidity \\(Rat Ogre\\) unlike its first owner"):
            _share(other, [], "Pestilens", self.shared)

    def test_an_upgrade_links_the_mutation_its_page_words_and_the_output_words_each(self) -> None:
        text = "The Tainted One is surrounded by flies. They do not affect the Tainted One."
        upgrades = [{"group": "Blessings", "cost": 25, "special": {"name": "Cloud of Flies", "type": "Warband - Carnival", "description": text}}]  # fmt: skip
        _share([fighter("Skaven", "Rat Ogre", ("Stupidity", STUPID))], [], "Skaven", self.shared)
        _share([fighter("Pestilens", "Rat Ogre", ("Stupidity", STUPID))], [], "Pestilens", self.shared)
        _share([], upgrades, "Carnival", self.shared)
        self.shared.scan("dramatis_persona", [{"name": "Max", "specials": [{"name": "Fear", "description": "Aura."}]}])

        out = self.shared.output([FEAR])

        self.assertEqual((upgrades[0]["special"], upgrades[0]["cost"]), ({"name": "Cloud of Flies", "type": "Mutation"}, 25))  # fmt: skip
        self.assertEqual(
            [row["description"] for row in out["specials"]],
            [
                "Causes fear.\n\nFear is a) If charged by fear.",
                "The model is surrounded by flies. They do not affect the model.",
            ],
        )
        self.assertEqual(out["apart"], [{"owner": "Max", "rule": "Fear", "name": "Fear (Max)"}])  # a template's isn't
        report = render_shared(self.shared)
        self.assertIn("| Fear (Max) | Max | An aura too. |", report)
        self.assertIn("- Cloud of Flies: Carnival: Blessings.", report)

    def test_a_mutation_takes_its_pages_price_over_the_lists_and_a_new_one_the_lists_price_and_setting(self) -> None:
        self.shared.entries[1]["cost"] = 30  # MiM's price for the Carnival's Cloud of Flies, say
        beak = {"name": "Beak", "type": "Favour of Tchar", "text": "A bite.", "cost": 35, "aliases": []}
        self.shared.entries.append({**beak, "setting": "mutiny-in-marienburg", "from": "MiM, p162"})
        self.shared.unused.clear()
        text = "The Tainted One is surrounded by flies."
        upgrades = [{"group": "Blessings", "cost": 25, "special": {"name": "Cloud of Flies", "type": "Warband - Carnival", "description": text}}]  # fmt: skip
        _share([], upgrades, "Carnival", self.shared)

        out = {row["name"]: row for row in self.shared.output([FEAR])["specials"]}

        self.assertEqual((out["Cloud of Flies"]["cost"], out["Cloud of Flies"]["setting"]), (25, None))  # the page's
        self.assertEqual((out["Beak"]["cost"], out["Beak"]["setting"]), (35, "mutiny-in-marienburg"))
        self.assertEqual((out["Fear"]["cost"], out["Fear"]["setting"]), (None, None))
        report = render_shared(self.shared)
        self.assertIn("List prices the pages differ from: Cloud of Flies: the list's 30 gc, the page's 25 gc (kept).", report)  # fmt: skip
        self.assertIn("| Beak | Favour of Tchar | the list's text (MiM, p162) | 35 | mutiny-in-marienburg |", report)

    def test_an_owner_the_list_names_without_the_rule_and_a_page_selling_none_stop_the_build(self) -> None:
        with self.assertRaisesRegex(ValueError, "Max has no rule 'Fear'"):
            self.shared.output([FEAR])
        self.shared.unused.clear()
        with self.assertRaisesRegex(ValueError, "Carnival sells no Cloud of Flies"):
            self.shared.output([FEAR])


class CommittedSharedSpecialsTests(SimpleTestCase):
    """The committed list and output (test_build checks the output is up to date)."""

    def test_the_list_names_each_rule_once_and_the_templates_hold_no_copy(self) -> None:
        shared = load_shared()
        names = [name for entry in shared.entries for name in (entry["name"], *entry["aliases"])]
        self.assertEqual(len(names), len(set(shared.names)))  # no name or alias twice
        out = json.loads((OUT / "shared-specials.json").read_text(encoding="utf-8"))
        self.assertEqual([row["name"] for row in out["specials"]], [entry["name"] for entry in shared.entries])
        templates = json.loads((OUT / "warband-templates.json").read_text(encoding="utf-8"))
        held = [s for t in templates for f in t["fighters"] for s in f["specials"]]
        held += [u["special"] for t in templates for u in t["upgrades"]]
        copies = [row["name"] for row in held if "description" in row and key(row["name"]) in shared.names]
        self.assertEqual(copies, [])
