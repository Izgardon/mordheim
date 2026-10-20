"""Deleting a catalogue entry that something holds (BUG-16 safety net, BUG-130; PR C turns this into archiving).

Units' copies (items, skills, spells, specials), stash rows, bestiary entries' skills, specials, spells and
equipment, and units' races reference the catalogue with RESTRICT: a delete never takes them with it. Deleting a
whole campaign still cascades, since its warbands, units and entries go in the same delete.
"""

from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from django.db import models, transaction

from apps.core.errors import ApiError
from apps.warbands.models import RosterUnit, WarbandItem
from apps.warbands.units.kinds import KIND_BY_MODEL, KINDS, UnitKindKey

LINK_KINDS = {link.model: kind for kind in KINDS.values() for link in kind.links()}  # e.g. HeroItem -> HERO


def usage_of(holders: Iterable[models.Model]) -> dict[str, int]:
    """How much holds an entry, from the rows a refused delete names: units (any kind, dead and dismissed ones too),
    the warbands they and the stashes belong to, stashes, and bestiary entries. One query per unit kind involved."""
    unit_ids: dict[UnitKindKey, set[int]] = defaultdict(set)
    stashes: set[int] = set()
    entries: set[int] = set()
    for row in holders:
        row_any: Any = row
        if isinstance(row, RosterUnit):  # a unit of the race
            unit_ids[KIND_BY_MODEL[type(row)].key].add(row.pk)
        elif type(row) in LINK_KINDS:  # a unit's copy
            kind = LINK_KINDS[type(row)]
            unit_ids[kind.key].add(getattr(row, f"{kind.parent_field}_id"))
        elif isinstance(row, WarbandItem):
            stashes.add(row.warband_id)
        else:  # a bestiary entry's skill, special, spell or equipment link
            entries.add(row_any.bestiary_entry_id)
    warbands = set(stashes)
    for key, ids in unit_ids.items():
        warbands.update(KINDS[key].objects.filter(id__in=ids).values_list("warband_id", flat=True))
    units = sum(len(ids) for ids in unit_ids.values())
    return {"units": units, "warbands": len(warbands), "stashes": len(stashes), "bestiary_entries": len(entries)}


def delete_unless_in_use(entry: models.Model, noun: str) -> None:
    """Delete the entry; when anything holds it, nothing is deleted and the caller gets 409 `in_use` with the counts
    (`usage`), so the page can say what uses it."""
    try:
        with transaction.atomic():
            entry.delete()
    except models.RestrictedError as error:
        detail = f"This {noun} is in use, so nothing was deleted."
        raise ApiError(detail, code="in_use", status=409, usage=usage_of(error.restricted_objects)) from error
