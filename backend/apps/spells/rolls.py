"""A lore's D6 table has one spell on each roll (William, 2 Nov 2026: "this spell list has 2 spells set to a roll of
6, can we never allow that"). A second spell on a roll its lore already holds has no roll ("–"): it can still be
picked from the table, and a die never lands on it.

A lore is a spell's type, compared without case or outer spaces. The book's seeders keep the first spell on each roll
(`first_on_each_roll`, `book_roll_taken`). A campaign sees the book's spells it hasn't replaced or removed and its own
that aren't archived (catalogue/merge.py); a custom spell or a version whose roll another spell of its lore holds there
is saved with no roll and a warning (`campaign_roll_taken`, the catalogue's SpellHooks): a guide, not a gatekeeper.
"""

from collections.abc import Iterable
from typing import Any

from django.db.models import Exists, OuterRef, Q

from apps.core.models import CatalogueRemoval

from .models import Spell


def _lore(value: Any) -> str:
    return str(value or "").strip().casefold()


def first_on_each_roll(entries: Iterable[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    """The book file's entries in order, a later one on a roll its lore already holds with `roll` None, and a line
    for each of those."""
    taken: set[tuple[str, Any]] = set()
    kept, cleared = [], []
    for entry in entries:
        roll = entry.get("roll")
        key = (_lore(entry.get("type")), roll)
        if roll is not None and key in taken:
            cleared.append(f"  {entry.get('name')} ({entry.get('type')}): roll {roll} is taken, saved with none")
            entry = {**entry, "roll": None}
        elif roll is not None:
            taken.add(key)
        kept.append(entry)
    return kept, cleared


def book_roll_taken(lore: str, roll: int | None) -> Spell | None:
    """The book's spell of the lore on `roll`, if any."""
    if roll is None:
        return None
    return Spell.objects.filter(campaign__isnull=True, type__iexact=lore.strip(), roll=roll).order_by("id").first()


def campaign_roll_taken(campaign_id: int, lore: str, roll: int | None, editing: Spell | None = None) -> Spell | None:
    """The spell of the lore on `roll` the campaign sees, other than `editing` (the entry being written), if any."""
    if roll is None:
        return None
    ref = OuterRef("pk")
    versioned = Spell.objects.filter(campaign_id=campaign_id, replaces_id=ref)
    removed = CatalogueRemoval.objects.filter(campaign_id=campaign_id, kind="spells", entry_id=ref)
    own = Q(campaign_id=campaign_id, archived_at__isnull=True)
    book = Q(campaign__isnull=True) & ~Exists(versioned) & ~Exists(removed)
    rows = Spell.objects.filter(own | book, type__iexact=lore.strip(), roll=roll)
    if editing is not None:
        rows = rows.exclude(pk__in=[editing.pk, editing.replaces_id or editing.pk])
    return rows.order_by("id").first()


def taken_warning(spell: Spell, roll: int) -> str:
    return f"{spell.name} already has the roll of {roll} in {spell.type}: saved with no roll"
