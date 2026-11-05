"""What a special is (William, 4-5 Nov 2026), which picks its icon: an injury (the serious injury results), a mutation
(Great Claw, Tentacle, Daemon Soul), an aura (mental, leadership, fear, magic, marks and the like; the default) or the
body (Large, Regeneration, Scaly Skin, Hard to Kill, the animals' rules). Its Boons & Banes kind colours the icon.

The book's are set by `book_category`, which every seeder of a book special calls (seed_spells_and_special, the
hired swords' and dramatis personae's own specials through `BookLookups`, the warband templates' and the specials the
injury tables grant), its names from `data/special-categories.json` so William can review them in one place. A custom
special picks its own in its form; `type` stays the free-text label of whose rule it is.
"""

import json
from functools import cache
from pathlib import Path

from .kinds import INJURY as INJURY_TYPE

INJURY, MUTATION, AURA, BODY = "injury", "mutation", "aura", "body"
CATEGORY_CHOICES = ((INJURY, "Injury"), (MUTATION, "Mutation"), (AURA, "Aura"), (BODY, "Body"))
CATEGORIES_PATH = Path(__file__).resolve().parent / "data" / "special-categories.json"

ANIMAL_TYPE = "Animal"  # the mounts' and beasts' rules (data/special.json)
# a warband template's upgrade groups bought as mutations: (its specials' type, the group)
MUTATION_GROUPS = {("Warband - Cult of the Possessed", "Mutations")}


@cache
def _book_categories() -> dict[str, str]:
    with CATEGORIES_PATH.open(encoding="utf-8") as handle:
        data = json.load(handle)
    known = dict(CATEGORY_CHOICES)
    return {str(name).strip().casefold(): category for name, category in data.items() if category in known}


def book_category(name: str, special_type: str = "", upgrade_group: str = "") -> str:
    """The category the book's classification gives a special, by the first rule that holds: typed "Injury", an
    upgrade in a group bought as mutations (`MUTATION_GROUPS`), its name in data/special-categories.json (an aura
    line there keeps a mount's mental rule an aura), typed "Animal" (body), else aura."""
    special_type = special_type.strip()
    if special_type == INJURY_TYPE:
        return INJURY
    if (special_type, upgrade_group.strip()) in MUTATION_GROUPS:
        return MUTATION
    listed = _book_categories().get(name.strip().casefold())
    if listed:  # the review file before the Animal type: a mount's Stubborn or Bicker is still an aura (William, 5 Nov)
        return listed
    return BODY if special_type == ANIMAL_TYPE else AURA
