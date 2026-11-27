"""The book skills audit (27 Nov 2026): the obvious corrections, read from the committed `out/` (which test_build.py
pins to a fresh run of build.py) and the hired swords' own data."""

from typing import Any, ClassVar

from catalogue_import.common import load_json
from catalogue_import.sources import HIRELING_DATA
from catalogue_import.tests.review_support import ReviewCase


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
