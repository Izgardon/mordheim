"""William's review of 12 Nov 2026: Mutiny in Marienburg's items moved to the setting of their grade, the
price rows four warband types join and the spelling aligned (groups 4 to 6 of the review), with its later
rulings on the Norse Explorers template and the Albion Commandos type. The merges, the separations and the
numbers are in test_review_rulings.py.
"""

from catalogue_import.common import load_json
from catalogue_import.sources import ITEM_DATA, OUT
from catalogue_import.tests.review_support import ReviewCase


class NumbersSettingsRowsAndNamesTests(ReviewCase):
    # 4. Mutiny in Marienburg's items sit in the setting of their own grade

    def test_each_mutiny_in_marienburg_item_sits_in_the_setting_of_its_grade(self) -> None:
        # William, 12 Nov 2026: a MiM item of a Mordheim grade belongs to that Mordheim setting; the grades above
        # the supplement's own 2b ("2c" and "3a", which the system has no part for) are 2b and stay in it
        mim = [row for row in load_json(OUT / "items.json") if row["origin"] == "mim"]
        by_setting: dict[str, list[str]] = {}
        for row in mim:
            by_setting.setdefault(row["setting"], []).append(row["name"])
        self.assertEqual(
            {setting: len(names) for setting, names in sorted(by_setting.items())},
            {"mordheim": 3, "mordheim-1b": 7, "mordheim-2a": 6, "mutiny-in-marienburg": 45},
        )
        self.assertEqual(sorted(by_setting["mordheim"]), ["Caber", "Falconry Glove", "Lyre"])
        self.assertEqual(
            sorted(by_setting["mordheim-1b"]),
            [
                "Albion Cloth",
                "Alcoholic Spirits",
                "Fish-hook Shot/Hunting Lasso",
                "Gas Mask",
                "Iron Strongbox",
                "Thief's Cloak",
                "Wolf Cloak/Norse Furs",
            ],  # fmt: skip
        )
        self.assertEqual(
            sorted(by_setting["mordheim-2a"]),
            [
                "Beast Hide/Wyvern Hide Cloak",
                "Hunter's Throwing Axe",
                "Poison Wind Globe",
                "Shark-tooth Necklace",
                "Skull Cap",
                "Stiletto Blade",
            ],  # fmt: skip
        )

    def test_no_item_is_graded_2c_or_3a_any_more(self) -> None:
        grades = {str(row.get("grade")) for row in load_json(ITEM_DATA / "mim-items.json")}
        self.assertEqual(grades, {"1a", "1b", "2a", "2b"})

    def test_mutiny_in_marienburg_is_a_one_grade_setting_now(self) -> None:
        settings = {row["slug"]: row for row in load_json(OUT / "settings.json")}
        mim = settings["mutiny-in-marienburg"]
        self.assertEqual((mim["grade"], mim["grades_seen"]), ("2b", {"2b": 58}))
        self.assertEqual(mim["counts"]["items"], 45)

    # 5. Price rows: the types join the row that already carries their price

    def test_the_nehekhara_tomb_guards_may_buy_their_own_lists_three_khemri_items(self) -> None:
        # their own template's lists sell all three, while our rows named the Tomb Guardians alone, so in the store
        # they read "Not usually available"; the prices are identical, so the type joins the row
        for name, cost in (("Asp Arrows", 10), ("Nehekharan Javelins", 10), ("Serpent Staff", 30)):
            with self.subTest(item=name):
                [(row_cost, _dice, _rarity, _note)] = self.rows(name, "nehekhara-tomb-guards")
                self.assertEqual(row_cost, cost)
                buyers = {
                    entry["type"]
                    for row in self.items[name]["availabilities"]
                    for entry in row["warbands"]
                    if "type" in entry and not entry["excluded"]
                }
                self.assertEqual(buyers, {"tomb-guardians", "nehekhara-tomb-guards"})
                lines = {
                    line["item"]["name"]
                    for row in self.templates["nehekhara-tomb-guards"]["lists"]
                    for line in row["lines"]
                }
                self.assertIn(name, lines)

    def test_the_sea_ghosts_and_the_corsairs_join_our_sea_dragon_cloaks_row(self) -> None:
        [row] = self.items["Sea Dragon Cloak"]["availabilities"]
        buyers = [entry["type"] for entry in row["warbands"]]
        self.assertEqual(buyers, ["dark-elves", "dark-elf-corsairs", "sea-ghosts"])
        self.assertEqual((row["cost"], row["dice"], row["rarity"]), (50, 2, 10))

    def test_the_glyph_of_blasting_and_the_grimoire_keep_the_expeditionary_partys_rows(self) -> None:
        # the one item in the price-row pile with nothing to do: both already name that warband and nothing else
        for name in ("Glyph of Blasting", "Grimoire of Magic"):
            with self.subTest(item=name):
                [row] = self.items[name]["availabilities"]
                self.assertFalse(row["for_everyone"])
                self.assertEqual(row["warbands"], [{"type": "altdorf-expeditionary-party", "excluded": False}])

    # 6. Spelling, aligned (William: "fix all spelling and keep it aligned")

    def test_the_arabyan_thieves_are_spelt_the_same_everywhere(self) -> None:
        # the warband type already read "Arabyan Thieves" (overrides.json warband_type_names) while its template,
        # its skill group and two of its skills kept Broheim's "Theives"; the type's slug stays the source's
        types = {row["slug"]: row["name"] for row in load_json(OUT / "warband-types.json")}
        self.assertEqual(types["arabyan-theives"], "Arabyan Thieves")
        template = next(row for row in self.templates.values() if "arabyan-th" in row["slug"])
        self.assertEqual(template["name"], "Arabyan Thieves")
        self.assertEqual([row["type"] for row in template["types"]], ["arabyan-theives"])
        self.assertIn("Arabyan Thieves", self.groups)
        self.assertLessEqual(
            {"Knife Fighting (Arabyan Thieves)", "Hide in Shadows (Arabyan Thieves)"},
            set(self.groups["Arabyan Thieves"]),
        )
        misspelt = [name for name in (*self.skills, *self.groups, *(row["name"] for row in self.templates.values())) if "Theives" in name]  # fmt: skip
        self.assertEqual(misspelt, [])

    def test_the_khemri_mage_warbands_group_is_named_after_its_warband(self) -> None:
        # every other group is named after its warband; "Magician Skills" was the PDF's name for the column
        self.assertNotIn("Magician Skills", self.groups)
        self.assertEqual(self.groups["Mages"], ["Dispel", "Store Spell", "Clockwork Mage"])

    def test_dispel_and_virtue_of_valour_are_spelt_as_the_catalogue_spells_them(self) -> None:
        # the Altdorf skill was "Dispell", which its page prints and nothing else in the catalogue does; our own
        # Bretonnian Knights row read "Virtue of Valor" where mordheimer, the Bitter Moors' skill and its own
        # description all say "Valour"
        self.assertEqual(sorted(name for name in self.skills if name.startswith("Dispel")), ["Dispel", "Dispel (Altdorf Expeditionary Party)"])  # fmt: skip
        self.assertEqual(sorted(name for name in self.skills if "Valo" in name), ["Virtue of Valour", "Virtue of Valour (Knights of the Bitter Moors)"])  # fmt: skip
        self.assertIn("valourous", self.skills["Virtue of Valour"])

    def test_the_low_kings_hide_in_shadows_rule_is_cased_as_every_other_spelling_of_it(self) -> None:
        rules = [row["title"] for row in self.templates["low-kings"]["rules"]]
        specials = [
            special["name"] for fighter in self.templates["low-kings"]["fighters"] for special in fighter["specials"]
        ]
        self.assertNotIn("Hide In Shadows", [*rules, *specials])
        self.assertIn("Hide in Shadows", specials)

    def test_one_norse_explorers_template_serves_both_types(self) -> None:
        # William, 12 Nov 2026: both Norse Explorers types point at the one mordheimer page, and the Border Town
        # Burning one has no PDF of its own. Deleting that type would take the Norse out of a Border Town Burning
        # campaign, since a setting gates what is in play, so the one template serves both. The page has no
        # variants, so neither type presets one; the template keeps Lustria, the first type's and the earlier.
        norse = next(row for row in self.templates.values() if row["slug"] == "norse-explorers")
        self.assertEqual(norse["setting"], "lustria")
        self.assertEqual(norse["variants"], [])
        self.assertEqual(
            [(row["type"], row["variant"]) for row in norse["types"]],
            [("norse-explorers-tc13", ""), ("norse-explorers-btb", "")],
        )
        settings = {row["slug"]: row["setting"] for row in load_json(OUT / "warband-types.json")}
        self.assertEqual(settings["norse-explorers-tc13"], "lustria")
        self.assertEqual(settings["norse-explorers-btb"], "border-town-burning")

    def test_the_albion_commandos_type_is_gone_and_the_caber_keeps_its_restriction(self) -> None:
        # a phantom: no grade, no source code, no mordheimer page and no PDF, made only because one line of the
        # Marienburg weapons list reads "Caber (Albion Commandos only)" and the importer read the bracket as a
        # warband type. The restriction stays as the Caber's note, and travels with it into Mordheim 1a.
        slugs = {row["slug"] for row in load_json(OUT / "warband-types.json")}
        self.assertNotIn("albion-commandos", slugs)
        members = {member for row in load_json(OUT / "warband-groups.json") for member in row["members"]}
        self.assertNotIn("albion-commandos", members)
        caber = self.items["Caber"]
        self.assertEqual(caber["setting"], "mordheim")
        [row] = caber["availabilities"]
        self.assertEqual((row["cost"], row["for_everyone"], row["warbands"]), (25, True, []))
        self.assertEqual(row["note"], "Albion Commandos only")
