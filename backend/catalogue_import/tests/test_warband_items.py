"""The items the warband templates bring in (warband_items.py): the Swivel Gun's shots back from our old seed, an item
no source has, and the special equipment we lack, each with one price row for its warband."""

from typing import Any

from django.test import SimpleTestCase

from catalogue_import.tests.world import world
from catalogue_import.warband_items import extra_items, seed_items_back, special_equipment_items

SEED = [
    {
        "name": "Swivel Gun - Ball Shot",
        "type": "Miscellaneous",
        "strength": "5",
        "properties": [12],
        "single_use": True,
        "availabilities": [{"cost": 5, "rarity": 2}],
    }
]
PROPERTIES = {12: {"id": 12, "name": "Ball Shot", "description": 'Blackpowder ammunition. Maximum Range: 36".'}}
BACK = {"Swivel Gun - Ball Shot": {"setting": "mordheim-1b", "source": "Town Cryer #9", "why": "its shots"}}


def page(*entries: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {"skaven-eshin": {"name": "Skaven", "source": "Mordheim Rulebook", "specialEquipment": list(entries)}}


def equipment(title: str, availability: str, *rules: tuple[str, str]) -> dict[str, Any]:
    return {
        "title": title,
        "cost": {"cost": 30},
        "availability": availability,
        "specialRules": [{"rulename": name, "ruleFull": text} for name, text in rules],
    }


class SeedItemsBackTests(SimpleTestCase):
    def test_an_old_seed_row_comes_back_single_use_with_its_properties_as_rules(self) -> None:
        [shot] = seed_items_back(BACK, SEED, PROPERTIES)
        self.assertEqual(
            (shot["name"], shot["setting"], shot["strength"], shot["single_use"]),
            (
                "Swivel Gun - Ball Shot",
                "mordheim-1b",
                "5",
                True,
            ),
        )
        self.assertEqual([rule["name"] for rule in shot["rules"]], ["Ball Shot"])
        [row] = shot["availabilities"]
        self.assertEqual((row["cost"], row["rarity"], row["for_everyone"]), (5, None, True))

    def test_a_name_the_seed_lacks_stops_the_build(self) -> None:
        with self.assertRaisesRegex(ValueError, "no seed item 'Swivel Gun - Doom Shot'"):
            seed_items_back({"Swivel Gun - Doom Shot": BACK["Swivel Gun - Ball Shot"]}, SEED, PROPERTIES)


class ExtraItemTests(SimpleTestCase):
    def test_an_item_no_source_has_gets_one_row_for_its_warbands(self) -> None:
        _types, _resolver, groups, _ctx = world()
        entry = {
            "name": "War Chain",
            "type": "Weapon",
            "subtype": "Melee",
            "setting": "mordheim-1b",
            "source": "Town Cryer #14",
            "cost": 20,
            "warbands": ["pit-fighters"],
            "note": "Pit Fighters only",
        }
        [chain] = extra_items([entry], groups, {})
        [row] = chain["availabilities"]
        self.assertEqual(
            (chain["rules"], row["cost"], row["for_everyone"], row["note"]), ([], 20, False, "Pit Fighters only")
        )
        self.assertEqual(row["warbands"], [{"type": "pit-fighters", "excluded": False}])

    def test_an_item_with_no_cost_gets_no_price_row_and_its_rules_shared_or_its_own(self) -> None:
        # William, 13 Nov 2026, of the Pox Staff: "Add it in, it should be an item ideally hidden from the store if
        # specific to a hired sword/dramatis". No price row is how: who_can.py's `offer` makes none for an item with
        # no rows, so the store never shows it.
        _types, _resolver, groups, _ctx = world()
        entry = {
            "name": "Pox Staff",
            "type": "Weapon",
            "subtype": "Melee",
            "setting": "grade-3",
            "source": "Cardinal of Contagion",
            "strength": "As user",
            "rules": [{"rule": "concussion"}, {"name": "Pox", "text": "A 6 to hit takes 1 Toughness."}],
        }
        index = {"concussion": {"slug": "concussion"}}

        [staff] = extra_items([entry], groups, index)

        self.assertEqual(staff["availabilities"], [])
        self.assertEqual(
            staff["rules"],
            [
                {"rule": "concussion"},
                {"name": "Pox", "summary": "", "text": "A 6 to hit takes 1 Toughness.", "tables": []},
            ],
        )
        self.assertEqual(staff["strength"], "As user")

    def test_a_shared_rule_no_rule_of_ours_has_stops_the_build(self) -> None:
        _types, _resolver, groups, _ctx = world()
        entry = {
            "name": "Pox Staff",
            "type": "Weapon",
            "setting": "grade-3",
            "source": "Cardinal of Contagion",
            "rules": [{"rule": "concusion"}],
        }
        with self.assertRaisesRegex(ValueError, "no shared rule 'concusion'"):
            extra_items([entry], groups, {"concussion": {"slug": "concussion"}})


class SpecialEquipmentTests(SimpleTestCase):
    def build(self, *entries: dict[str, Any], decisions: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        types, _resolver, groups, _ctx = world()
        decided = decisions or {
            entry["title"]: {"page": "skaven-eshin", "warband": "skaven", "type": "Weapon"} for entry in entries
        }
        return special_equipment_items(decided, page(*entries), types, groups, {})

    def test_its_rarity_who_and_figures_come_from_the_book(self) -> None:
        [whip] = self.build(
            equipment(
                "Hedonist Whip",
                "Rare 10 (Aristocrat only)",
                ("Range", "Close combat"),
                ("Strength", "As user"),
                ("Special Rules", "Whipcrack"),
                ("Whipcrack", "+1 A when charging."),
            )
        )
        [row] = whip["availabilities"]
        self.assertEqual((whip["range"], whip["strength"]), ("Close combat", "As user"))
        self.assertEqual([rule["name"] for rule in whip["rules"]], ["Whipcrack"])
        self.assertEqual((row["cost"], row["rarity"], row["note"]), (30, 10, "Aristocrat only"))
        self.assertEqual(row["warbands"], [{"type": "skaven", "excluded": False}])

    def test_common_and_a_bare_who_read_as_common(self) -> None:
        masks = self.build(equipment("Sun King Mask", "Aristocrat only"), equipment("Faceless Mask", ""))
        self.assertEqual(
            [(m["availabilities"][0]["rarity"], m["availabilities"][0]["note"]) for m in masks],
            [
                (None, "Aristocrat only"),
                (None, ""),
            ],
        )

    def test_an_item_named_for_its_warband_reads_the_entry_it_names(self) -> None:
        decided = {
            "Misericordia (Skaven)": {
                "page": "skaven-eshin",
                "entry": "Misericordia",
                "warband": "skaven",
                "type": "Weapon",
            }
        }
        [dagger] = self.build(equipment("Misericordia", "Rare 9"), decisions=decided)
        self.assertEqual((dagger["name"], dagger["availabilities"][0]["rarity"]), ("Misericordia (Skaven)", 9))

    def test_an_entry_the_page_lacks_stops_the_build(self) -> None:
        with self.assertRaisesRegex(ValueError, "no 'Boar Spear' on skaven-eshin"):
            self.build(decisions={"Boar Spear": {"page": "skaven-eshin", "warband": "skaven", "type": "Weapon"}})
