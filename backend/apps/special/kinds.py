"""Boons & Banes (William, 2 Nov 2026): every special is a boon (it helps the unit), a bane (it holds him back) or a
trait (neither: Leader, Large, Wizard, hired-sword terms and the like).

The book's are classified by name in `data/special-kinds.json`, which the seeders read (seed_spells_and_special, the
hired swords' and dramatis personae's own specials through `BookLookups`, and the specials the injury tables grant)
so William can review it in one place. A custom special picks its own in its form; anything unlisted is a trait.
"""

import json
from functools import cache
from pathlib import Path

BOON, BANE, TRAIT = "boon", "bane", "trait"
KIND_CHOICES = ((BOON, "Boon"), (BANE, "Bane"), (TRAIT, "Trait"))
KINDS_PATH = Path(__file__).resolve().parent / "data" / "special-kinds.json"


@cache
def _book_kinds() -> dict[str, str]:
    with KINDS_PATH.open(encoding="utf-8") as handle:
        data = json.load(handle)
    return {str(name).strip().casefold(): kind for name, kind in data.items() if kind in dict(KIND_CHOICES)}


def book_kind(name: str, default: str = TRAIT) -> str:
    """The kind the book's classification gives `name`, else `default`."""
    return _book_kinds().get(name.strip().casefold(), default)


# Whose rule a special is (William, 2 Nov 2026: "can we not show the hired swords/dramatis ones here"): a general one
# (the book's specials, the injury tables', a campaign's own) shows in the Boons & Banes pickers; a hired sword's or a
# dramatis persona's own rule, which their seeders create under "Hired Sword - <name>" or "Dramatis Persona - <name>"
# when the book lacks it (core/book_lookups.py), shows only with them. Who holds it is its link rows: several may.
GENERAL, HIRED_SWORD, DRAMATIS_PERSONA = "general", "hired_sword", "dramatis_persona"
OWNER_KIND_CHOICES = ((GENERAL, "General"), (HIRED_SWORD, "Hired sword"), (DRAMATIS_PERSONA, "Dramatis persona"))
OWNER_TYPES = {"Hired Sword": HIRED_SWORD, "Dramatis Persona": DRAMATIS_PERSONA}  # BookLookups' own types


def owner_kind_of(special_type: str) -> str:
    """The owner kind a seeded special's type says: "Hired Sword - Dark Mage" is a hired sword's own rule."""
    prefix, separator, _ = special_type.partition(" - ")
    return OWNER_TYPES.get(prefix.strip(), GENERAL) if separator else GENERAL
