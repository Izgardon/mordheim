"""Mordheim's scenarios (scenarios.py, William, 24 Nov 2026): mordheimer's 70 pages, each a title, source lines,
opening lines and sections under the standard names; the index's two 2D6 tables as Mordheim 1a's weights."""

from typing import Any, ClassVar

from django.test import SimpleTestCase

from catalogue_import.scenario_html import blocks, parse, source_lines
from catalogue_import.scenarios import build_scenarios, heading, read_page, setting_tables

PAGE = """<div class="theme-doc-markdown markdown"><header><h1>18. Kidnapped</h1></header>
<p><strong>Source:</strong> Town Cryer #6 <a href="x">PDF</a><br>
<strong>Setting:</strong> Mordheim<br>
<strong>Notes:</strong> Rescue a fair
maiden.</p>
<div class="theme-admonition"><div class="admonitionHeading_Gvgb">info</div>
<div class="admonitionContent_BuS1"><p>This is a Multiplayer scenario.</p></div></div>
<p><em>During the dark hours of
Geheimnisnacht.</em></p>
<h2 id="terrain">terrain<a href="#terrain" class="hash-link">​</a></h2>
<p>Place terrain.</p>
<h2>special rules</h2>
<h3>freeing the sacrificial victim</h3>
<p>The victim may escape.</p>
<h4>SPECIAL RULES</h4>
<table><thead><tr><th>Profile</th><th>M</th></tr></thead><tbody><tr><td>Victim</td><td>4</td></tr></tbody></table>
<h2>Experience</h2>
<ul><li><strong>+1 Survives.</strong> A hero survives.</li><li>+1 Winning Leader.</li></ul>
</div>"""


class PageTests(SimpleTestCase):
    def test_a_page_reads_as_its_title_source_lines_opening_lines_and_sections(self) -> None:
        page = read_page(PAGE, "kidnapped")

        self.assertEqual(page["title"], "18. Kidnapped")
        self.assertEqual(
            page["lines"], {"source": "Town Cryer #6", "setting": "Mordheim", "notes": "Rescue a fair maiden."}
        )
        self.assertEqual(page["intro"], "During the dark hours of Geheimnisnacht.")  # the site's info box left out
        self.assertEqual(
            [section["title"] for section in page["sections"]],
            ["Terrain", "Special rules", "Freeing the sacrificial victim", "Experience"],
        )
        self.assertEqual(page["sections"][1]["text"], "")  # a heading over its sub-headings alone
        freeing = page["sections"][2]
        self.assertEqual(freeing["text"], "The victim may escape.\n\nSpecial rules\n\n{{table:1}}")
        self.assertEqual(freeing["tables"], [{"columns": ["Profile", "M"], "rows": [["Victim", "4"]]}])
        self.assertEqual(page["sections"][3]["text"], "• +1 Survives. A hero survives.\n• +1 Winning Leader.")

    def test_headings_take_the_standard_names_else_sentence_case(self) -> None:
        cases = {
            "starting the game.": "Starting the game",
            "Starting The Game:": "Starting the game",
            "Set-Up": "Set-up",
            "setup": "Set-up",
            "Warbands:": "Warbands",
            "ILL GOTTEN GAINS…": "Ill gotten gains…",
            "payment and looting": "Payment and looting",
            "KaHotep the Mummy": "KaHotep the Mummy",
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(heading(raw), expected)

    def test_source_lines_are_only_a_paragraph_of_labels(self) -> None:
        found = blocks(parse("<p><strong>Author:</strong> Anon<br><strong>Source:</strong> Archive Pestilen PDF</p>"))
        self.assertEqual(source_lines(found[0]), {"author": "Anon", "source": "Archive Pestilen"})
        self.assertIsNone(source_lines(blocks(parse("<p>Source: a sentence.</p>"))[0]))

    def test_a_table_before_the_first_heading_stops_the_build(self) -> None:
        with self.assertRaises(ValueError):
            read_page("<header><h1>X</h1></header><table><tr><td>1</td></tr></table><h2>terrain</h2><p>a</p>", "x")


class TableTests(SimpleTestCase):
    INDEX = (
        '<div id="scenario-table"><table><tbody><tr><td>2</td><td>The lower-rated player chooses.</td></tr>'
        '<tr><td>7</td><td>Play Scenario 2: <a href="/docs/campaigns/scenarios/mordheim-rulebook/skirmish">'
        "Skirmish</a>.</td></tr></tbody></table></div>"
        '<div id="cots-table"><table><tbody><tr><td>5-6</td><td>Play <a href="/docs/campaigns/scenarios/'
        'town-cryer/treasure-hunt-tc5">Scenario 1: Treasure Hunt</a></td></tr></tbody></table></div>'
    )

    def test_a_result_weighs_its_chance_and_a_span_adds_its_numbers(self) -> None:
        tables, numbers = setting_tables(self.INDEX, {"skirmish", "treasure-hunt-tc5"})

        self.assertEqual(
            tables,
            [
                {
                    "setting": "Mordheim 1a",
                    "table": "scenario-table",
                    "scenarios": [{"slug": "skirmish", "rolls": "7", "weight": 6}],
                },  # fmt: skip
                {
                    "setting": "Mordheim 1a",
                    "table": "cots-table",
                    "scenarios": [{"slug": "treasure-hunt-tc5", "rolls": "5-6", "weight": 9}],
                },  # fmt: skip
            ],
        )
        self.assertEqual(numbers, {"skirmish": "2", "treasure-hunt-tc5": "1"})

    def test_a_table_naming_no_page_stops_the_build(self) -> None:
        with self.assertRaises(ValueError):
            setting_tables(self.INDEX, {"skirmish"})


class SnapshotTests(SimpleTestCase):
    data: ClassVar[dict[str, Any]]
    by_slug: ClassVar[dict[str, dict[str, Any]]]

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.data = build_scenarios()
        cls.by_slug = {entry["slug"]: entry for entry in cls.data["scenarios"]}

    def test_seventy_scenarios_each_named_once_with_sections(self) -> None:
        rows = self.data["scenarios"]
        self.assertEqual(len(rows), 70)
        self.assertEqual(len({entry["name"].lower() for entry in rows}), 70)
        self.assertTrue(all(entry["sections"] and entry["source"] for entry in rows))
        self.assertEqual(self.by_slug["breakthrough-archive-pestilen"]["name"], "Breakthrough (Archive Pestilen)")
        self.assertEqual(self.by_slug["breakthrough"]["name"], "Breakthrough")

    def test_the_rulebook_reads_in_the_standard_sections_with_its_numbers(self) -> None:
        hunt = self.by_slug["wyrdstone-hunt"]
        self.assertEqual(
            (hunt["name"], hunt["number"], hunt["source"], hunt["players"], hunt["summary"]),
            ("Wyrdstone Hunt", "3", "Mordheim Rulebook", "1v1", "Gain wealth by picking up wyrdstone."),
        )
        self.assertEqual(
            [section["title"] for section in hunt["sections"]],
            ["Terrain", "Special rules", "Warbands", "Starting the game", "Ending the game", "Experience", "Wyrdstone"],
        )
        treasure = self.by_slug["hidden-treasure"]
        rules = next(section for section in treasure["sections"] if section["title"] == "Special rules")
        self.assertIn("{{table:1}}", rules["text"])
        self.assertEqual(rules["tables"][0]["columns"], ["Items", "D6 Roll Required to Find"])

    def test_chaos_on_the_streets_is_multiplayer_and_keeps_its_numbers(self) -> None:
        mansion = self.by_slug["wizards-mansion-tc5"]
        self.assertEqual((mansion["players"], mansion["number"]), ("multiplayer", "4"))
        self.assertEqual(self.by_slug["kidnapped"]["number"], "")  # not numbered in its source
        caravan = [section["title"] for section in self.by_slug["the-caravan"]["sections"]]
        self.assertEqual(caravan[2:7], ["Special rules", "Wagons", "Rout tests", "Payment and looting", "Banditry"])

    def test_mordheim_1a_adds_the_rulebooks_nine_and_chaos_on_the_streets_seven_at_their_weights(self) -> None:
        weights = {row["slug"]: row["weight"] for table in self.data["settings"] for row in table["scenarios"]}
        self.assertEqual({table["setting"] for table in self.data["settings"]}, {"Mordheim 1a"})
        self.assertEqual(
            weights,
            {
                "skirmish": 6,
                "occupy": 5,
                "breakthrough": 5,
                "wyrdstone-hunt": 4,
                "surprise-attack": 4,
                "hidden-treasure": 3,
                "chance-encounter": 3,
                "street-fight": 2,
                "defend-the-find": 2,
                "treasure-hunt-tc5": 9,
                "ambush-tc5": 9,
                "street-brawl-tc5": 6,
                "wizards-mansion-tc5": 3,
                "pool-tc5": 3,
                "monster-hunt-tc5": 2,
                "lost-prince-tc5": 2,
            },
        )
