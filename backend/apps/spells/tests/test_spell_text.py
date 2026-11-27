"""The book's spell text (`apps/spells/data/spells.json`), as the spells audit of 27 Nov 2026 found it wanting: rule
text the import lost or cut down (M2), site and markup residue (L1), typos carried from the sources (L3), and fluff,
cross-references and editorial notes (L4)."""

import json
import re
from pathlib import Path

from django.test import SimpleTestCase

from apps.core.book_lookups import spell_fields

SPELLS = Path(__file__).resolve().parent.parent / "data" / "spells.json"


def book() -> dict[tuple[str, str], str]:
    rows = json.loads(SPELLS.read_text(encoding="utf-8"))
    return {(row["type"], row["name"]): row["description"] for row in rows}


class SpellTextTests(SimpleTestCase):
    def setUp(self) -> None:
        self.text = book()

    def test_a_spell_keeps_its_range_and_its_whole_rule(self) -> None:
        self.assertIn('within 6"', self.text[("Prayers of Ulric", "Hammerschlag")])
        self.assertIn('within 12"', self.text[("Mortuary Cult Scrolls", "Neferre's Scroll of Quaking Horror")])
        visage = self.text[("Necromancy (Restless Dead)", "Deathly Visage")]
        self.assertIn("may choose this spell if the Liche has the spell Horror", visage)
        horror = self.text[("Necromancy (Restless Dead)", "Living Horror")]
        for words in ("no armour saves allowed", "still has Wounds remaining", "immune to fear"):
            self.assertIn(words, horror)

    def test_a_hirelings_spell_keeps_its_difficulty_once(self) -> None:
        # the audit's L2: every spell the hireling seeders made read "Difficulty 8. ..." with its dc 8 as well
        name, fields = spell_fields({"name": "1 - Banishment", "description": "Difficulty 8. Pulling the energies."})
        self.assertEqual((name, fields["dc"], fields["roll"], fields["description"]), ("Banishment", "8", 1, "Pulling the energies."))  # fmt: skip
        self.assertEqual(spell_fields({"name": "Rite", "description": "Difficulty: 7"})[1]["description"], "")

    def test_no_site_or_markup_residue_typos_or_editorial_notes(self) -> None:
        texts = list(self.text.values())
        # L1: a stray opening ".", a trailing table pipe, "-Stunned-" for stunned, a profile as a pipe table
        self.assertEqual([text for text in texts if text.startswith(".") or text.rstrip().endswith("|")], [])
        self.assertEqual([text for text in texts if re.search(r"-(stunned|out of action)-", text, re.I)], [])
        self.assertNotIn(" | ", self.text[("Prayers of Ulric", "Call of Ulric")])
        # L3: the sources' typos
        typos = ("line of sigh ", "caster' ", "the stare of", "IN addition", "Chose one", "it's", "if he wish ", "immediately to go")  # fmt: skip
        self.assertEqual([(typo, text[:40]) for typo in typos for text in texts if typo in text], [])
        self.assertIn("If the spell", self.text[("Mortuary Cult Scrolls", "Horrebe's Curse of the Mummy")])
        # L4: fluff, a note on later rules, our own commentary, a pointer to a rule he lacks, a fragment
        for words in ("Very handy", "described later", "The book's example", "(see Nurgle"):
            self.assertEqual([text[:40] for text in texts if words in text], [], words)
        self.assertTrue(self.text[("Snotling Waaagh! Magic", "Mork's Blessing")].startswith("The Shaman blesses"))

    def test_the_onogal_rituals_name_the_caster_not_the_carnivals_master(self) -> None:
        # the Marauders' Seer casts them too (William, 27 Nov 2026: "the caster")
        onogal = {name: text for (lore, name), text in self.text.items() if lore == "Onogal Rituals"}
        self.assertEqual([name for name, text in onogal.items() if "Master" in text], [])
        self.assertIn('within 12" of the caster', onogal["Pestilence"])
        self.assertTrue(onogal["Scabrous Hide"].startswith("The caster has an armour save of 2+"))
        self.assertIn("in base contact with the caster", onogal["Nurgle's Rot"])
