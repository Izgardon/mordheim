from typing import Any

from django.test import SimpleTestCase

from catalogue_import.assignments import AssignmentLog, assign


def theirs(name: str, grade: str = "core", setting: str | None = None, **extra: Any) -> dict[str, Any]:
    entry: dict[str, Any] = {"name": name, "grade": grade, "subtype": "Special Skill", **extra}
    if setting:
        entry["campaignSetting"] = setting
    return entry


class AssignmentTests(SimpleTestCase):
    def test_a_name_takes_its_setting_or_mordheims_part_for_its_grade(self) -> None:
        log = AssignmentLog()
        rows = assign(
            "hired swords",
            [{"name": "Arabian Merchant"}, {"name": "Elf Ranger"}, {"name": "Ogre Bodyguard"}],
            [theirs("Arabian merchant", "1b", "khemri"), theirs("Elf Ranger", "1b"), theirs("Ogre Bodyguard")],
            log,
        )
        self.assertEqual([row["setting"] for row in rows], ["khemri", "mordheim-1b", "mordheim"])
        self.assertEqual({row["how"] for row in rows}, {"mordheimer"})

    def test_a_name_mordheimer_lacks_is_mordheims_and_reported(self) -> None:
        log = AssignmentLog()
        rows = assign("skills", [{"name": "Tunneler", "type": "Dwarf Exiled Engineers"}], [theirs("Sprint")], log)
        self.assertEqual(
            rows, [{"name": "Tunneler", "type": "Dwarf Exiled Engineers", "setting": "mordheim", "how": "no match"}]
        )
        self.assertEqual(log.unmatched, {"skills": ["Tunneler"]})

    def test_a_special_skill_takes_the_entry_naming_its_list(self) -> None:
        found = [
            theirs("Hide in Shadows", "1b", "nemesis-crown", permittedWarbands="Hochland Bandits"),
            theirs("Hide in Shadows", "1b", permittedWarbands="Shadow Warriors"),
            theirs("Infiltration", permittedWarbands=["Skaven", "Dark Elves"]),
            theirs("Infiltration", "1b", permittedWarbands="Lizardmen"),
        ]
        ours = [
            {"name": "Hide in shadows", "type": "Hochland Bandits"},
            {"name": "Hide in Shadows", "type": "Shadow Warriors"},
            {"name": "Infiltration", "type": "Dark Elf"},
        ]
        log = AssignmentLog()
        rows = assign("skills", ours, found, log)
        self.assertEqual([row["setting"] for row in rows], ["nemesis-crown", "mordheim-1b", "mordheim"])
        self.assertEqual(
            log.ambiguous[0],
            ("skills", "Hide in shadows (Hochland Bandits)", "nemesis-crown", ["mordheim-1b"], "mordheimer"),
        )
        settled = AssignmentLog()
        rows = assign("skills", ours[:1], found, settled, {"Hide in shadows (Hochland Bandits)": "mordheim-1b"})
        self.assertEqual((rows[0]["setting"], rows[0]["how"]), ("mordheim-1b", "overrides.json"))
        self.assertEqual(
            settled.ambiguous,
            [("skills", "Hide in shadows (Hochland Bandits)", "mordheim-1b", ["nemesis-crown"], "overrides.json")],
        )

    def test_a_general_skill_prefers_its_subtype_then_the_lowest_setting(self) -> None:
        found = [
            theirs("Battle Tongue", "1b", permittedWarbands="Norse Explorers"),
            theirs("Battle Tongue", subtype="Academic Skill", permittedWarbands="all"),
        ]
        rows = assign("skills", [{"name": "Battle Tongue", "type": "Academic"}], found, AssignmentLog())
        self.assertEqual(rows[0]["setting"], "mordheim")
        lowest = assign(
            "skills",
            [{"name": "Netter", "type": "Ogres"}],
            found[:1] + [theirs("Netter", "2a"), theirs("Netter", "1c")],
            AssignmentLog(),
        )
        self.assertEqual(lowest[0]["setting"], "mordheim-1c")

    def test_overrides_win_and_a_two_setting_entry_lives_in_its_first(self) -> None:
        log = AssignmentLog()
        shaman = theirs("Norse Shaman", "1b", campaignSettings=["lustria", "border-town-burning"])
        rows = assign("hired swords", [{"name": "Norse Shaman"}], [shaman], log)
        self.assertEqual(rows[0]["setting"], "lustria")
        self.assertEqual(
            log.multi_setting,
            [("hired swords", "Norse Shaman", ["lustria", "border-town-burning"], "lustria", "mordheimer")],
        )
        settled = AssignmentLog()
        chosen = assign(
            "hired swords", [{"name": "Norse Shaman"}], [shaman], settled, {"Norse Shaman": "border-town-burning"}
        )
        self.assertEqual((chosen[0]["setting"], chosen[0]["how"]), ("border-town-burning", "overrides.json"))
        self.assertEqual(
            settled.multi_setting,
            [
                (
                    "hired swords",
                    "Norse Shaman",
                    ["lustria", "border-town-burning"],
                    "border-town-burning",
                    "overrides.json",
                )
            ],
        )

    def test_only_a_skill_is_named_with_its_type(self) -> None:
        hired = assign(
            "hired swords", [{"name": "Beggar", "type": "Hired Sword"}], [theirs("Beggar", "2a")], AssignmentLog()
        )
        self.assertEqual(hired, [{"name": "Beggar", "setting": "mordheim-2a", "how": "mordheimer"}])
