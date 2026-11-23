"""The Marienburg Annual's rules file (`sources/campaign-rules/marienburg-annual.json`), which a campaign playing
Mutiny in Marienburg with the Annual reads on top of Marienburg's own: both are copied into one campaign, so no title
may clash with Marienburg's."""

import json

from django.test import SimpleTestCase

from apps.campaign_presets.seeding import RULE_SOURCES, read_charts, read_rules

ANNUAL = "marienburg-annual"
MARIENBURG = "mutiny-in-marienburg"


def titles(rows: list[dict]) -> set[str]:
    return {row["title"].lower() for row in rows}


class MarienburgAnnualRulesTests(SimpleTestCase):
    def test_it_reads_and_shares_no_title_with_marienburgs_rules_or_charts(self):
        rules, charts = read_rules(ANNUAL, ANNUAL), read_charts(ANNUAL, ANNUAL)

        self.assertEqual(
            (sum(rule["kind"] == "campaign" for rule in rules), sum(rule["kind"] == "battle" for rule in rules)),
            (9, 4),  # less the Grail Quest, Dual wielding and the special scenario (William, 23 Nov 2026)
        )
        self.assertEqual(len(charts), 2)  # Da Prophecy's six are Da Prophet's own, in Da Camp (William, 23 Nov 2026)
        self.assertEqual(titles(rules) & titles(read_rules(MARIENBURG, MARIENBURG)), set())
        self.assertEqual(titles(charts) & titles(read_charts(MARIENBURG, MARIENBURG)), set())

    def test_da_waaagh_joins_marienburgs_campaign_points_and_plots(self):
        waaagh = next(rule for rule in read_rules(ANNUAL, ANNUAL) if rule["title"] == "Da Waaagh")

        self.assertEqual(waaagh["umbrella"], "Campaign points and plots")
        self.assertIn("Nice Day for a Waaagh Beheadin'", waaagh["text"])

    def test_the_prophecy_tables_live_on_da_prophet_and_keep_their_printed_dice(self):
        """William, 23 Nov 2026: the prophecies are the plot's, so they sit with Da Prophet in Da Camp rather than in
        the campaign's tables."""
        groups = json.loads((RULE_SOURCES / f"{ANNUAL}.json").read_text(encoding="utf-8"))["location_groups"]
        camp = next(group for group in groups if group["name"] == "Da Camp")
        prophet = next(place for place in camp["locations"] if place["name"] == "Da Prophet")
        tables = {table["title"]: table for table in prophet["tables"]}

        self.assertEqual(len(tables), 6)
        self.assertEqual((prophet["min_heroes"], prophet["max_heroes"], prophet["trading_action"]), (1, 1, False))
        who, animal = tables["Da Prophecy: Who?"], tables["Da Prophecy: Animal?"]
        self.assertEqual((who["dice"], [row["result"] for row in who["rows"]][::10]), ("D6", ["2", "12"]))
        self.assertIn("2 to 12", who["note"])
        self.assertEqual([row["result"] for row in animal["rows"]], ["1", "2", "3", "4", "5", "7"])
        self.assertIn("no 6", animal["note"])

    def test_each_warp_tear_kind_hangs_its_own_table_off_its_result(self):
        warp_tear = next(chart for chart in read_charts(ANNUAL, ANNUAL) if chart["title"] == "Warp Tear")

        self.assertEqual(
            [(row["result"], row["table"]["dice"], len(row["table"]["rows"])) for row in warp_tear["rows"]],
            [("1-2", "D6", 3), ("3-4", "D6", 6), ("5-6", "2D6", 5)],
        )
