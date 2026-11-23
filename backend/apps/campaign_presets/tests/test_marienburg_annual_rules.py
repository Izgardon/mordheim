"""The Marienburg Annual's rules file (`sources/campaign-rules/marienburg-annual.json`), which a campaign playing
Mutiny in Marienburg with the Annual reads on top of Marienburg's own: both are copied into one campaign, so no title
may clash with Marienburg's."""

from django.test import SimpleTestCase

from apps.campaign_presets.seeding import read_charts, read_rules

ANNUAL = "marienburg-annual"
MARIENBURG = "mutiny-in-marienburg"


def titles(rows: list[dict]) -> set[str]:
    return {row["title"].lower() for row in rows}


class MarienburgAnnualRulesTests(SimpleTestCase):
    def test_it_reads_and_shares_no_title_with_marienburgs_rules_or_charts(self):
        rules, charts = read_rules(ANNUAL, ANNUAL), read_charts(ANNUAL, ANNUAL)

        self.assertEqual(
            (sum(rule["kind"] == "campaign" for rule in rules), sum(rule["kind"] == "battle" for rule in rules)),
            (10, 6),
        )
        self.assertEqual(len(charts), 8)
        self.assertEqual(titles(rules) & titles(read_rules(MARIENBURG, MARIENBURG)), set())
        self.assertEqual(titles(charts) & titles(read_charts(MARIENBURG, MARIENBURG)), set())

    def test_da_waaagh_joins_marienburgs_campaign_points_and_plots(self):
        waaagh = next(rule for rule in read_rules(ANNUAL, ANNUAL) if rule["title"] == "Da Waaagh")

        self.assertEqual(waaagh["umbrella"], "Campaign points and plots")
        self.assertIn("Nice Day for a Waaagh Beheadin'", waaagh["text"])

    def test_the_prophecy_tables_keep_their_printed_dice_and_say_where_they_dont_add_up(self):
        charts = {chart["title"]: chart for chart in read_charts(ANNUAL, ANNUAL)}

        who, animal = charts["Da Prophecy: Who?"], charts["Da Prophecy: Animal?"]
        self.assertEqual((who["dice"], [row["result"] for row in who["rows"]][::10]), ("D6", ["2", "12"]))
        self.assertIn("2 to 12", who["note"])
        self.assertEqual([row["result"] for row in animal["rows"]], ["1", "2", "3", "4", "5", "7"])
        self.assertIn("no 6", animal["note"])
        self.assertEqual({chart["umbrella"] for title, chart in charts.items() if title.startswith("Da Prophecy")}, {"Da Prophecy"})  # fmt: skip

    def test_each_warp_tear_kind_hangs_its_own_table_off_its_result(self):
        warp_tear = next(chart for chart in read_charts(ANNUAL, ANNUAL) if chart["title"] == "Warp Tear")

        self.assertEqual(
            [(row["result"], row["table"]["dice"], len(row["table"]["rows"])) for row in warp_tear["rows"]],
            [("1-2", "D6", 3), ("3-4", "D6", 6), ("5-6", "2D6", 5)],
        )
