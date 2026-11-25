"""The settings' scenarios (William, 25 Nov 2026): mordheimer's setting pages and the campaign PDFs' scenarios, each
setting's tables as weights (scenario_settings.py), a book's variation read onto the scenario it varies
(scenario_sources.py), and the settings that add none of their own."""

from fractions import Fraction
from typing import Any, ClassVar

from django.test import SimpleTestCase

from catalogue_import.scenario_build import build_scenarios
from catalogue_import.scenario_settings import roll_weight, setting_weights
from catalogue_import.scenario_sources import pdf_scenarios


class WeightTests(SimpleTestCase):
    def test_every_dice_weighs_in_thirty_sixths(self) -> None:
        self.assertEqual(roll_weight("2D6", "7"), 6)
        self.assertEqual(roll_weight("2D6", "6-8"), 16)
        self.assertEqual(roll_weight("D6", "1-2"), 12)
        self.assertEqual(roll_weight("3D6", "3"), Fraction(1, 6))
        self.assertEqual(roll_weight("3D6", "10"), Fraction(27, 6))

    def test_two_tables_add_a_share_splits_and_a_listed_one_weighs_nothing(self) -> None:
        setting = {
            "setting": "Somewhere",
            "from": "its book",
            "tables": [
                {"table": "Two", "dice": "2D6", "rows": [{"rolls": "7", "slug": "a"}, {"rolls": "8", "name": "Lost"}]},
                {"table": "Many", "dice": "2D6", "rows": [{"rolls": "5", "slug": "a", "share": "4/6"}]},
            ],
            "listed": [{"slug": "b", "why": "a special scenario"}],
        }
        found = setting_weights(setting, {"a", "b"})

        self.assertEqual({row["slug"]: row["weight"] for row in found["scenarios"]}, {"a": 8.67, "b": 0})
        self.assertEqual(found["scenarios"][0]["rolls"], "Two 7; Many 5")
        self.assertEqual(found["missing"], [{"table": "Two", "rolls": "8", "name": "Lost"}])

    def test_a_table_naming_no_scenario_or_listing_a_rolled_one_stops_the_build(self) -> None:
        rows = {"table": "Two", "dice": "2D6", "rows": [{"rolls": "7", "slug": "a"}]}
        with self.assertRaises(ValueError):
            setting_weights({"setting": "S", "from": "", "tables": [rows]}, {"b"})
        with self.assertRaises(ValueError):
            setting_weights({"setting": "S", "from": "", "tables": [rows], "listed": [{"slug": "a", "why": ""}]}, {"a"})


class VariationTests(SimpleTestCase):
    BASE: ClassVar[dict[str, Any]] = {
        "slug": "skirmish",
        "name": "Skirmish",
        "players": "1v1",
        "intro": "Two warbands meet.",
        "sections": [{"title": "Terrain", "text": "Ruins.", "tables": []}],
    }

    def test_a_variation_reads_as_its_scenario_with_the_books_changes_first(self) -> None:
        entry = {"slug": "fury", "name": "Fury", "base": "skirmish", "source": "Mousillon", "folder": "mousillon"}
        [found] = pdf_scenarios([{**entry, "title": "Fury (Mousillon)", "text": "A river."}], {"skirmish": self.BASE})

        self.assertEqual((found["players"], found["intro"], found["base"]), ("1v1", "Two warbands meet.", "skirmish"))
        self.assertEqual([section["title"] for section in found["sections"]], ["Fury (Mousillon)", "Terrain"])
        self.assertEqual(found["summary"], "Skirmish with Mousillon's changes.")

    def test_a_variation_of_nothing_we_hold_stops_the_build(self) -> None:
        entry = {"slug": "x", "name": "X", "base": "nothing", "source": "S", "folder": "s", "title": "X", "text": "y"}
        with self.assertRaises(ValueError):
            pdf_scenarios([entry], {})


class SettingSnapshotTests(SimpleTestCase):
    data: ClassVar[dict[str, Any]]
    by_slug: ClassVar[dict[str, dict[str, Any]]]
    tables: ClassVar[dict[str, dict[str, Any]]]

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.data = build_scenarios()
        cls.by_slug = {entry["slug"]: entry for entry in cls.data["scenarios"]}
        cls.tables = {table["setting"]: table for table in cls.data["settings"] if table["setting"] != "Mordheim 1a"}

    def weights(self, setting: str) -> dict[str, Any]:
        return {row["slug"]: row["weight"] for row in self.tables[setting]["scenarios"]}

    def test_each_setting_adds_its_count(self) -> None:
        counts = {name: len(table["scenarios"]) for name, table in self.tables.items()}
        self.assertEqual(
            counts,
            {
                "Empire in Flames": 18,
                "Lustria": 15,
                "Albion": 12,
                "Khemri 1b": 14,
                "The Nemesis Crown": 9,
                "Relics of the Crusades": 21,
                "Karak Azgal": 17,
                "Border Town Burning": 17,
                "Mousillon": 16,
                "Mutiny in Marienburg": 20,
                "Marienburg Annual": 1,
                "Sartosa": 32,
            },
        )
        none = {row["setting"] for row in self.data["none"]}
        self.assertEqual(
            none,
            {
                "Mordheim 1b",
                "Mordheim 1c",
                "Mordheim 2a",
                "Grade 3",
                "Khemri 3",
                "Sylvania",
                "Athel Loren",
                "The Sealed City",
            },
        )
        self.assertFalse(none & set(self.tables))

    def test_a_setting_with_two_tables_adds_both_and_its_others_weigh_nothing(self) -> None:
        flames = self.weights("Empire in Flames")
        self.assertEqual((flames["stagecoash-ambush"], flames["skirmish"], flames["eif-beastmen-the-raid"]), (12, 5, 0))
        self.assertEqual(set(self.weights("The Nemesis Crown").values()), {1})  # no table: each 1
        self.assertEqual(self.weights("Mousillon")["knights-vs-knights"], 0.17)  # 3D6's 18
        self.assertEqual(self.weights("Mutiny in Marienburg")["last-orders-border-town-burning"], 6)  # BTB's reprint
        self.assertEqual(self.weights("Karak Azgal")["the-engineers-workshop"], 3)  # The Wizard's Mansion's place

    def test_a_row_we_hold_nothing_for_is_left_out_and_said(self) -> None:
        sartosa = [row["name"] for row in self.tables["Sartosa"]["missing"]]
        self.assertIn("Haunted Wreck (Jim Schumacher)", sartosa)

    def test_a_name_printed_nowhere_points_at_the_scenario_in_its_slot(self) -> None:
        # William, 25 Nov 2026: "check the contents briefly and see if it would make sense, if so point at them"
        albion = {row["slug"]: row["rolls"] for row in self.tables["Albion"]["scenarios"]}
        self.assertEqual(albion["defend-the-tomb"], "Two-player scenarios 10; Multi-player scenarios 11")
        self.assertEqual(albion["street-brawl-tc5"], "Multi-player scenarios 7")  # Great Skirmish
        self.assertEqual(albion["tomb-raid"], "Multi-player scenarios 10")  # Raid
        khemri = {row["slug"]: row["rolls"] for row in self.tables["Khemri 1b"]["scenarios"]}
        self.assertEqual(khemri["street-brawl-tc5"], "Multi-player scenarios 7")  # Desert Skirmish
        self.assertFalse(self.tables["Albion"]["missing"] or self.tables["Khemri 1b"]["missing"])

    def test_a_setting_page_reads_with_its_books_number_and_source(self) -> None:
        avalanche = self.by_slug["avelanche"]
        self.assertEqual((avalanche["name"], avalanche["number"]), ("Avalanche!", "1"))
        self.assertEqual((avalanche["source"], avalanche["players"]), ("Border Town Burning", "1v1"))
        self.assertEqual(self.by_slug["siege"]["players"], "multiplayer")  # ** on its table
        orders = self.by_slug["last-orders-border-town-burning"]  # the Nemesis Crown's came first
        self.assertEqual(
            (orders["name"], self.by_slug["last-orders"]["source"]),
            ("Last Orders! (Border Town Burning)", "The Nemesis Crown"),
        )
        self.assertEqual(self.by_slug["stagecoash-ambush"]["name"], "Stagecoach Ambush")
        self.assertEqual(self.by_slug["defend-the-oasis"]["source"], "Town Cryer #19")
        self.assertEqual(self.by_slug["eif-beastmen-the-beast-hunt"]["name"], "The Beast Hunt")

    def test_each_pdf_reads_into_sections_under_the_standard_names(self) -> None:
        samples = {
            "the-engineers-workshop": ("Karak Azgal", "multiplayer", "Terrain"),
            "dungeon-raid": ("Relics of the Crusades", "1v1", "Terrain"),
            "primordial-chaos": ("Mousillon", "1v1", "Warbands"),
            "rolling-fog": ("Mutiny in Marienburg", "either", "Terrain"),
            "nice-day-for-a-waaagh-beheadin": ("Marienburg Annual", "multiplayer", "Terrain"),
            "press-gang": ("Sartosa", "either", "Terrain"),
        }
        for slug, (source, players, first) in samples.items():
            with self.subTest(slug=slug):
                entry = self.by_slug[slug]
                self.assertEqual(
                    (entry["source"], entry["players"], entry["sections"][0]["title"]), (source, players, first)
                )
        cleanse = [section["title"] for section in self.by_slug["cleanse-the-wood"]["sections"]]
        self.assertEqual(
            cleanse[:3], ["Terrain", "Set-up", "Starting the game"]
        )  # Battlefield, Deployment, Who goes first?
        monsters = next(s for s in self.by_slug["here-be-monsters"]["sections"] if s["title"] == "Young Sea Drake")
        self.assertEqual(
            monsters["tables"][0]["rows"], [["Young Sea Drake", "8*", "4", "0", "5", "5", "5", "6", "4", "7"]]
        )
        self.assertEqual(self.by_slug["dead-freight"]["number"], "10")

    def test_a_variation_is_its_scenario_with_the_books_changes_first(self) -> None:
        drink = self.by_slug["in-the-drink"]
        self.assertEqual(
            (drink["name"], drink["base"], drink["source"]), ("In the Drink! (Street Fight)", "street-fight", "Sartosa")
        )
        self.assertEqual(drink["sections"][1:], self.by_slug["street-fight"]["sections"])
        self.assertEqual(self.by_slug["the-thing-in-the-dark"]["base"], "the-thing-in-the-woods")
