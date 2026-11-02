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
