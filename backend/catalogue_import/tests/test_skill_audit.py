"""The book skills audit (27 Nov 2026): the obvious corrections, read from the committed `out/` (which test_build.py
pins to a fresh run of build.py) and the hired swords' own data."""

from typing import Any, ClassVar

from catalogue_import.common import load_json
from catalogue_import.pdf_warbands import TYPE, skill_settings
from catalogue_import.skill_groups import title_case
from catalogue_import.sources import HIRELING_DATA, OUT
from catalogue_import.tests.review_support import ReviewCase
from catalogue_import.tests.test_pdf_warbands import good_page


class SkillAuditTests(ReviewCase):
    hired: ClassVar[dict[str, dict[str, Any]]]

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.hired = {row["name"]: row for row in load_json(HIRELING_DATA / "hired-swords.json")}

    def terms(self, name: str) -> dict[str, Any]:
        return dict(self.hired[name]["hired_sword"])

    def test_the_lustria_elves_learn_from_the_special_list_their_rules_name(self) -> None:
        # "In addition, the Assassin may use any unique Dark Elf skills"; the Shadow Warrior "may choose his skill
        # from the Shadow Warriors Special Skill list in Town Cryer 10"
        self.assertIn("Dark Elf", self.terms("Dark Elf Assassin")["available_skill_types"])
        self.assertIn("Shadow Warriors", self.terms("Shadow Warrior")["available_skill_types"])
        self.assertIn("Dark Elf", self.groups)
        self.assertIn("Shadow Warriors", self.groups)

    def test_the_skills_a_hired_swords_rules_say_he_has_are_skills_he_starts_with(self) -> None:
        # the Grave Robber's rule only said "The Grave Robber has the Trap Expert skill."; the Prospector's PDF says
        # "Prospector Hired Swords start the game with this skill" of Luck
        robber = self.hired["Grave Robber (Mousillon)"]
        self.assertEqual(robber["skills"], ["Trap Expert"])
        self.assertNotIn("Trap Expert", [special["name"] for special in robber["specials"]])
        self.assertIn("Trap Expert", self.skills)
        prospector = self.hired["Prospector (Karak Azgal)"]
        self.assertEqual(prospector["skills"], ["Luck (Prospector)"])
        own = [skill["name"] for skill in self.terms("Prospector (Karak Azgal)")["available_special_skills"]]
        self.assertIn("Luck (Prospector)", own)

    def test_the_two_wood_elf_seekers_are_one_skill(self) -> None:
        # the Wood Elves of Arden's and of Athel Loren's Seeker are word for word the same
        for old in ("Seeker (Wood Elves of Arden)", "Seeker (Wood Elves of Athel Loren)"):
            self.assertNotIn(old, self.skills)
        self.assertIn("Seeker (Wood Elves)", self.groups["Wood Elves of Arden"])
        self.assertIn("Seeker (Wood Elves)", self.groups["Wood Elves of Athel Loren"])
        self.assertTrue(self.skills["Seeker (Wood Elves)"].startswith("Only one Hero of the warband"))

    def test_a_skill_several_races_learn_is_worded_for_none_of_them(self) -> None:
        # Crude Belch is the Ogres' and the Ogre Hunting Party's too, Stealthy the Low Kings', Sniper (Shadow
        # Warriors) the Woodsmen de Artois', Wall Runner the Lost's
        cases = {
            "Crude Belch": ("Ogre Hunting Party", ["Halfling", "Ogre"]),
            "Stealthy": ("Low Kings", ["Halfling"]),
            "Sniper (Shadow Warriors)": ("Woodsmen de Artois", ["Shadow Warriors", "Dark Elves"]),
            "Wall Runner": ("The Lost", ["Skaven"]),
        }
        for skill, (group, races) in cases.items():
            with self.subTest(skill=skill):
                self.assertIn(skill, self.groups[group])
                for race in races:
                    self.assertNotIn(race, self.skills[skill])
        self.assertIn("relieves himself again", self.skills["Crude Belch"])
        self.assertIn("may shoot or cast spells and still remain Hidden", self.skills["Sniper (Shadow Warriors)"])
        self.assertIn("climbing up walls", self.skills["Wall Runner"])

    def test_a_skill_sits_in_a_setting_its_lowest_graded_learners_see(self) -> None:
        # under a grade preset, a skill in a later setting than the warband learning it is greyed for that warband:
        # Magic Resistant was Khemri 3's (the Cursed Dwarves) though the Adventurers (Karak Azgal, 2b) learn it, and
        # Fey Mordheim 2a's though the High Elves' Ranger (Lustria, 1b) learns it
        settings = {row["name"]: row["setting"] for row in load_json(OUT / "setting-assignments.json")["skills"]}
        self.assertIn("Magic Resistant", self.groups["Adventurers"])
        self.assertEqual(settings["Magic Resistant"], "karak-azgal")
        self.assertIn("Fey", self.groups["Ranger (High Elves)"])
        self.assertEqual(settings["Fey"], "lustria")

    def test_a_skill_two_pages_share_takes_the_lower_graded_setting_before_the_earlier(self) -> None:
        # Khemri 3 comes before Karak Azgal in the settings' order, but a 2b campaign ticks Karak Azgal, not Khemri 3
        late, early = good_page(), good_page()
        late[TYPE], early[TYPE] = "graded-3", "graded-2b"
        late["skillGroup"], early["skillGroup"] = {"name": "Three", "new": True}, {"name": "Two", "new": True}
        shared = {"name": "Magic Resistant", "description": "A spell does not affect him on a 4+."}
        late["specialSkillsList"], early["specialSkillsList"] = [dict(shared)], [dict(shared)]
        setting_of = {"graded-3": "khemri-3", "graded-2b": "karak-azgal"}
        grades = {"khemri-3": "3", "karak-azgal": "2b"}
        for pages in ({"a": late, "b": early}, {"a": early, "b": late}):
            self.assertEqual(skill_settings(pages, setting_of, grades), {"Magic Resistant": "karak-azgal"})
        self.assertEqual(skill_settings({"a": late, "b": early}, setting_of), {"Magic Resistant": "khemri-3"})

    def test_no_skill_points_a_player_at_a_page_or_a_rule_he_cant_follow(self) -> None:
        pointers = {
            "Animal Friendship": "Mordheim book, page",
            "Slaver": "p.119",
            "Mutant (Marauders of Chaos)": "Empire in Flames, page",
            "Bat Form": "detailed above",
            "Giant Wolf Form": "described above",
            "Master of Runes": "below)",
            "Master of Blades": "detailed above",
            "Wall Runner": "Suggested Changes",
        }
        for skill, pointer in pointers.items():
            with self.subTest(skill=skill):
                self.assertNotIn(pointer, self.skills[skill])
        for skill in ("Bat Form", "Giant Wolf Form"):
            self.assertIn("exactly as for Mist Form: he transforms in the recovery phase", self.skills[skill])
        pathfinder = next(
            skill
            for skill in self.terms("Dwarf Pathfinder")["available_special_skills"]
            if skill["name"] == "Pathfinder"
        )
        self.assertNotIn("Skaven skill", pathfinder["description"])

    def test_no_skill_description_holds_a_double_space(self) -> None:
        self.assertEqual([name for name, text in self.skills.items() if "  " in text], [])

    def test_every_skill_name_is_title_cased(self) -> None:
        # 26 were in sentence case beside the rest ("Hit and run" beside "Hit and Run (Silent Brotherhood)")
        self.assertEqual([name for name in self.skills if title_case(name) != name], [])
        for name in ("Hit and Run", "Arms Master", "Sand Worm", "’Ere We Go!", "Thing Handler", "Bull Charge"):
            self.assertIn(name, self.skills)
        self.assertIn("Bull Charge", self.groups["Ogre Hunting Party"])
        self.assertIn("Arms Master", self.fighters_skills("pit-fighters-old", "Pit Fighter"))

    def fighters_skills(self, slug: str, fighter: str) -> list[str]:
        found = next(row for row in self.templates[slug]["fighters"] if row["name"] == fighter)
        return list(found["skills"])

    def test_a_group_note_names_its_skills_as_the_group_holds_them(self) -> None:
        groups = {row["name"]: row for row in load_json(OUT / "skill-groups.json")}
        for group, skill in (
            ("Ogre Hunting Party", "Bellowing Roar (Ogres)"),
            ("Lizardmen (Lustria)", "Infiltration (Skink)"),
            ("Dwarf Grudgebearers", "Set Traps (Dwarf Grudgebearers)"),
        ):
            with self.subTest(group=group):
                self.assertIn(skill, groups[group]["skills"])
                self.assertIn(skill, groups[group]["note"])

    def test_a_rule_of_a_skills_name_and_effect_is_the_skill_he_starts_with(self) -> None:
        # William, 27 Nov 2026 (the decision sheet's 25: A): the nine rules the skills audit's M4 lists, under his
        # 7 Nov rule; a starting skill adds no group to his advance list
        fighters = {
            ("channel-rats", "Domnu"): ("Prize-fighter", "Prize-fighter"),
            ("channel-rats", "Truant"): ("Spry", "Spry"),
            ("maneaters", "Bull"): ("Bull Charge", "Bull Charge"),
            ("merchant-caravans", "Blackguard"): ("Strongman", "Strongman"),
            ("sea-ghosts", "Minstrel"): ("Songster", "Songster"),
            ("high-elves", "Ranger"): ("Seeker", "Seeker (Wood Elves)"),
            ("woodsmen-de-artois", "Trapper"): ("Set Traps", "Set Traps"),
        }
        for (slug, name), (rule, skill) in fighters.items():
            with self.subTest(fighter=name):
                found = next(row for row in self.templates[slug]["fighters"] if row["name"] == name)
                self.assertIn(skill, found["skills"])
                self.assertNotIn(rule, [special["name"] for special in found["specials"]])
                self.assertIn(skill, self.skills)
        ranger = next(row for row in self.templates["high-elves"]["fighters"] if row["name"] == "Ranger")
        self.assertNotIn("Wood Elves of Arden", ranger["skill_types"])
        for hired, (rule, learns) in {"Elf Mage": ("Fey", []), "Coachman": ("Driver", ["Speed"])}.items():
            with self.subTest(hired=hired):
                self.assertIn(rule, self.hired[hired]["skills"])
                self.assertNotIn(rule, [special["name"] for special in self.hired[hired]["specials"]])
                self.assertEqual(self.terms(hired)["available_skill_types"], learns)
        # the Woodsmen's Trapper starts with the Ogre Hunting Party's Set Traps, so its Gnoblars-only limit is that
        # group's note, not the skill's text
        self.assertFalse(self.skills["Set Traps"].startswith("Gnoblars only"))
        groups = {row["name"]: row for row in load_json(OUT / "skill-groups.json")}
        self.assertIn("Set Traps", groups["Ogre Hunting Party"]["note"])

    def test_the_cursed_dwarves_longbeard_learns_the_clansmens_line(self) -> None:
        # the book's skill lists name Leader, Priest, "Clansmen" and Slayers; the Clansmen are henchmen, so that line
        # is the Longbeard's (William, 27 Nov 2026)
        longbeard = next(row for row in self.templates["cursed-dwarves"]["fighters"] if row["name"] == "Longbeard")
        self.assertEqual(longbeard["skill_types"], ["Combat", "Strength", "Cursed Dwarves"])

    def test_the_prospector_learns_dwarf_skills_which_his_rule_keeps_for_a_dwarf(self) -> None:
        # "Dwarf Prospectors can also choose skills from the Dwarf Special list" (William, 27 Nov 2026: A, warned in
        # his rule, as nothing tells a Dwarf Prospector from a Human one)
        prospector = self.hired["Prospector (Karak Azgal)"]
        self.assertEqual(
            self.terms("Prospector (Karak Azgal)")["available_skill_types"], ["Combat", "Strength", "Dwarves"]
        )
        self.assertIn("Dwarves", self.groups)
        rules = {special["name"]: special["description"] for special in prospector["specials"]}
        self.assertIn("Only a Dwarf Prospector may learn Dwarves skills", rules["Dwarf Skills"])

    def test_the_prospectors_loner_and_prospector_are_his_rules(self) -> None:
        # his book lists them as his rules, "Prospector Skills" (William, 27 Nov 2026): Loner the shared special
        prospector = self.hired["Prospector (Karak Azgal)"]
        rules = [special["name"] for special in prospector["specials"]]
        self.assertIn("Loner", rules)
        self.assertIn("Prospector", rules)
        own = [skill["name"] for skill in self.terms("Prospector (Karak Azgal)")["available_special_skills"]]
        self.assertEqual(own, ["Luck (Prospector)"])

    def test_the_chameleon_skink_learns_lizardmen_skills(self) -> None:
        # "may choose from Shooting, Speed and Lizardmen special skills": the Lustria list, as he is a Lustria hired
        # sword (William, 27 Nov 2026)
        self.assertEqual(
            self.terms("Chameleon Skink")["available_skill_types"], ["Shooting", "Speed", "Lizardmen (Lustria)"]
        )
        self.assertIn("Lizardmen (Lustria)", self.groups)

    def test_a_skill_group_takes_the_setting_of_the_warbands_that_learn_from_it(self) -> None:
        # William, 27 Nov 2026 (the skills audit's M1): the Khemri split widened, so a group comes and goes with its
        # warbands, the lowest graded of them where several settings learn from it; one open to everyone has none
        groups = {row["name"]: row for row in load_json(OUT / "skill-groups.json")}
        settings = {
            "Clockworkers": "sealed-city",
            "Snotlings": "mordheim-2a",
            "Savage Orcs": "sartosa",
            "Skink": "lustria",
            "Pirates": "mordheim-1b",
            "Dwarf Troll Slayers": "mordheim",  # the Dwarf Treasure Hunters' 1a, below the Rangers' and the Slayers'
            "Academic": None,
            "Holy": None,
        }
        self.assertEqual({name: groups[name]["setting"] for name in settings}, settings)

    def test_the_dark_elves_powerful_build_keeps_its_own_limit(self) -> None:
        # the kept wording bars Shadow Weavers; the Dark Elves' "The Sorceress may never take this skill" was dropped
        # (William, 27 Nov 2026: split it out)
        self.assertIn("Powerful Build (Dark Elf)", self.groups["Dark Elf"])
        self.assertNotIn("Powerful Build", self.groups["Dark Elf"])
        self.assertIn("The Sorceress may never take this skill", self.skills["Powerful Build (Dark Elf)"])
        self.assertIn("Shadow Weavers", self.skills["Powerful Build"])
        self.assertIn("Powerful Build", self.groups["Sea Ghosts"])
