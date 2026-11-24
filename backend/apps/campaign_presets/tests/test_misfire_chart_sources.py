"""The blackpowder Misfire chart is the battle's Ranged helper's own now (William, 24 Nov 2026: "Ranged menu should
show the Misfire Chart just like it shows the crit chart ... remove it from there and just add here"), so no rules
file copies it into a campaign: Mutiny in Marienburg's Cartwright kept it among his tables."""

import json

from django.test import SimpleTestCase

from apps.campaign_presets.seeding import RULE_SOURCES


def chart_titles(node: object) -> list[str]:
    """Every chart's title anywhere in a rules file: its own, its places' and the ones their results hang off."""
    found: list[str] = []
    if isinstance(node, dict):
        if "rows" in node and isinstance(node.get("title"), str):
            found.append(node["title"])
        for value in node.values():
            found.extend(chart_titles(value))
    elif isinstance(node, list):
        for value in node:
            found.extend(chart_titles(value))
    return found


class MisfireChartSourcesTests(SimpleTestCase):
    def test_no_rules_file_holds_the_blackpowder_misfire_chart(self):
        for path in sorted(RULE_SOURCES.glob("*.json")):
            with self.subTest(path.name):
                titles = chart_titles(json.loads(path.read_text(encoding="utf-8")))
                self.assertNotIn("Blackpowder Misfires", titles)

    def test_the_cartwright_keeps_his_other_tables(self):
        groups = json.loads((RULE_SOURCES / "mutiny-in-marienburg.json").read_text(encoding="utf-8"))["location_groups"]
        cartwright = next(place for group in groups for place in group["locations"] if place["name"] == "Cartwright")

        self.assertEqual(
            [table["title"] for table in cartwright["tables"]],
            ["Cartwright: On Sale!", "Cart Parts", "Cartwright: Engine Malfunction", "Artillery Weapons"],
        )
