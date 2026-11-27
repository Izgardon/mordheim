"""The book spells audit (27 Nov 2026) and William's answers to it: who casts, as what, and from which lores, read
from the committed `out/` (which test_build.py pins to a fresh run of build.py)."""

from typing import Any

from catalogue_import.tests.review_support import ReviewCase


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
