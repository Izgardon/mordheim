"""The book's spell text (`apps/spells/data/spells.json`), as the spells audit of 27 Nov 2026 found it wanting: rule
text the import lost or cut down (M2), site and markup residue (L1), typos carried from the sources (L3), and fluff,
cross-references and editorial notes (L4)."""

import json
from pathlib import Path

from django.test import SimpleTestCase

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
