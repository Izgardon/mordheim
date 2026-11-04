"""Skill groups (phase 1a): our rows merged by name into one skill each, every list a group saying who learns from it,
the rows kept apart, the wordings chosen, the flagged groups, and the new groups with their new skills."""

from types import SimpleNamespace
from typing import Any

from django.test import SimpleTestCase

from catalogue_import.assignments import AssignmentLog, assign, best_entry
from catalogue_import.new_groups import build_skill_groups
from catalogue_import.skill_groups import title_case
from catalogue_import.skill_lists import SkillLists
from catalogue_import.tests.world import world

SKAVEN = {"for_everyone": False, "warbands": [{"type": "skaven", "excluded": False}]}
LIZARDS = {"for_everyone": False, "warbands": [{"type": "lizardmen", "excluded": False}]}
EVERYONE = {"for_everyone": True, "warbands": []}
OURS = [
    {"name": "Sprint", "type": "Speed", "description": "Run."},
    {"name": "Infiltration", "type": "Skaven", "description": "Sneak in."},
    {"name": "Infiltration", "type": "Skink", "description": "Skinks sneak."},
    {"name": "Tail Fighting", "type": "Skaven", "description": "Tail."},
    {"name": "Hide in shadows", "type": "Skaven", "description": "Hide."},
    {"name": "Hide in Shadows", "type": "Lizards", "description": "Hide, a longer wording."},
    {"name": "Great Hunter", "type": "Skink", "description": "Hunt."},
    {"name": "Mist Form", "type": "Rat Vampires", "description": "Mist."},
]
WHO = {
    "Sprint (Speed)": EVERYONE,
    "Infiltration (Skaven)": SKAVEN,
    "Infiltration (Skink)": LIZARDS,
    "Tail Fighting (Skaven)": SKAVEN,
    "Hide in shadows (Skaven)": SKAVEN,
    "Hide in Shadows (Lizards)": LIZARDS,
    "Great Hunter (Skink)": {"for_everyone": False, "warbands": [{"type": "forest-goblins", "excluded": False}]},
    "Mist Form (Rat Vampires)": SKAVEN,
}
OVERRIDES: dict[str, Any] = {
    "skill_lists": {"Rat Vampires": {"warbands": [{"type": "skaven"}], "note": "Vampire only"}},
    "skill_splits": {"Infiltration (Skink)": {"name": "Infiltration (Skink)", "why": "its rule differs"}},
    "skill_wordings": {},
    "skill_group_learners": {},
    "new_skill_groups": {
        "Witch Hunters": {
            "type": "witch-hunters",
            "skills": ["Sprint", "hide in shadows"],
            "new_skills": ["Burn them"],
        },
        "Pit Fighters": {"type": "pit-fighters", "new_skills": ["Brawler"], "source": "fights.json"},
    },
}
THEIRS: list[dict[str, Any]] = [
    {"name": "burn them", "subtype": "Special Skill", "grade": "1a", "permittedWarbands": "Witch Hunters", "source": "Town Cryer",
     "Rules": [{"ruleFull": "<p>Burn the <b>witch</b>.</p>"}]},
    {"name": "Fire Away", "subtype": "Special Skill", "grade": "1a", "permittedWarbands": ["Witch Hunters"]},
]  # fmt: skip


def built(overrides: dict[str, Any] | None = None, hired: list[dict[str, Any]] | None = None) -> Any:
    types, resolver, groups, _ctx = world()
    decisions = {**OVERRIDES, **(overrides or {})}
    rows = [dict(row) for row in OURS]
    sources = SimpleNamespace(
        overrides=decisions,
        our_skills=rows,
        skills=THEIRS,
        our_hired_swords=hired or [],
        our_personae=[],
        skill_files={"fights.json": [{"name": "Brawler", "description": "Punch.", "source": "a PDF"}]},
    )
    who_rows = [{"name": row["name"], "type": row["type"], **WHO[f"{row['name']} ({row['type']})"]} for row in rows]
    settings = {"Hide in shadows (Skaven)": "nemesis-crown", "Hide in Shadows (Lizards)": "mordheim-1b"}
    assigned = [{"name": r["name"], "type": r["type"], "setting": settings.get(f"{r['name']} ({r['type']})", "mordheim"), "how": "mordheimer"} for r in rows]  # fmt: skip
    log = AssignmentLog()
    return build_skill_groups(
        sources,
        types,
        groups,
        SkillLists(decisions, types, groups),
        resolver,
        who_rows,
        assigned,
        lambda new: assign("skills", new, THEIRS, log),
    )


def group(result: Any, name: str) -> dict[str, Any]:
    return next(row for row in result.groups if row["name"] == name)


class MergeTests(SimpleTestCase):
    def test_rows_of_one_name_become_one_skill_in_every_group_that_had_it(self) -> None:
        result = built()

        names = [skill["name"] for skill in result.skills]
        self.assertEqual(names.count("Hide in Shadows"), 1)
        self.assertNotIn("Hide in shadows", names)  # the title-case spelling
        self.assertIn("Hide in Shadows", group(result, "Skaven")["skills"])
        self.assertIn("Hide in Shadows", group(result, "Lizards")["skills"])

    def test_a_merged_skill_keeps_its_longest_wording_and_the_report_hears_of_the_others(self) -> None:
        result = built()

        hide = next(skill for skill in result.skills if skill["name"] == "Hide in Shadows")
        self.assertEqual(hide["description"], "Hide, a longer wording.")
        merge = next(merge for merge in result.log.merges if merge.name == "Hide in Shadows")
        self.assertEqual((merge.how, merge.dropped), ("longest", [("Hide in shadows (Skaven)", "Hide.")]))

    def test_a_chosen_wording_is_its_text_or_the_row_it_comes_from(self) -> None:
        text = built({"skill_wordings": {"Hide in Shadows": {"text": "Hidden.", "why": "William"}}})
        from_row = built({"skill_wordings": {"Hide in Shadows": {"from": "Hide in shadows (Skaven)"}}})

        wording = lambda result: next(s["description"] for s in result.skills if s["name"] == "Hide in Shadows")  # noqa: E731
        self.assertEqual((wording(text), wording(from_row)), ("Hidden.", "Hide."))
        self.assertEqual(len(next(m for m in text.log.merges if m.name == "Hide in Shadows").dropped), 2)

    def test_a_split_row_is_its_own_skill_in_its_group_alone(self) -> None:
        result = built()

        self.assertEqual(group(result, "Skink")["skills"], ["Infiltration (Skink)", "Great Hunter"])
        self.assertEqual(group(result, "Skaven")["skills"][0], "Infiltration")
        skink = next(skill for skill in result.skills if skill["name"] == "Infiltration (Skink)")
        self.assertEqual(skink["description"], "Skinks sneak.")
        self.assertEqual(result.log.splits, [("Infiltration (Skink)", "Infiltration (Skink)", "its rule differs")])

    def test_a_merged_skill_takes_the_lowest_setting_of_its_rows(self) -> None:
        result = built()

        setting = next(row for row in result.settings if row["name"] == "Hide in Shadows")
        self.assertEqual(setting["setting"], "mordheim-1b")
        self.assertIn(("Hide in Shadows", ["mordheim-1b", "nemesis-crown"], "mordheim-1b"), result.log.settings)

    def test_a_decision_naming_a_row_or_skill_we_lack_stops_the_build(self) -> None:
        with self.assertRaisesMessage(ValueError, "Sniper (Skaven)"):
            built({"skill_splits": {"Sniper (Skaven)": {"name": "Sniper (Skaven)"}}})
        with self.assertRaisesMessage(ValueError, "Sprint"):
            built({"skill_wordings": {"Sprint": {"text": "Run fast."}}})  # one row: nothing merged

    def test_names_are_title_cased_with_the_small_words_kept_small(self) -> None:
        self.assertEqual(title_case("hide in shadows"), "Hide in Shadows")
        self.assertEqual(title_case("Elixir of life"), "Elixir of Life")
        self.assertEqual(title_case("Sea Legs (TBMF)"), "Sea Legs (TBMF)")


class GroupAccessTests(SimpleTestCase):
    def test_a_group_is_learned_by_the_warbands_that_may_learn_every_skill_in_it(self) -> None:
        result = built()

        skaven = group(result, "Skaven")
        self.assertEqual((skaven["for_everyone"], skaven["warbands"], skaven["how"]), (False, SKAVEN["warbands"], "intersection"))  # fmt: skip
        self.assertEqual((group(result, "Speed")["for_everyone"], group(result, "Speed")["warbands"]), (True, []))
        self.assertNotIn("Skaven", [flag.group for flag in result.log.flagged])

    def test_a_lists_decision_wins_and_brings_its_note(self) -> None:
        mist = group(built(), "Rat Vampires")

        self.assertEqual((mist["how"], mist["note"], mist["large_only"]), ("skill_lists", "Vampire only", False))

    def test_a_group_none_may_learn_all_of_takes_the_union_and_is_flagged(self) -> None:
        result = built()

        skink = group(result, "Skink")
        self.assertEqual(skink["how"], "union")
        self.assertEqual({line["type"] for line in skink["warbands"]}, {"lizardmen", "forest-goblins"})
        flag = next(flag for flag in result.log.flagged if flag.group == "Skink")
        self.assertEqual((flag.intersection, flag.taken), ([], "union"))

    def test_williams_settling_of_a_flagged_group_wins(self) -> None:
        settled = {"skill_group_learners": {"Skink": {"warbands": [{"type": "lizardmen"}], "why": "William"}}}
        result = built(settled)

        skink = group(result, "Skink")
        self.assertEqual((skink["how"], skink["warbands"]), ("skill_group_learners", LIZARDS["warbands"]))
        self.assertNotIn("Skink", [flag.group for flag in result.log.flagged])

    def test_a_settling_naming_a_group_or_warband_we_lack_stops_the_build(self) -> None:
        with self.assertRaisesMessage(ValueError, "type gnomes"):
            built({"skill_group_learners": {"Skink": {"warbands": [{"type": "gnomes"}]}}})
        with self.assertRaisesMessage(ValueError, "strigany"):
            built({"skill_group_learners": {"Strigany": {"for_everyone": True}}})

    def test_the_core_groups_come_first_then_the_rest_by_name(self) -> None:
        names = [row["name"] for row in built().groups]

        self.assertEqual(names[0], "Speed")
        self.assertEqual(names[1:], sorted(names[1:], key=str.lower))


class NewGroupTests(SimpleTestCase):
    def test_a_new_group_is_its_warband_types_alone_with_ours_and_its_new_skills(self) -> None:
        result = built()

        hunters = group(result, "Witch Hunters")
        self.assertEqual(hunters["skills"], ["Sprint", "Hide in Shadows", "Burn Them"])
        self.assertEqual((hunters["for_everyone"], hunters["warbands"]), (False, [{"type": "witch-hunters", "excluded": False}]))  # fmt: skip
        burn = next(skill for skill in result.skills if skill["name"] == "Burn Them")
        self.assertEqual(burn["description"], "Burn the witch.")
        self.assertIn(("Burn Them", "Witch Hunters", "mordheim", "mordheimer (Town Cryer)"), result.log.new_skills)
        self.assertIn({"name": "Burn Them", "setting": "mordheim", "how": "mordheimer"}, result.settings)

    def test_a_new_skills_rules_may_come_from_a_source_file(self) -> None:
        result = built()

        brawler = next(skill for skill in result.skills if skill["name"] == "Brawler")
        self.assertEqual(brawler["description"], "Punch.")
        self.assertIn(("Brawler", "Pit Fighters", "mordheim", "a PDF"), result.log.new_skills)

    def test_a_new_name_a_hired_swords_own_skill_holds_is_left_out_and_reported(self) -> None:
        hired = [{"name": "Torch Bearer", "hired_sword": {"available_special_skills": [{"name": "Burn Them"}]}}]
        result = built(hired=hired)

        self.assertNotIn("Burn Them", group(result, "Witch Hunters")["skills"])
        self.assertNotIn("Burn Them", [skill["name"] for skill in result.skills])
        self.assertEqual(result.log.collisions, [("Burn Them", "Witch Hunters", "Torch Bearer's own skill")])

    def test_mordheimers_skills_for_the_warband_left_out_of_its_group_are_reported(self) -> None:
        self.assertIn(("Witch Hunters", "Fire Away"), built().log.left_out)

    def test_who_could_learn_a_reused_skill_before_and_now_is_reported_when_it_changes(self) -> None:
        reused = {name: (before, after) for name, before, after in built().log.reused}

        self.assertEqual(reused["Hide in Shadows"], (["skaven", "lizardmen"], ["skaven", "lizardmen", "witch-hunters"]))  # fmt: skip
        self.assertNotIn("Sprint", reused)  # for everyone before and after

    def test_a_new_group_may_name_several_types_and_a_new_skill_apart_from_the_rule_it_takes(self) -> None:
        hunters = {
            "types": ["witch-hunters", "sisters-of-sigmar"],
            "new_skills": [{"name": "Burn Them (Hunters)", "rule": "Burn them"}],
        }
        hired = [{"name": "Torch Bearer", "hired_sword": {"available_special_skills": [{"name": "Burn Them"}]}}]
        result = built({"new_skill_groups": {"Hunters": hunters}}, hired=hired)

        group_row = group(result, "Hunters")
        self.assertEqual(group_row["warbands"], [{"group": "sigmarite", "excluded": False}])  # the group they make up
        self.assertEqual(group_row["skills"], ["Burn Them (Hunters)"])
        burn = next(skill for skill in result.skills if skill["name"] == "Burn Them (Hunters)")
        self.assertEqual(burn["description"], "Burn the witch.")
        self.assertEqual(result.log.collisions, [])
        self.assertIn({"name": "Burn Them (Hunters)", "setting": "mordheim", "how": "mordheimer"}, result.settings)

    def test_a_new_group_naming_a_skill_or_type_we_lack_stops_the_build(self) -> None:
        with self.assertRaisesMessage(ValueError, "no skill 'Leap'"):
            built({"new_skill_groups": {"Witch Hunters": {"type": "witch-hunters", "skills": ["Leap"]}}})
        with self.assertRaisesMessage(ValueError, "no warband type 'witches'"):
            built({"new_skill_groups": {"Witches": {"type": "witches"}}})


class CaveatTests(SimpleTestCase):
    def test_an_entry_whose_caveat_names_our_list_fits_it(self) -> None:
        found: list[dict[str, Any]] = [
            {"name": "Infiltration", "grade": "core", "permittedWarbands": ["Skaven", "Dark Elves"], "caveat": ""},
            {
                "name": "Infiltration",
                "grade": "1b",
                "permittedWarbands": "Lizardmen",
                "caveat": "Lizardmen Skinks only",
            },
        ]

        self.assertIs(best_entry("Skink", found), found[1])
        self.assertIs(best_entry("Dark Elf", found), found[0])
