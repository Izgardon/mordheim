"""How much of a campaign holds a catalogue entry (BUG-16, BUG-130; CAT-TWEAK-04): `GET <kind>/:id/usage/`, and
what a delete answers when it archives or removes an entry instead.

Units' copies (items, skills, spells, specials), stash rows, bestiary entries' skills, specials, spells and
equipment, and units' races reference the catalogue with RESTRICT: a delete never takes them with it. The kinds
registry names those tables (`holders`, kinds.py). Counted within one campaign: a book entry is held across
campaigns, a campaign's entry only in its own.
"""

from collections import defaultdict
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .kinds import CatalogueKindSpec


def count_usage(kind: "CatalogueKindSpec", entry_id: Any, campaign_id: int) -> dict[str, int]:
    """Units holding the entry (any kind, dead and dismissed ones too, or of the race), the warbands they and the
    stashes belong to, stashes, and the campaign's bestiary entries linking it. One query per holding table."""
    units: dict[str, set[int]] = defaultdict(set)
    warbands: set[int] = set()
    found: dict[str, set[int]] = defaultdict(set)
    for holder in kind.holders:
        rows = holder.model._default_manager.filter(**{f"{holder.field}_id": entry_id, holder.campaign: campaign_id})
        columns = [holder.holder_id] if holder.warband is None else [holder.holder_id, holder.warband]
        for row in rows.values_list(*columns).distinct():
            if holder.warband is not None:
                warbands.add(row[1])
            if holder.unit_kind is not None:
                units[holder.unit_kind].add(row[0])
            else:
                found[holder.counts_as].add(row[0])
    return {
        "units": sum(len(ids) for ids in units.values()),
        "warbands": len(warbands),
        "stashes": len(found["stashes"]),
        "bestiary_entries": len(found["bestiary_entries"]),
    }
