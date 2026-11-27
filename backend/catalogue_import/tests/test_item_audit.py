"""The book items' audit of 27 Nov 2026, its obvious corrections: what a player reads on an item is that item's own.

A shared item rule keeps one item's wording, so an item that links it with no wording of its own showed that item's
name, and the Gas Mask the Temple Dog's armour save. Each now words the rule its own way where the books do.
"""

from typing import Any, ClassVar

from catalogue_import.common import load_json
from catalogue_import.sources import OUT
from catalogue_import.tests.review_support import ReviewCase


class ItemAuditCase(ReviewCase):
    shared: ClassVar[dict[str, dict[str, Any]]]

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.shared = {row["slug"]: row for row in load_json(OUT / "item-rules.json")}

    def shown(self, item: str, slug: str) -> str:
        """The text a player reads for the item's link to the shared rule: its own wording, else the rule's."""
        link = next(link for link in self.items[item]["rules"] if link.get("rule") == slug)
        return str(link.get("text") or self.shared[slug]["text"])


class SharedRuleWordingTests(ItemAuditCase):
    # the shared rule, the other item its wording names, and the items that showed that name
    OTHERS_WORDS = [
        (
            "thrown-weapon",
            "Cathayan candles",
            ["Hunter's Throwing Axe", "Magnin Throwing Knife", "Poison Wind Globe", "Poison Wind Globe (Athel Loren)"],
        ),
        ("move-or-fire", "handgun", ["Eagle-eye Bolt Thrower", "Harpoon Gun/Crossbow", "Swivel Gun"]),
        ("prepare-shot", "handgun", ["Eagle-eye Bolt Thrower", "Harpoon Gun/Crossbow", "Swivel Gun", "Sword Pistol"]),
        ("save-modifier", "Handguns", ["Eagle-eye Bolt Thrower", "Harpoon Gun/Crossbow", "Pocket Pistol"]),
        ("strike-last", "Broadswords", ["Great Scimitar"]),
        ("cutting-edge", "An axe", ["Cathayan Longsword"]),
        ("wagon", "Engine of Chaos", ["Mortis Engine"]),
    ]

    def test_an_item_reads_a_shared_rule_in_its_own_words(self) -> None:
        for slug, other, items in self.OTHERS_WORDS:
            for item in items:
                with self.subTest(item=item, rule=slug):
                    self.assertNotIn(other.lower(), self.shown(item, slug).lower())

    def test_the_marienburg_boat_guns_keep_their_own_save_modifiers(self) -> None:
        # the supplement's own words: a harpoon's wound is at -2 in all, the bolt thrower's at -3
        self.assertIn("-2 in all", self.shown("Harpoon Gun/Crossbow", "save-modifier"))
        self.assertIn("-3 in all", self.shown("Eagle-eye Bolt Thrower", "save-modifier"))
        # Sartosa's Pocket Pistol: "Save Modifier - As per the Mordheim rulebook", a pistol's -2
        self.assertIn("-2", self.shown("Pocket Pistol", "save-modifier"))

    def test_the_gas_mask_protects_against_poison_wind_and_gives_no_armour_save(self) -> None:
        rules = self.items["Gas Mask"]["rules"]
        self.assertNotIn({"rule": "save"}, rules)
        self.assertEqual(
            [rule["text"] for rule in rules],
            ["A warrior wearing a Gas Mask is affected by poison wind only on a D6 roll of 6+."],
        )

    def test_the_mechanical_suit_says_it_counts_as_chaos_armour_before_chaos_armours_rules(self) -> None:
        # Border Town Burning p159: "A Mechanical suit counts as Chaos armour and rules that would affect Chaos armour
        # affect the suit as well", so Chaos armour's five rules are the suit's
        rules = self.items["Mechanical Suit"]["rules"]
        self.assertEqual(rules[0]["name"], "Chaos Armour")
        self.assertIn("counts as Chaos armour", rules[0]["text"])
        held = [rule.get("rule") or rule["name"] for rule in rules[1:]]
        self.assertEqual(
            held, ["rarity", "cost", "gift-of-chaos", "spellcasters", "Suited and Booted", "movement-penalty"]
        )


class PlaceholderTests(ItemAuditCase):
    @staticmethod
    def placeholder(rule: dict[str, Any]) -> bool:
        """Mutiny in Marienburg's list one-liner: an unnamed rule with a summary and no text."""
        return "rule" not in rule and not rule["name"] and not rule["text"] and bool(rule["summary"])

    def test_the_list_one_liner_is_flavour_where_real_rules_follow(self) -> None:
        # the items audit, 27 Nov 2026: 38 items showed it as a "Rule" above the rules it summed up
        for name, item in self.items.items():
            if item["origin"] == "mim" and len(item["rules"]) > 1:
                with self.subTest(item=name):
                    self.assertFalse(any(self.placeholder(rule) for rule in item["rules"]))
        self.assertEqual(self.items["Lyre"]["flavour"], "An enchanted instrument handcrafted in Ulthuan.")
        # "details in rules" pointed at the rules that follow, so it goes
        self.assertEqual(self.items["Poison Wind Globe"]["flavour"], "Skaven gas bomb weapon.")

    def test_an_item_with_nothing_else_keeps_it_until_its_rules_are_written(self) -> None:
        rules = self.items["Dispel Scroll"]["rules"]
        self.assertEqual([self.placeholder(rule) for rule in rules], [True])
        self.assertEqual(self.items["Dispel Scroll"]["flavour"], "")


class BuyingNoteTests(ItemAuditCase):
    def notes(self) -> list[tuple[str, str, str]]:
        return [
            (name, key, row[key])
            for name, item in self.items.items()
            for row in item["availabilities"]
            for key in ("note", "cost_note")
            if row[key]
        ]

    def test_no_buying_note_is_the_imports_own_residue(self) -> None:
        # "No rarity in the source; No price in the source", "Rarity in the source: Common?", "All warbands*"
        for name, key, text in self.notes():
            with self.subTest(item=name, key=key):
                self.assertNotIn("in the source", text)
                self.assertNotIn("?", text)
                self.assertNotIn("*", text)
        self.assertEqual(self.rows("Nehekharan Javelins", "tomb-guardians"), [(10, None, None, "Tomb Lord only")])

    def test_a_note_shutting_warbands_out_sits_only_on_the_row_open_to_everyone(self) -> None:
        for name in ("Black Lotus", "Dark Venom"):
            for row in self.items[name]["availabilities"]:
                with self.subTest(item=name, label=row["label"], everyone=row["for_everyone"]):
                    shut_out = "Not available to" in row["note"]
                    self.assertEqual(shut_out, row["for_everyone"])

    def test_the_familiars_terms_are_its_buying_note_and_its_cost_is_plain(self) -> None:
        (row,) = self.items["Familiar"]["availabilities"]
        self.assertEqual((row["cost"], row["dice"], row["cost_note"]), (20, 1, ""))
        self.assertEqual(
            row["note"], "Only spellcasters may search for one, and the gold is spent even if the rarity roll fails."
        )

    def test_the_cinderblast_bombs_dice_show_once(self) -> None:
        (row,) = self.items["Cinderblast Bomb"]["availabilities"]
        self.assertEqual((row["cost"], row["dice"], row["cost_note"]), (45, 3, ""))
