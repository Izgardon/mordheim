from types import SimpleNamespace

from django.test import SimpleTestCase

from catalogue_import.hiring import HiringLog, build_who_can, cost_terms, who
from catalogue_import.skill_lists import SkillLists
from catalogue_import.tests.world import world


class CostTermsTests(SimpleTestCase):
    def test_a_plain_number_is_gold_with_no_special_text(self) -> None:
        self.assertEqual(cost_terms("25"), (25, ""))
        self.assertEqual(cost_terms(40), (40, ""))
        self.assertEqual(cost_terms("30 gc"), (30, ""))

    def test_a_number_with_more_is_gold_plus_the_whole_text(self) -> None:
        self.assertEqual(cost_terms("70 +3D6"), (70, "70 + 3D6"))
        self.assertEqual(cost_terms("15 gc*"), (15, "15 gc*"))

    def test_anything_else_is_only_text(self) -> None:
        self.assertEqual(cost_terms("2 treasures"), (None, "2 treasures"))
        self.assertEqual(cost_terms("1 wyrdstone"), (None, "1 wyrdstone"))
        self.assertEqual(cost_terms("Hero"), (None, "Hero"))
        self.assertEqual(cost_terms(None), (None, ""))


class WhoTests(SimpleTestCase):
    def test_a_list_becomes_types_or_its_group_and_unknown_names_are_left_out(self) -> None:
        _types, resolver, groups, _ctx = world()
        access, left_out = who(["Witch Hunters", "Sisters of Sigmar", "Atlanteans"], [], resolver, groups, "x")
        self.assertEqual(access, {"for_everyone": False, "warbands": [{"group": "sigmarite", "excluded": False}]})
        self.assertEqual(left_out, ["Atlanteans"])

    def test_no_list_is_everyone_minus_the_excluded(self) -> None:
        _types, resolver, groups, _ctx = world()
        access, _left_out = who([], ["Skaven"], resolver, groups, "x")
        self.assertEqual(access, {"for_everyone": True, "warbands": [{"type": "skaven", "excluded": True}]})


class WhoCanTests(SimpleTestCase):
    def build(self, overrides: dict | None = None, **sources: list) -> tuple[dict, HiringLog]:
        types, resolver, groups, _ctx = world()
        base: dict[str, list] = {"skills": [], "hired_swords": [], "personae": [], "our_skills": []}
        log = HiringLog()
        lists = SkillLists(overrides or {}, types, groups)
        return build_who_can(SimpleNamespace(**{**base, **sources}), resolver, groups, log, lists), log

    def test_hired_swords_carry_their_list_note_and_fees(self) -> None:
        sword = {
            "name": "Ratcatcher",
            "permittedWarbands": ["Skaven"],
            "permissiontext": '"Skaven warbands only."',
            "cost": "2 treasures",
            "upkeep": "10",
        }
        built, log = self.build(hired_swords=[sword])
        self.assertEqual(
            built["hired_swords"],
            [
                {
                    "name": "Ratcatcher",
                    "for_everyone": False,
                    "warbands": [{"type": "skaven", "excluded": False}],
                    "note": "Skaven warbands only.",
                    "hire_cost": None,
                    "hire_cost_special": "2 treasures",
                    "upkeep_cost": 10,
                    "upkeep_cost_special": "",
                }
            ],
        )
        self.assertEqual(log.special_costs, [("hired swords", "Ratcatcher", "2 treasures", "")])

    def test_a_skill_takes_its_entry_else_a_general_list_else_its_lists_name(self) -> None:
        theirs = [
            {"name": "Sprint", "permittedWarbands": "all"},
            {"name": "Tail Fighting", "permittedWarbands": "Skaven"},
        ]
        ours = [
            {"name": "Sprint", "type": "Speed"},
            {"name": "Tail Fighting", "type": "Skaven"},
            {"name": "Lightning Reflexes", "type": "Combat"},
            {"name": "Pit Brawl", "type": "Pit Fighters"},
            {"name": "Hymn", "type": "Sigmarite"},
            {"name": "Gnaw", "type": "Atlanteans"},
        ]
        built, log = self.build(skills=theirs, our_skills=ours)
        found = {row["name"]: (row["for_everyone"], row["warbands"], row["how"]) for row in built["skills"]}
        self.assertEqual(found["Sprint"], (True, [], "mordheimer"))
        self.assertEqual(found["Tail Fighting"], (False, [{"type": "skaven", "excluded": False}], "mordheimer"))
        self.assertEqual(found["Lightning Reflexes"], (True, [], "general list"))
        self.assertEqual(found["Pit Brawl"], (False, [{"type": "pit-fighters", "excluded": False}], "its list's name"))
        self.assertEqual(found["Hymn"], (False, [{"group": "sigmarite", "excluded": False}], "its list's name"))
        self.assertEqual(found["Gnaw"], (True, [], "no match"))
        self.assertEqual(log.unplaced, [("skills", "Gnaw (Atlanteans)", ["Atlanteans"])])
