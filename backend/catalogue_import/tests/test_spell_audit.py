"""The book spells audit (27 Nov 2026) and William's answers to it: who casts, as what, and from which lores, read
from the committed `out/` (which test_build.py pins to a fresh run of build.py)."""

from typing import Any

from catalogue_import.common import load_json
from catalogue_import.tests.review_support import SPELL_DATA, ReviewCase

MINOR_RUNES = "Minor Runes (Dwarf Rangers)"


class CasterTests(ReviewCase):
    def fighter(self, slug: str, name: str) -> dict[str, Any]:
        found: dict[str, Any] = next(row for row in self.templates[slug]["fighters"] if row["name"] == name)
        return found

    def lores(self, slug: str, name: str) -> list[str]:
        return [lore["name"] for lore in self.fighter(slug, name)["spell_types"]]

    def test_a_caster_his_own_rules_say_is_no_wizard_casts_from_his_lore_alone(self) -> None:
        # the Grudgebearers' Runesmith "is no wizard", the Mazzalupo Wandering knight "does not count as a wizard"
        # (William, 27 Nov 2026: no caster rule, their lore only, which still gives them their first pick)
        for slug, name, lore in (
            ("dwarf-grudgebearers", "Runesmith", "Dwarf Runes"),
            ("mazzalupo", "Wandering knight", "Commands (Mazzalupo)"),
        ):
            with self.subTest(fighter=name):
                self.assertEqual(self.fighter(slug, name)["caster"], "No")
                self.assertEqual(self.lores(slug, name), [lore])

    def test_the_circus_performers_cast_nothing_the_magician_is_made_a_wizard_by_hand(self) -> None:
        # only the 0-1 Magician casts, and a Performer picks his specialization when he joins (William, 27 Nov 2026)
        performer = self.fighter("circus-extraordinaire", "Performer")
        self.assertEqual((performer["caster"], performer["spell_types"]), ("No", []))
        rules = {special["name"]: special["description"] for special in performer["specials"]}
        self.assertIn("Magician", rules["Specialist"])

    def test_the_fanatics_prophet_is_a_priest_of_his_prophetic_rants(self) -> None:
        # his Rants are a prayer list (William, 27 Nov 2026: a Priest); a caster is a priest exactly when every lore
        # he casts from is one of prayer-lores.json's
        self.assertEqual(self.fighter("mordheimers-fanatics", "Prophet")["caster"], "Priest")
        self.assertEqual(self.lores("mordheimers-fanatics", "Prophet"), ["Prophetic Rants"])

    def test_the_dwarf_rangers_runesmith_knows_a_minor_rune_from_their_d6_list(self) -> None:
        # "He knows one of the following minor runes": the six, on the D6, as his lore; The Jealousy of Runes his
        # rule; and no caster rule, the lore alone giving his first rune (William, 27 Nov 2026)
        runesmith = self.fighter("dwarf-rangers", "Runesmith")
        self.assertEqual((runesmith["caster"], self.lores("dwarf-rangers", "Runesmith")), ("No", [MINOR_RUNES]))
        rules = {special["name"]: special["description"] for special in runesmith["specials"]}
        self.assertIn("not cumulative", rules["The Jealousy of Runes"])
        self.assertIn("roll 2D6", rules["Inscribe Runes"])
        for pointer in ("see list", "see below"):
            self.assertNotIn(pointer, rules["Inscribe Runes"])
        runes = [row for row in load_json(SPELL_DATA / "spells.json") if row["type"] == MINOR_RUNES]
        table = [(row["roll"], row["name"], row["dc"]) for row in runes]
        self.assertEqual(
            table,
            [
                (1, "Rune of Stone", "8"),
                (2, "Rune of Sharpness", "6"),
                (3, "Rune of Speed", "7"),
                (4, "Rune of Warding", "8"),
                (5, "Rune of Accuracy", "9"),
                (6, "Rune of Striding", "8"),
            ],
        )
        self.assertEqual({row["setting"] for row in runes}, {"nemesis-crown"})
