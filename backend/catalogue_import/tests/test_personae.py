from django.test import SimpleTestCase

from catalogue_import.personae import Catalogue, build_personae, listed_skills, persona_row

CATALOGUE = Catalogue(["Sword", "Throwing Knife", "Elven Cloak"], ["Dodge", "Sprint", "Strongman"])
AENUR = {
    "name": "Aenur, the sword of twilight",
    "cost": 150,
    "upkeep": "n/a",
    "rating": 100,
    "race": "elf",
    "grade": "core",
    "permissiontext": "Any warband except Skaven may hire Aenur.",
    "flavour": "A swordsman.<br /><br />Tall.",
    "statblock": {"m": 5, "ws": 8, "bs": 4, "s": 4, "t": 3, "w": 2, "i": 7, "a": 3, "ld": 8},
    "equipment": "Aenur wears an <Tooltip>Elven Cloak</Tooltip>, <Tooltip>Swords</Tooltip> and <Tooltip>Ithilmar</Tooltip>.",
    "skills": "Aenur has: <Tooltip>Dodge</Tooltip> and <Tooltip>Sprint</Tooltip>.",
    "specialRules": [{"rulename": "Wanderer", "ruleFull": "He only ever stays with a warband for the battle."}],
}


class PersonaRowTests(SimpleTestCase):
    def test_a_persona_becomes_a_seed_row_with_its_profile_rules_kit_and_terms(self) -> None:
        row = persona_row(AENUR, CATALOGUE)

        self.assertEqual((row["name"], row["movement"], row["weapon_skill"], row["caster"]), ("Aenur, the sword of twilight", 5, 8, "No"))  # fmt: skip
        self.assertEqual(row["skills"], ["Dodge", "Sprint"])
        self.assertEqual(row["equipment"], [{"item": "Elven Cloak", "quantity": 1}, {"item": "Sword", "quantity": 1}])
        self.assertTrue(row["description"].endswith("Also carries: Ithilmar."))  # what the book lacks stays as text
        self.assertEqual(row["specials"][0]["name"], "Wanderer")
        terms = row["dramatis_persona"]
        self.assertEqual((terms["hire_fee"]["kind"], terms["hire_fee"]["gold"], terms["race"], terms["stays"]), ("gold", 150, "Elf", "one_battle"))  # fmt: skip
        self.assertEqual(terms["upkeep_fee"]["kind"], "none")  # "n/a": no upkeep
        self.assertEqual(terms["unique_to"], "Any warband except Skaven may hire Aenur.")

    def test_a_pair_takes_its_first_fighters_profile_and_a_caster_his_spells(self) -> None:
        pair = {
            "name": "Ulli & Marquand",
            "fighters": [
                {"name": "Marquand", "flavour": "A fop.", "statblock": {"m": 4, "ws": 5}, "skills": "<Tooltip>Dodge</Tooltip>"},
                {"name": "Ulli", "flavour": "A brute.", "statblock": {"m": 4, "ws": 4}},
            ],
            "spells": "He knows all six <a href='x'>Prayers of Sigmar</a>.",
        }  # fmt: skip

        row = persona_row(pair, CATALOGUE)

        self.assertEqual((row["weapon_skill"], row["skills"], row["caster"]), (5, ["Dodge"], "Priest"))
        self.assertIn("Ulli: A brute.", row["description"])
        self.assertEqual(row["specials"][-1], {"name": "Spells", "description": "He knows all six Prayers of Sigmar."})

    def test_a_plain_skill_list_is_read_after_its_colon_and_prose_left_out(self) -> None:
        text = "He has the following skills: Horse Archer, Pistolier, and Strongman. (and yes, he may)"

        self.assertEqual(listed_skills("He has: Horse Archer, Pistolier, and Strongman."), ["Horse Archer", "Pistolier", "Strongman"])  # fmt: skip
        self.assertEqual(listed_skills(text.split(".")[0] + "."), ["Horse Archer", "Pistolier", "Strongman"])

    def test_rows_are_sorted_by_name(self) -> None:
        rows = build_personae([{**AENUR, "name": "Zed"}, AENUR], CATALOGUE)

        self.assertEqual([row["name"] for row in rows], ["Aenur, the sword of twilight", "Zed"])
