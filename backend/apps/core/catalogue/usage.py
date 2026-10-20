"""How much holds a catalogue entry a delete was refused for (BUG-16 safety net, BUG-130; PR C turns the refusal
into archiving).

Units' copies (items, skills, spells, specials), stash rows, bestiary entries' skills, specials, spells and
equipment, and units' races reference the catalogue with RESTRICT: a delete never takes them with it. The kinds
registry names those tables (`holders`, kinds.py). Deleting a whole campaign still cascades, since its warbands,
units and entries go in the same delete.
"""

from collections import defaultdict
from collections.abc import Iterable

from django.db import models

from apps.warbands.units.kinds import KINDS, UnitKindKey

from .kinds import HOLDERS


def usage_of(holders: Iterable[models.Model]) -> dict[str, int]:
    """How much holds an entry, from the rows a refused delete names: units (any kind, dead and dismissed ones too),
    the warbands they and the stashes belong to, stashes, and bestiary entries. One query per unit kind involved."""
    unit_ids: dict[UnitKindKey, set[int]] = defaultdict(set)
    found: dict[str, set[int]] = defaultdict(set)
    for row in holders:
        holder = HOLDERS[type(row)]  # a table holding the entry that the registry doesn't name fails loudly
        held_by = getattr(row, holder.holder_id)
        if holder.unit_kind is not None:
            unit_ids[holder.unit_kind].add(held_by)
        else:
            found[holder.counts_as].add(held_by)
    warbands = set(found["stashes"])
    for key, ids in unit_ids.items():
        warbands.update(KINDS[key].objects.filter(id__in=ids).values_list("warband_id", flat=True))
    units = sum(len(ids) for ids in unit_ids.values())
    return {
        "units": units,
        "warbands": len(warbands),
        "stashes": len(found["stashes"]),
        "bestiary_entries": len(found["bestiary_entries"]),
    }
