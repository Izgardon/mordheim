from types import SimpleNamespace

from django.test import SimpleTestCase

from catalogue_import.fees import fee
from catalogue_import.hiring import HiringLog, build_who_can, who
from catalogue_import.skill_lists import SkillLists
from catalogue_import.tests.world import world


class WhoTests(SimpleTestCase):
    def test_a_list_becomes_types_or_its_group_and_unknown_names_are_left_out(self) -> None:
        _types, resolver, groups, _ctx = world()
        access, left_out = who(["Witch Hunters", "Sisters of Sigmar", "Atlanteans"], [], resolver, groups, "x")
        self.assertEqual(access, {"for_everyone": False, "warbands": [{"group": "sigmarite", "excluded": False}]})
        self.assertEqual(left_out, ["Atlanteans"])

    def test_added_types_join_the_list_and_a_full_group_is_stored_as_the_group(self) -> None:
        _types, resolver, groups, _ctx = world()
        access, _left_out = who(["Witch Hunters"], [], resolver, groups, "x", ["sisters-of-sigmar"])
        self.assertEqual(access, {"for_everyone": False, "warbands": [{"group": "sigmarite", "excluded": False}]})

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
        namespace = SimpleNamespace(**{**base, "overrides": overrides or {}, **sources})
        return build_who_can(namespace, resolver, groups, log, lists), log

    def test_hire_warbands_add_must_name_a_hireling(self) -> None:
        sword = {"name": "Ratcatcher", "permittedWarbands": ["Skaven"], "cost": "25", "upkeep": "10"}
        overrides = {"hire_warbands_add": {"Rat Catcher": {"warbands": ["skaven"], "why": "a typo"}}}
        with self.assertRaises(ValueError):
            self.build(overrides, hired_swords=[sword])

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
                    "hire_fee": fee("gold", resources=[{"resource": "Treasure", "amount": 2}]),
                    "upkeep_fee": fee("gold", 10),
                }
            ],
        )
        self.assertEqual([(kind, name, hire) for kind, name, hire, *_read in log.fees], [("hired swords", "Ratcatcher", "2 treasures")])  # fmt: skip

    def test_a_fee_in_his_rules_is_special_with_his_hiring_sentence_as_its_note(self) -> None:
        # overrides.json fees_in_rules: Aksho'akhash's hire is a summoning ritual, shown in full and never automated
        fury = {"name": "Chaos Fury", "permissiontext": '"Summon it with a ritual."', "cost": "30", "upkeep": "30"}

        built, log = self.build({"fees_in_rules": {"Chaos Fury": "his ritual"}}, personae=[fury])
        self.assertEqual(built["dramatis_personae"][0]["hire_fee"], fee("special", 30, note="Summon it with a ritual."))
        self.assertEqual(built["dramatis_personae"][0]["upkeep_fee"], fee("gold", 30))
        self.assertEqual([name for _kind, name, *_rest in log.fees], ["Chaos Fury"])  # the report lists it

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
