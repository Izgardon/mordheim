"""Shared specials (William, 5 Nov 2026): one general special for a rule many owners hold under names of their own,
Fear, Stupidity, Immune to Psychology and Immune to Poison, and one for each mutation the Cult of the Possessed and the
Blessings of Nurgle sell. William's list is `data/shared-specials.json`: each special's type, wording and the names
that mean it, and the rules kept apart because their text changes what the rule does ("Stupidity (Rat Ogre)").

The catalogue import builds `out/shared-specials.json` from it (catalogue_import/shared_specials.py), with the
template fighters' rules and upgrades already linked; seed_spells_and_special seeds each special and archives the
copies of it seeded before, and the hireling and bestiary seeders' book lookups link an owner's rule of a shared name
or alias to it, or keep his own (core/book_lookups.py).
"""

import json
import re
from pathlib import Path
from typing import Any

from django.conf import settings

SHARED_OUT = Path(settings.BASE_DIR) / "catalogue_import" / "out" / "shared-specials.json"

# The one Animal rule (William, 25 Nov 2026): the shared special, "Animals" its alias; an owner's own copy kept apart
# for what it adds is named for him, "Animal (Baneworm)", "Animals (Slavehound)".
_ANIMAL_RULE = re.compile(r"animals?(\s*\(.*\))?", re.IGNORECASE)


def is_animal_rule(name: str) -> bool:
    """Whether a rule of this name is the Animal rule: the shared one, its alias, or an owner's own copy of it."""
    return _ANIMAL_RULE.fullmatch(name.strip()) is not None


def read_shared(path: Path = SHARED_OUT) -> dict[str, list[dict[str, Any]]]:
    """`specials` (name, type, description, aliases), `apart` (owner, rule, name: the hired swords', dramatis
    personae's and beasts' rules kept their own) and `own_names` (owner, rule, name: a hired sword's or dramatis
    persona's own rule that others word otherwise, named for him: catalogue_import/own_rules.py)."""
    with path.open(encoding="utf-8") as handle:
        data: dict[str, list[dict[str, Any]]] = json.load(handle)
    return data
