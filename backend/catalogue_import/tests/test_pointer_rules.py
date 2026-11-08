"""Rules whose text only points elsewhere (pointer_rules.py; William, 7 Nov 2026, of the Gunnery School of Nuln's
Senior Gunnery Officer's Hunter, "See Shooting Skills.": "it should just say the rule there!"): a pointer to a skill
takes our skill's text, a pointer to another fighter's entry takes that
fighter's rule of the name, and a text that says more, or points to a list of choices, is left alone."""

import json
from typing import Any

from django.test import SimpleTestCase

from catalogue_import.pointer_rules import render_pointers, resolve_pointers
from catalogue_import.sources import OUT

SKILLS = [
    {"name": "Hunter", "description": "He may fire each turn with a handgun or Hochland long rifle."},
    {"name": "Strongman", "description": "He may use a double-handed weapon without striking last."},
    {"name": "Arms master", "description": "He ignores every weapon's difficult to use rules."},
]
NOT_ORCS = "Each Goblin Warrior or Cave Squig taken out of action only counts as half a model."


def rule(name: str, text: str, owner: str = "Warband - Orc Mob") -> dict[str, str]:
    return {"name": name, "type": owner, "description": text}


def fighter(name: str, plural: str, *specials: dict[str, str]) -> dict[str, Any]:
    return {"name": name, "plural": plural, "specials": list(specials)}


class PointerTests(SimpleTestCase):
    def test_a_pointer_to_a_skill_or_an_entry_takes_the_rule_and_anything_else_stays(self):
        mob: dict[str, Any] = {
            "name": "Orc Mob",
            "fighters": [
                fighter("Goblin Warrior", "Goblin Warriors", rule("Not Orcs", NOT_ORCS)),
                fighter(
                    "Cave Squig",
                    "Cave Squigs",
                    rule("Not Orcs (Cave Squig)", "See Goblin Warriors entry for rules."),
                    rule("Hunter", "See Shooting Skills."),
                    rule("Arms Master", "See Pit Fighter Skill section."),
                    rule("Mutations", "See the Mutations list for costs."),
                    rule("Animosity", "Subject to Animosity (see Special Rules for details)."),
                    rule("Sniper", "See Shooting Skills."),
                ),
            ],
        }
        max_the_mad: dict[str, Any] = {
            "name": "Max",
            "specials": [{"name": "Strongman", "description": "As the skill of the same name."}],
        }

        log = resolve_pointers([mob], [max_the_mad], SKILLS)

        squig = mob["fighters"][1]["specials"]
        texts = {special["name"]: special["description"] for special in squig}
        self.assertEqual(texts["Not Orcs"], NOT_ORCS)  # the Goblin Warriors' rule, one row with theirs
        self.assertNotIn("Not Orcs (Cave Squig)", texts)
        self.assertEqual(texts["Hunter"], SKILLS[0]["description"])
        self.assertEqual(texts["Arms Master"], SKILLS[2]["description"])  # ours, whatever its case
        self.assertEqual(texts["Mutations"], "See the Mutations list for costs.")  # a list of choices
        self.assertTrue(texts["Animosity"].startswith("Subject to Animosity"))  # says more than the pointer
        self.assertEqual(texts["Sniper"], "See Shooting Skills.")  # no skill of the name: left, and reported
        self.assertEqual(max_the_mad["specials"][0]["description"], SKILLS[1]["description"])
        self.assertEqual(log.unresolved, [("Orc Mob: Cave Squig", "Sniper", "See Shooting Skills.")])
        self.assertIn("- Max: Strongman, from our Strongman skill.", render_pointers(log))


class CommittedPointerTests(SimpleTestCase):
    """The committed output (test_build checks it is up to date)."""

    def test_the_gunnery_officers_hunter_carries_the_hunter_skills_text_and_no_pointer_is_left(self):
        templates = json.loads((OUT / "warband-templates.json").read_text(encoding="utf-8"))
        skills = {row["name"]: row["description"] for row in json.loads((OUT / "skills.json").read_text(encoding="utf-8"))}  # fmt: skip
        held = {
            (template["name"], one["name"], special["name"]): special.get("description")
            for template in templates
            for one in template["fighters"]
            for special in one["specials"]
        }
        self.assertEqual(held[("Gunnery School of Nuln", "Senior Gunnery Officer", "Hunter")], skills["Hunter"])
        pit = [text for (_t, _f, name), text in held.items() if name == "Pit Fighter"]
        self.assertEqual(set(pit), {skills["Pit Fighter"]})
        self.assertEqual(held[("Orc Mob", "Cave Squig", "Not Orcs")], held[("Orc Mob", "Goblin Warrior", "Not Orcs")])
        pointers = [key for key, text in held.items() if text and text.strip().casefold().startswith("see ") and len(text) < 60]  # fmt: skip
        self.assertEqual(pointers, [])
        personae = json.loads((OUT / "dramatis-personae.json").read_text(encoding="utf-8"))
        maximilian = next(row for row in personae if row["name"] == "Maximilian the Mad")
        strongman = next(special for special in maximilian["specials"] if special["name"] == "Strongman")
        self.assertEqual(strongman["description"], skills["Strongman"])
