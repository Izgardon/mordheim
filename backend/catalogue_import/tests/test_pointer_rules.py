"""Rules whose text only points elsewhere or names a skill he has (pointer_rules.py; William, 7 Nov 2026, of the
Gunnery School of Nuln's Senior Gunnery Officer's Hunter, "See Shooting Skills.": "it should just say the rule there!",
and asked whether he should start with the skill itself, as one he'd learned: "yes please do that"): a pointer to a
skill becomes the skill he starts with and the rule goes, William's answers give the skills a rule states (a rule that
says more keeping its text), a choice stays a rule, a pointer to another fighter's entry takes that fighter's rule of
the name, and a text that says more, or points to a list of choices, is left alone."""

import json
from typing import Any

from django.test import SimpleTestCase

from catalogue_import.pointer_rules import check_answers, render_pointers, resolve_pointers
from catalogue_import.sources import OUT

SKILLS = [
    {"name": "Hunter", "description": "He may fire each turn with a handgun or Hochland long rifle."},
    {"name": "Strongman", "description": "He may use a double-handed weapon without striking last."},
    {"name": "Arms master", "description": "He ignores every weapon's difficult to use rules."},
    {"name": "Sabre Trainer", "description": "A Sabretusk Cub near him that rolls a 1 may move towards a model."},
    {"name": "Ride [Animal]", "description": "He may ride the specified animal."},
    {"name": "Dodge", "description": "He avoids a missile hit on a 5+."},
]
NOT_ORCS = "Each Goblin Warrior or Cave Squig taken out of action only counts as half a model."


def rule(name: str, text: str, owner: str = "Warband - Orc Mob") -> dict[str, str]:
    return {"name": name, "type": owner, "description": text}


def fighter(name: str, plural: str, *specials: dict[str, str]) -> dict[str, Any]:
    return {"name": name, "plural": plural, "specials": list(specials), "skills": []}


def rules_of(one: dict[str, Any]) -> dict[str, str]:
    return {special["name"]: special.get("description", "") for special in one["specials"]}


class PointerTests(SimpleTestCase):
    def test_a_pointer_to_a_skill_is_the_skill_he_starts_with_and_an_entry_pointer_takes_the_rule(self):
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
            "skills": [],
            "specials": [{"name": "Strongman", "description": "As the skill of the same name."}],
        }

        log = resolve_pointers([mob], [max_the_mad], SKILLS)

        squig = mob["fighters"][1]
        texts = rules_of(squig)
        self.assertEqual(squig["skills"], ["Hunter", "Arms master"])  # ours, whatever its case
        self.assertEqual(texts["Not Orcs"], NOT_ORCS)  # the Goblin Warriors' rule, one row with theirs
        self.assertEqual(
            list(texts),
            ["Not Orcs", "Mutations", "Animosity", "Sniper"],  # the pointers to skills gone
        )
        self.assertEqual(texts["Mutations"], "See the Mutations list for costs.")  # a list of choices
        self.assertTrue(texts["Animosity"].startswith("Subject to Animosity"))  # says more than the pointer
        self.assertEqual(texts["Sniper"], "See Shooting Skills.")  # no skill of the name: left, and reported
        self.assertEqual((max_the_mad["skills"], max_the_mad["specials"]), (["Strongman"], []))
        self.assertEqual(log.unresolved, [("Orc Mob: Cave Squig", "Sniper", "See Shooting Skills.")])
        report = render_pointers(log)
        self.assertIn("- Max: Strongman, starts with Strongman.", report)
        self.assertIn(
            "- Orc Mob: Cave Squig: Not Orcs (Cave Squig), from the Goblin Warriors entry's Not Orcs.", report
        )

    def test_williams_answers_give_the_skills_a_rule_states_and_a_choice_stays_a_rule(self):
        hunters: dict[str, Any] = {
            "name": "Ogre Hunting Party",
            "fighters": [
                fighter(
                    "Ogre Hunter",
                    "Ogre Hunters",
                    rule("Sabre Trainer", "The Ogre Hunter has the Sabre Trainer skill: when a Sabretusk Cub ..."),
                ),
                fighter(
                    "Trapper",
                    "Trappers",
                    rule("Veteran Tracker", "When hired, a Trapper takes one of these special skills: Infiltration"),
                ),
            ],
        }
        moulder: dict[str, Any] = {
            "name": "Skaven of Clan Moulder",
            "fighters": [
                fighter("Packmaster", "Packmasters", rule("Master Handler", "He starts with the Ride Wolf Rat skill.")),
            ],
        }
        ippan: dict[str, Any] = {
            "name": "Grand Master Ippan Shu",
            "skills": ["Step Aside"],
            "specials": [{"name": "Parry Missiles", "description": "Note that Ippan Shu also has the Dodge skill."}],
        }

        log = resolve_pointers([hunters, moulder], [ippan], SKILLS)

        ogre, trapper = hunters["fighters"]
        self.assertEqual((ogre["skills"], ogre["specials"]), (["Sabre Trainer"], []))
        self.assertEqual((trapper["skills"], list(rules_of(trapper))), ([], ["Veteran Tracker"]))  # his choice
        packmaster = moulder["fighters"][0]
        self.assertEqual((packmaster["skills"], list(rules_of(packmaster))), (["Ride [Animal]"], ["Master Handler"]))
        self.assertEqual((ippan["skills"], len(ippan["specials"])), (["Step Aside", "Dodge"], 1))
        report = render_pointers(log)
        self.assertIn("- Ogre Hunting Party: Ogre Hunter: Sabre Trainer, starts with Sabre Trainer.", report)
        self.assertIn(
            "- Skaven of Clan Moulder: Packmaster: Master Handler, keeps the rule and starts with Ride [Animal].",
            report,
        )

    def test_an_answer_naming_a_fighter_or_rule_the_build_lacks_stops_it(self):
        renamed: dict[str, Any] = {"name": "Ogre Hunting Party", "fighters": [fighter("Ogre Hunter", "Ogre Hunters")]}
        with self.assertRaisesRegex(ValueError, "Ogre Hunting Party: Ogre Hunter has no rule Sabre Trainer"):
            resolve_pointers([renamed], [], SKILLS)
        with self.assertRaisesRegex(ValueError, "names fighters the build lacks: .*Ogre Hunting Party: Ogre Hunter"):
            check_answers([], [])


class CommittedPointerTests(SimpleTestCase):
    """The committed output (test_build checks it is up to date)."""

    def setUp(self) -> None:
        templates = json.loads((OUT / "warband-templates.json").read_text(encoding="utf-8"))
        self.fighters = {(template["name"], one["name"]): one for template in templates for one in template["fighters"]}
        self.personae = {
            row["name"]: row for row in json.loads((OUT / "dramatis-personae.json").read_text(encoding="utf-8"))
        }

    def test_the_gunnery_officer_starts_with_hunter_and_no_pointer_is_left(self):
        officer = self.fighters[("Gunnery School of Nuln", "Senior Gunnery Officer")]
        self.assertEqual(officer["skills"], ["Hunter"])
        self.assertNotIn("Hunter", rules_of(officer))
        pit = [one for (template, _name), one in self.fighters.items() if template.startswith("Pit Fighters")]
        self.assertEqual(len([one for one in pit if "Pit Fighter" in one["skills"]]), 12)  # all but the Initiate
        self.assertFalse([one for one in pit if "Pit Fighter" in rules_of(one)])
        self.assertIn("Arms master", self.fighters[("Pit Fighters (old)", "Pit Fighter")]["skills"])
        orc, goblin = self.fighters[("Orc Mob", "Cave Squig")], self.fighters[("Orc Mob", "Goblin Warrior")]
        self.assertEqual(rules_of(orc)["Not Orcs"], rules_of(goblin)["Not Orcs"])
        pointers = [
            (key, special["name"])
            for key, one in self.fighters.items()
            for special in one["specials"]
            if str(special.get("description") or "").strip().casefold().startswith("see ")
            and len(special["description"]) < 60
        ]
        self.assertEqual(pointers, [])

    def test_the_sweep_gives_the_skills_rules_state_and_leaves_a_choice(self):
        hunter = self.fighters[("Ogre Hunting Party", "Ogre Hunter")]
        trapper = self.fighters[("Ogre Hunting Party", "Trapper")]  # "takes one of these special skills": his choice
        self.assertEqual((hunter["skills"], "Sabre Trainer" in rules_of(hunter)), (["Sabre Trainer"], False))
        self.assertEqual((trapper["skills"], "Veteran Tracker" in rules_of(trapper)), ([], True))
        ape = self.fighters[("The Cursed Cavalcade", "Fighting Ape")]
        self.assertEqual(ape["skills"], ["Scale Sheer Surfaces", "Acrobat", "Dodge"])
        self.assertIn("Agile (Fighting Ape)", rules_of(ape))  # its diving charge stays
        self.assertEqual(
            self.fighters[("Imperial Outriders", "Groom")]["skills"], ["Ride [Animal]", "[Animal] Handler"]
        )

    def test_maximilian_starts_with_strongman(self):
        maximilian = self.personae["Maximilian the Mad"]
        self.assertIn("Strongman", maximilian["skills"])
        self.assertNotIn("Strongman", [special["name"] for special in maximilian["specials"]])
        ippan = self.personae["Grand Master Ippan Shu"]
        self.assertIn("Dodge", ippan["skills"])
        self.assertIn("Parry Missiles", [special["name"] for special in ippan["specials"]])
