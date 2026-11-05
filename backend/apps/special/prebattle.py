"""Pre-battle rolls (William, 5 Nov 2026: "we just need to know if one of those 3 things has a prebattle roll and what
the roll does ... and the user can decide"): the book's specials, skills and shared item rules that make their owner
roll before each battle, with the dice and the rule's words on what the roll does (core/models.py: PrebattleRoll).

They are listed by kind and name in `data/prebattle-rolls.json` so William can review them in one place. Every
seeder of a book special, skill or item rule ends with `mark_book_rolls`, which sets each book row of its kind from
the list (a name it doesn't list has none), so `seed_all` on an empty database fills them. A campaign's rows, its
versions of book entries included, are never touched: a house version adds, changes or clears its own.
"""

import json
from functools import cache
from pathlib import Path
from typing import Any

from django.core.management.base import CommandError
from django.db.models import Model

from apps.core.models import PREBATTLE_DICE

SPECIAL, SKILL, ITEM_RULE = "special", "skill", "item_rule"
KINDS = (SPECIAL, SKILL, ITEM_RULE)
FIELDS = ("prebattle_roll", "prebattle_text")
ROLLS_PATH = Path(__file__).resolve().parent / "data" / "prebattle-rolls.json"


def _key(name: str) -> str:
    return " ".join(name.split()).casefold()


@cache
def book_rolls() -> dict[str, dict[str, tuple[str, str]]]:
    """Each kind's marks by name (case and spacing ignored): its dice and text. A kind the file lacks has none; dice
    the shared dice entry can't read, or a mark without its text, stop the seeder."""
    with ROLLS_PATH.open(encoding="utf-8") as handle:
        data: dict[str, Any] = json.load(handle)
    rolls: dict[str, dict[str, tuple[str, str]]] = {}
    for kind in KINDS:
        rolls[kind] = {}
        for name, mark in data.get(kind, {}).items():
            roll, text = str(mark.get("roll", "")).strip(), str(mark.get("text", "")).strip()
            if roll not in PREBATTLE_DICE or not text:
                raise CommandError(
                    f"{ROLLS_PATH.name}: {kind} '{name}' needs dice ({', '.join(PREBATTLE_DICE)}) and text"
                )
            rolls[kind][_key(name)] = (roll, text)
    return rolls


def mark_book_rolls(model: type[Model], kind: str) -> int:
    """Set every book row of `model` (the kind's table) to its pre-battle roll and text from the list, blank for a
    name it doesn't list, in one write; returns how many changed. Campaign rows keep their own."""
    marks = book_rolls()[kind]
    rows: list[Any] = list(model._default_manager.filter(campaign__isnull=True).only("pk", "name", *FIELDS))
    changed = []
    for row in rows:
        roll, text = marks.get(_key(row.name), ("", ""))
        if (row.prebattle_roll, row.prebattle_text) != (roll, text):
            row.prebattle_roll, row.prebattle_text = roll, text
            changed.append(row)
    model._default_manager.bulk_update(changed, FIELDS)
    return len(changed)
