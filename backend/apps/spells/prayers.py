"""A lore is a prayer list or a spell list (William, 26 Nov 2026): the book's prayer lists are named in
`data/prayer-lores.json` (the priests' prayers, a Priest of Morr's Funerary Rites, the Prophetic Rants, the Blessings
of the Mare and Mutiny in Marienburg's Miracle Workers); every other lore is spells, Rituals of Hashut and the Lore of
Light among them.

Each spell carries its lore's answer (`Spell.is_prayer`): the book's are marked by the seeders (`mark_book_prayers`,
and a hired sword's own spell when it is made), and a campaign's own spell takes its lore's unless its write says
(`campaign_lore_is_prayer`); a version keeps the book's.
"""

import json
from functools import cache
from pathlib import Path

from django.db.models import Q

from .models import Spell

PRAYER_LORES_PATH = Path(__file__).resolve().parent / "data" / "prayer-lores.json"


def _key(lore: str) -> str:
    return lore.strip().casefold()


@cache
def prayer_lores() -> frozenset[str]:
    """The book's prayer lists, compared without case or outer spaces."""
    names: list[str] = json.loads(PRAYER_LORES_PATH.read_text(encoding="utf-8"))
    return frozenset(_key(name) for name in names)


def is_prayer_lore(lore: str) -> bool:
    """Whether the book's lore of the name is a prayer list."""
    return _key(lore or "") in prayer_lores()


def mark_book_prayers() -> int:
    """Every book spell marked as its lore is: a prayer in a prayer list, else a spell (two queries, and one to read
    the lores); how many changed."""
    book = Spell.objects.filter(campaign__isnull=True)
    lores = set(book.values_list("type", flat=True).distinct())
    prayers = [lore for lore in lores if is_prayer_lore(lore)]
    changed = book.filter(type__in=prayers, is_prayer=False).update(is_prayer=True)
    return changed + book.exclude(type__in=prayers).filter(is_prayer=True).update(is_prayer=False)


def campaign_lore_is_prayer(campaign_id: int, lore: str, editing: Spell | None = None) -> bool:
    """A campaign's own spell's answer when its write doesn't say: a book prayer list, or a lore whose other spells
    in the book or the campaign are prayers."""
    if is_prayer_lore(lore):
        return True
    rows = Spell.objects.filter(
        Q(campaign__isnull=True) | Q(campaign_id=campaign_id), type__iexact=(lore or "").strip()
    )
    if editing is not None:
        rows = rows.exclude(pk=editing.pk)
    return rows.filter(is_prayer=True).exists()
