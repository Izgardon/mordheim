"""The encampments in the campaign rules files (`encampment_rules` and `encampment_groups`), read straight from the
JSON: the places a warband holds and the setting's rules on holding them (William, 24 Nov 2026)."""

import json
from typing import Any

from django.test import SimpleTestCase

from apps.campaign_presets.seeding import PRESET_SOURCES, RULE_SOURCES

MARIENBURG = "mutiny-in-marienburg"
BORDER_TOWN = "border-town-burning"
SARTOSA = "sartosa"


def source(name: str) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((RULE_SOURCES / f"{name}.json").read_text(encoding="utf-8"))
    return data


def encampments(data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {camp["name"]: camp for group in data["encampment_groups"] for camp in group["encampments"]}


class EncampmentSourceTests(SimpleTestCase):
    def test_each_file_holds_its_groups_in_the_books_order(self):
        counts = {
            name: [(group["name"], len(group["encampments"])) for group in source(name)["encampment_groups"]]
            for name in (MARIENBURG, BORDER_TOWN, SARTOSA)
        }

        self.assertEqual(
            counts,
            {
                MARIENBURG: [("Marienburg city", 12), ("Outside the city", 7)],  # Watch Station left out
                BORDER_TOWN: [("The borderlands", 1)],
                SARTOSA: [("Port towns", 8), ("Inland towns", 3), ("Wilderness", 4)],
            },
        )

    def test_every_encampment_is_named_once_and_says_how_it_is_gained_and_what_it_gives(self):
        for name in (MARIENBURG, BORDER_TOWN, SARTOSA, "marienburg-annual"):
            data = source(name)
            names = [
                camp["name"].casefold() for group in data.get("encampment_groups", []) for camp in group["encampments"]
            ]
            self.assertEqual(len(names), len(set(names)), name)
            for group in data.get("encampment_groups", []):
                self.assertTrue(group["name"].strip(), name)
                self.assertIsInstance(group["description"], str, name)
                for camp in group["encampments"]:
                    self.assertEqual(set(camp), {"name", "gained_by", "fortified", "text"}, camp["name"])
                    self.assertTrue(camp["gained_by"].strip(), camp["name"])
                    self.assertTrue(camp["text"].strip(), camp["name"])
                    self.assertIsInstance(camp["fortified"], bool, camp["name"])
            titles = [rule["title"].casefold() for rule in data.get("encampment_rules", [])]
            self.assertEqual(len(titles), len(set(titles)), name)

    def test_the_holding_rules_moved_out_of_the_campaign_rules(self):
        moved = {
            MARIENBURG: ("Encampments", ["Encampments", "Rebuilding a razed encampment"]),
            SARTOSA: ("Locales", ["A locale campaign", "Trading at a locale"]),
        }
        for name, (umbrella, titles) in moved.items():
            data = source(name)
            self.assertEqual([rule["title"] for rule in data["encampment_rules"]], titles, name)
            self.assertTrue(all(rule["text"] for rule in data["encampment_rules"]), name)
            left = {rule["title"] for rule in data["rules"] + data["battle_rules"]}
            self.assertEqual(left & set(titles), set(), name)
            self.assertNotIn(umbrella, {rule["umbrella"] for rule in data["rules"]}, name)
        # Border Town Burning's one encampment says all of it, so it has no holding rule of its own
        self.assertNotIn("encampment_rules", source(BORDER_TOWN))

    def test_the_fortified_ones_are_those_the_book_calls_fortified_or_contests_with_stockade(self):
        fortified = sorted(name for name, camp in encampments(source(MARIENBURG)).items() if camp["fortified"])

        self.assertEqual(fortified, ["Lighthouse", "Mortuary", "Rat Rock", "Torture Chamber"])
        self.assertFalse(any(camp["fortified"] for camp in encampments(source(SARTOSA)).values()))

    def test_the_trading_post_keeps_its_restoration_and_the_locales_their_control(self):
        trading_post = encampments(source(MARIENBURG))["Trading Post"]
        self.assertIn("D6x25+150 gold crowns", trading_post["text"])
        self.assertIn("four games", trading_post["text"])
        abandoned = encampments(source(BORDER_TOWN))["Abandoned Trading Post"]
        self.assertIn("Hostile Embargo", abandoned["text"])
        for name, locale in encampments(source(SARTOSA)).items():
            self.assertEqual(locale["gained_by"], "12 Battle Points, and the most", name)
            self.assertIn("Controlling it: ", locale["text"], name)

    def test_the_presets_that_hold_encampments_switch_the_page_on(self):
        for slug in (MARIENBURG, "mutiny-in-marienburg-annual", BORDER_TOWN, SARTOSA):
            preset = json.loads((PRESET_SOURCES / f"{slug}.json").read_text(encoding="utf-8"))
            self.assertIs(preset["enable_encampments"], True, slug)
