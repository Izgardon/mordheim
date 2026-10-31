"""William's skill list decisions (the fees and skill lists step): who learns a list's skills mordheimer lacks, the
Large-only and noted lists, and the skills dropped, added and reworded before anything reads our rows."""

from types import SimpleNamespace

from django.test import SimpleTestCase

from catalogue_import.hiring import HiringLog, build_who_can
from catalogue_import.skill_lists import SkillLists
from catalogue_import.tests.world import world

OVERRIDES = {
    "skill_lists": {
        "Animal": {"for_everyone": True},
        "Large Special": {"for_everyone": True, "large_only": True},
        "Rat Vampires": {"warbands": [{"type": "skaven"}], "note": "Vampire only"},
        "Hunters": {"warbands": [{"group": "sigmarite"}]},
    },
    "drop_skills": {"Prize-fighter (Strigany)": "left out for now", "Skills list prohibitions (Saurus)": "a note"},
    "extra_skills": [
        {"name": "Master Inventor", "type": "Engineers", "description": "D3+1 inventions.", "source": "the PDF"}
    ],
    "skill_descriptions": {"Quick Thinker (Engineers)": "+1 on the experimental weapons chart."},
}
OURS = [
    {"name": "Falconer", "type": "Animal", "description": "Birds."},
    {"name": "Brick Wall", "type": "Large Special", "description": "Big."},
    {"name": "Mist Form", "type": "Rat Vampires", "description": "Mist."},
    {"name": "Witch Sense", "type": "Hunters", "description": "Sniff."},
    {"name": "Prize-fighter", "type": "Strigany", "description": "Fists."},
    {"name": "Skills list prohibitions", "type": "Saurus", "description": "No Academic skills."},
    {"name": "Quick Thinker", "type": "Engineers", "description": "+1. Master Inventor D3+1 inventions."},
]


def lists(overrides: dict = OVERRIDES) -> SkillLists:
    types, _resolver, groups, _ctx = world()
    return SkillLists(overrides, types, groups)


class SkillRowTests(SimpleTestCase):
    def test_drops_rewordings_and_additions_are_applied_to_our_rows(self) -> None:
        decided = lists()

        rows = decided.apply(OURS)

        self.assertEqual(
            [(row["name"], row["type"]) for row in rows],
            [
                ("Falconer", "Animal"),
                ("Brick Wall", "Large Special"),
                ("Mist Form", "Rat Vampires"),
                ("Witch Sense", "Hunters"),
                ("Quick Thinker", "Engineers"),
                ("Master Inventor", "Engineers"),
            ],
        )
        self.assertEqual(rows[4]["description"], "+1 on the experimental weapons chart.")
        self.assertEqual(rows[5], {"name": "Master Inventor", "type": "Engineers", "description": "D3+1 inventions."})
        self.assertEqual(
            decided.log.dropped,
            [("Prize-fighter (Strigany)", "left out for now"), ("Skills list prohibitions (Saurus)", "a note")],
        )
        self.assertEqual(decided.log.added, [("Master Inventor (Engineers)", "the PDF")])
        self.assertEqual(decided.log.reworded, ["Quick Thinker (Engineers)"])

    def test_a_decision_naming_a_skill_we_lack_stops_the_build(self) -> None:
        with self.assertRaisesMessage(ValueError, "Tail Fighting (Skaven)"):
            lists({"drop_skills": {"Tail Fighting (Skaven)": "gone"}}).apply(OURS)

    def test_a_decision_naming_an_unknown_warband_stops_the_build(self) -> None:
        with self.assertRaisesMessage(ValueError, "no warband type 'metal-mongers'"):
            lists({"skill_lists": {"Metal Mongers": {"warbands": [{"type": "metal-mongers"}]}}})


class SkillAccessTests(SimpleTestCase):
    def test_a_decided_list_places_its_skills_mordheimer_lacks(self) -> None:
        decided = lists()
        rows = decided.apply(OURS)
        sources = SimpleNamespace(skills=[], hired_swords=[], personae=[], our_skills=rows)
        _types, resolver, groups, _ctx = world()
        log = HiringLog()

        built = {row["name"]: row for row in build_who_can(sources, resolver, groups, log, decided)["skills"]}

        self.assertEqual(
            built["Falconer"],
            {"name": "Falconer", "type": "Animal", "for_everyone": True, "warbands": [], "how": "overrides.json"},
        )
        self.assertEqual(built["Brick Wall"]["large_only"], True)
        self.assertEqual(
            (built["Mist Form"]["warbands"], built["Mist Form"]["for_everyone"], built["Mist Form"]["note"]),
            ([{"type": "skaven", "excluded": False}], False, "Vampire only"),
        )
        self.assertEqual(built["Witch Sense"]["warbands"], [{"group": "sigmarite", "excluded": False}])
        self.assertNotIn("large_only", built["Mist Form"])
        unplaced = [entry for _kind, entry, _names in log.unplaced]
        self.assertEqual(
            unplaced, ["Quick Thinker (Engineers)", "Master Inventor (Engineers)"]
        )  # no decision for theirs
        self.assertEqual(decided.log.placed["Large Special"], ["Brick Wall"])

    def test_a_skill_mordheimer_has_keeps_its_list_but_takes_the_lists_note(self) -> None:
        decided = lists()
        theirs = [{"name": "Mist Form", "permittedWarbands": ["Witch Hunters"]}]
        sources = SimpleNamespace(skills=theirs, hired_swords=[], personae=[], our_skills=decided.apply(OURS))
        _types, resolver, groups, _ctx = world()

        built = build_who_can(sources, resolver, groups, HiringLog(), decided)["skills"]

        mist = next(row for row in built if row["name"] == "Mist Form")
        self.assertEqual((mist["how"], mist["warbands"], mist["note"]), ("mordheimer", [{"type": "witch-hunters", "excluded": False}], "Vampire only"))  # fmt: skip
