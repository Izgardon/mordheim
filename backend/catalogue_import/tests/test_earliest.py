"""An entry moves down to its earliest adopter's setting (William, 27 Nov 2026: "Yes, always move skills, lores, items
down to the earliest adopter"; earliest.py)."""

from typing import Any

from django.test import SimpleTestCase

from catalogue_import.common import load_json
from catalogue_import.earliest import Adopters, EarliestAdopter, earliest
from catalogue_import.sources import OUT

GRADES = {"mordheim": "1a", "mordheim-1b": "1b", "mordheim-2a": "2a", "empire-in-flames": "1a", "lustria": "1b"}
TYPES = [
    {"slug": "wood-elves", "name": "Wood Elves", "setting": "mordheim-2a"},
    {"slug": "outlaws", "name": "Outlaws", "setting": "empire-in-flames"},
    {"slug": "reiklanders", "name": "Reiklanders", "setting": "mordheim"},
    {"slug": "savage-orcs", "name": "Savage Orcs", "setting": "lustria"},
]
GROUPS = [{"slug": "elves", "name": "Elves", "members": ["wood-elves"]}]


def fighter(name: str, **fields: Any) -> dict[str, Any]:
    return {"name": name, "skill_types": [], "skills": [], "spell_types": [], "variant_changes": {}, **fields}


TEMPLATES = [
    {
        "name": "Orc Mob",
        "variants": [{"key": "orc-mob"}, {"key": "savage"}],
        "types": [{"type": "reiklanders", "variant": "orc-mob"}, {"type": "savage-orcs", "variant": "savage"}],
        "fighters": [fighter("Boss", skill_types=["Orcs"], variant_changes={"savage": {"skill_types": ["Savage"]}})],
        "lists": [
            {
                "name": "Orc List",
                "lines": [
                    {"item": {"name": "Choppa", "variant": ""}, "variant": ""},
                    {"item": {"name": "Bone Club", "variant": ""}, "variant": "savage"},
                ],
            }
        ],
    },
    {
        "name": "Outlaws",
        "variants": [],
        "types": [{"type": "outlaws", "variant": ""}],
        "fighters": [fighter("Scout", skills=["Seeker"], spell_types=[{"name": "Forest Lore", "note": ""}])],
        "lists": [],
    },
]
RANGER = {
    "name": "Kislev Ranger",
    "skills": [],
    "equipment": [{"item": "Bear Pelt"}],
    "spell_types": [],
    "hired_sword": {"available_skill_types": ["Wood Elves"], "available_special_skills": [{"name": "Tracker"}]},
}


def mover() -> EarliestAdopter:
    adopters = Adopters(TYPES, GROUPS, TEMPLATES, [(RANGER, "mordheim-1b", "hired sword")])
    return EarliestAdopter(GRADES, adopters)


def group(name: str, setting: str, *lines: dict[str, Any], everyone: bool = False) -> dict[str, Any]:
    return {"name": name, "setting": setting, "for_everyone": everyone, "warbands": list(lines), "skills": []}


class EarliestTests(SimpleTestCase):
    def test_the_lowest_grade_then_the_first_setting(self) -> None:
        self.assertEqual(earliest(["mordheim-1b", "empire-in-flames"], GRADES), "empire-in-flames")
        self.assertEqual(earliest(["empire-in-flames", "mordheim"], GRADES), "mordheim")

    def test_a_group_moves_down_to_a_hireling_or_fighter_who_learns_from_it(self) -> None:
        move = mover()
        elves = group("Wood Elves", "mordheim-2a", {"type": "wood-elves", "excluded": False})
        savage = group("Savage", "lustria", {"type": "savage-orcs", "excluded": False})
        orcs = group("Orcs", "lustria", {"group": "elves", "excluded": False})
        core = group("Combat", None, everyone=True)  # type: ignore[arg-type]
        move.groups([elves, savage, orcs, core])
        self.assertEqual(elves["setting"], "mordheim-1b")  # the Kislev Ranger learns from it
        self.assertEqual(savage["setting"], "lustria")  # only the Savage Orcs' variant learns it
        self.assertEqual(orcs["setting"], "mordheim")  # the Reiklanders' preset variant keeps the Orcs list
        self.assertIsNone(core["setting"])
        self.assertIn(("skill groups", "Wood Elves", "mordheim-2a", "mordheim-1b", "Kislev Ranger (hired sword)"), move.moves.moved)  # fmt: skip

    def test_a_skill_moves_down_to_who_starts_with_it_unless_open_or_set_by_william(self) -> None:
        move = mover()
        groups = [
            {**group("Wood Elves", "mordheim-2a", {"type": "wood-elves", "excluded": False}), "skills": ["Seeker"]},
            {**group("Combat", None, everyone=True), "skills": ["Strike"]},  # type: ignore[arg-type]
        ]
        skills = [
            {"name": "Seeker", "setting": "mordheim-2a", "how": "mordheimer"},
            {"name": "Strike", "setting": "mordheim-2a", "how": "mordheimer"},
            {"name": "Tracker", "setting": "lustria", "how": "overrides.json"},
            {"name": "Nobody's", "setting": "lustria", "how": "mordheimer"},
        ]
        move.skills(skills, groups)
        self.assertEqual([skill["setting"] for skill in skills], ["empire-in-flames", "mordheim-2a", "lustria", "lustria"])  # fmt: skip
        self.assertEqual(skills[0]["how"], "earliest adopter")
        self.assertEqual(move.moves.kept, [("skills", "Tracker", "lustria", "mordheim-1b", "Kislev Ranger (hired sword)")])  # fmt: skip

    def test_a_lore_moves_down_to_a_caster(self) -> None:
        move = mover()
        lores = [{"name": "Forest Lore", "setting": "lustria", "how": "spells.json"}]
        move.lores(lores)
        self.assertEqual(lores[0], {"name": "Forest Lore", "setting": "empire-in-flames", "how": "earliest adopter"})

    def test_an_item_moves_down_to_a_list_a_kit_or_a_price_row_and_one_for_everyone_stays(self) -> None:
        move = mover()

        def item(name: str, *rows: dict[str, Any]) -> dict[str, Any]:
            return {"name": name, "variant": "", "setting": "mordheim-2a", "availabilities": list(rows)}

        def row(*lines: dict[str, Any], everyone: bool = False, **fields: Any) -> dict[str, Any]:
            return {"for_everyone": everyone, "warbands": list(lines), **fields}

        items = [
            item("Choppa"),  # the Reiklanders' list
            item("Bone Club"),  # the Savage Orcs' variant's line only
            item("Bear Pelt"),  # the Kislev Ranger's kit
            item("Elf Bow", row({"group": "elves", "excluded": False}), row({"type": "outlaws", "excluded": True})),
            item("Rope", row(everyone=True), row({"type": "reiklanders", "excluded": False})),
            item("Annual", row({"type": "reiklanders", "excluded": False}, setting="lustria")),
        ]
        move.items(items)
        self.assertEqual(
            [entry["setting"] for entry in items],
            ["mordheim", "lustria", "mordheim-1b", "mordheim-2a", "mordheim-2a", "lustria"],
        )


class CommittedEarliestTests(SimpleTestCase):
    """The committed out/ (test_build.py pins it to a fresh run)."""

    def test_the_book_entries_sit_with_their_earliest_adopters(self) -> None:
        skills = {row["name"]: row for row in load_json(OUT / "setting-assignments.json")["skills"]}
        # the Wood Elves' (2a) Seeker: the Elf Ranger (1a) starts with it, the Kislev Ranger (1b) learns it
        self.assertEqual(skills["Seeker"]["setting"], "mordheim")
        self.assertEqual(skills["Stealthy"]["setting"], "mordheim-1b")  # the Halfling Thief starts with it
        # decision 62's, set in overrides.json, stay
        for name, setting in {"Ferocious Charge": "mordheim", "Maneater": "mordheim-1c"}.items():
            self.assertEqual(skills[name]["setting"], setting)
        items = {row["name"]: row["setting"] for row in load_json(OUT / "items.json") if not row["variant"]}
        self.assertEqual(items["Chaos Steed"], "mordheim")  # the Cult of the Possessed buy it
        self.assertEqual(items["Boss Pole"], "lustria")  # the Lustria Forest Goblins' list sells it
        # William, 28 Nov 2026 ("Yes"): no override holds Hide in Shadows (1b) or Fey (Lustria) up any more, so the
        # Imperial Assassin (1a) and the Elf Ranger (1a) bring them down
        for name in ("Hide in Shadows", "Fey"):
            self.assertEqual((skills[name]["setting"], skills[name]["how"]), ("mordheim", "earliest adopter"))
        report = (OUT / "import-report.md").read_text(encoding="utf-8")
        kept = report.split("kept there, though an adopter is earlier still (William's call):", 1)[1]
        self.assertEqual(kept.split("\n## ", 1)[0].strip(), "- none")
