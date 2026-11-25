"""The one Animal rule (William, 25 Nov 2026): the shared special "Animal", "Animals" its alias, which a template
fighter's rule of either name links, a copy that adds to it kept apart under his name; the beasts whose pages leave it
off are given it (template_answers.RULES_ADDED), the Rat Ogres not; every creature the shop sells holds it; and the
Wardogs' item rules lose the sentence that made the dog part of a Hero's equipment."""

import copy
import json
from typing import Any

from django.test import SimpleTestCase

from catalogue_import.shared_specials import SharedSpecials
from catalogue_import.sources import BACKEND, OUT
from catalogue_import.template_answers import RULES_ADDED
from catalogue_import.templates import _share, add_rules

ANIMAL = {"name": "Animal", "type": "Animal"}
DATA: dict[str, Any] = {
    "shared": [{"name": "Animal", "type": "Animal", "text": "Animals never gain experience", "aliases": ["Animals"]}],
    "apart": [
        {
            "name": "Animal (Baneworm)",
            "rule": "Animal",
            "owners": [{"warband": "Brood", "fighter": "Baneworm"}],
            "why": "May not climb.",
        }
    ],
}
WILLIAMS_BEASTS = [  # William, 25 Nov 2026
    ("Skaven", "Giant Rats"),
    ("Skaven of Clan Moulder", "Giant Rat"),
    ("Skaven of Clan Moulder", "Wolf Rat"),
    ("Skaven of Clan Pestilens", "Giant Rat"),
    ("Skaven of Clan Skryre (Relics of the Crusades)", "Giant Rat"),
    ("Undead", "Dire wolves"),
    ("Slavers", "Hound"),
    ("The Fallen", "Wild Dog"),
    ("Underworld Alliance", "Sewer Squig"),
    ("Pirates of the Cathayan Sea", "Floordog"),
    ("Forest Goblins", "Gigantic Spider"),
    ("Forest Goblins (Lustria)", "Gigantic Spider"),
]
BESTIARY = BACKEND / "apps" / "bestiary" / "data"


def fighter(template: str, key: str, name: str, *rules: tuple[str, str]) -> dict[str, Any]:
    specials = [{"name": rule, "type": f"Warband - {template}", "description": text} for rule, text in rules]
    return {"key": key, "name": name, "plural": f"{name}s", "specials": specials}


def templates() -> list[dict[str, Any]]:
    built: list[dict[str, Any]] = json.loads((OUT / "warband-templates.json").read_text(encoding="utf-8"))
    return built


class AnimalRuleTests(SimpleTestCase):
    def setUp(self) -> None:
        self.shared = SharedSpecials(copy.deepcopy(DATA))

    def test_a_fighters_animals_rule_links_the_shared_animal_and_a_copy_kept_apart_stays_his(self) -> None:
        hounds = fighter("Witch Hunters", "hounds", "War hound", ("Animals", "War hounds never gain experience."))
        worm = fighter("Brood", "baneworm", "Baneworm", ("Animal", "A Baneworm gains no experience and may not climb."))

        _share([hounds], [], "Witch Hunters", self.shared)
        _share([worm], [], "Brood", self.shared)

        self.assertEqual(hounds["specials"], [ANIMAL])
        self.assertEqual([row["name"] for row in worm["specials"]], ["Animal (Baneworm)"])

    def test_a_beast_his_page_leaves_it_off_gets_the_shared_animal_once(self) -> None:
        rats = fighter("Skaven", "giant-rats", "Giant Rat", ("Pack Size", "Up to six."))
        ogre = fighter("Skaven", "rat-ogre", "Rat Ogre", ("Fear", "Causes fear."))

        add_rules("skaven-eshin", [rats, ogre], "Skaven", self.shared)
        add_rules("skaven-eshin", [rats, ogre], "Skaven", self.shared)  # held once

        self.assertEqual([row["name"] for row in rats["specials"]], ["Pack Size", "Animal"])
        self.assertEqual([row["name"] for row in ogre["specials"]], ["Fear"])

    def test_a_fighter_the_page_no_longer_has_stops_the_build(self) -> None:
        with self.assertRaisesRegex(ValueError, "skaven-eshin has no fighter giant-rats"):
            add_rules("skaven-eshin", [fighter("Skaven", "rat-ogre", "Rat Ogre")], "Skaven", self.shared)


class CommittedAnimalRuleTests(SimpleTestCase):
    """The committed output (test_build checks it is up to date)."""

    def test_every_beast_william_named_holds_the_shared_animal_and_no_rat_ogre_does(self) -> None:
        held = {(t["name"], f["name"]): f["specials"] for t in templates() for f in t["fighters"]}
        self.assertEqual(len(RULES_ADDED), len(WILLIAMS_BEASTS))
        for beast in WILLIAMS_BEASTS:
            self.assertIn(ANIMAL, held[beast], beast)
        ogres = [specials for (_template, name), specials in held.items() if name == "Rat Ogre"]
        self.assertTrue(ogres)
        self.assertFalse([ogre for ogre in ogres if ANIMAL in ogre])

    def test_no_template_holds_a_copy_of_animal_or_animals(self) -> None:
        held = [s for t in templates() for f in t["fighters"] for s in f["specials"]]
        self.assertEqual([s for s in held if s["name"] in ("Animal", "Animals") and s != ANIMAL], [])

    def test_every_creature_the_shop_sells_holds_animal(self) -> None:
        for path in sorted(BESTIARY.glob("*.json")):
            for entry in json.loads(path.read_text(encoding="utf-8")):
                if entry["kind"] == "creature" and entry.get("available_in_shop"):
                    self.assertIn("Animal", entry["specials"], f"{path.name}: {entry['name']}")

    def test_the_wardogs_rules_drop_the_heros_equipment_sentence_and_keep_the_rest(self) -> None:
        items = json.loads((OUT / "items.json").read_text(encoding="utf-8"))
        wardogs = next(item for item in items if item["name"] == "Wardogs")
        texts = " ".join(rule["text"] for rule in wardogs["rules"])
        self.assertNotIn("part of the equipment", texts)
        self.assertNotIn("model to represent it", texts)
        self.assertIn("Wardogs never gain experience", texts)
        self.assertIn("count towards the maximum number of warriors", texts)
        creatures = [item for item in items if item["type"] == "Animal" and item.get("subtype") == "Creature"]
        self.assertFalse([item["name"] for item in creatures if "part of the equipment" in json.dumps(item["rules"])])
