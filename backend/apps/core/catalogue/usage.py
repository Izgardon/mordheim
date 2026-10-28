"""How much of a campaign holds a catalogue entry (BUG-16, BUG-130; CAT-TWEAK-04): `GET <kind>/:id/usage/`, and
what a delete answers when it archives or removes an entry instead.

Units' copies (items, skills, spells, specials), stash rows, the skills, specials, spells and equipment of bestiary
entries, hired swords and dramatis personae, and the races of units, hired swords and dramatis personae reference
the catalogue with RESTRICT: a delete never takes them with it. The kinds
registry names those tables (`holders`, kinds.py). Counted within one campaign: a book entry is held across
campaigns, a campaign's entry only in its own. What holds an entry's twin counts for the entry: a beast's usage is
its Animal item's.
"""

from collections import defaultdict
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .kinds import CatalogueKindSpec


def count_usage(kind: "CatalogueKindSpec", entry_id: Any, campaign_id: int) -> dict[str, int]:
    """Units holding the entry (any kind, dead and dismissed ones too, or of the race), the warbands they and the
    stashes belong to, stashes, and the campaign's bestiary entries, hired swords and dramatis personae linking it (or
    its twin). One query per holding table, and one for the twin."""
    units: dict[str, set[int]] = defaultdict(set)
    warbands: set[int] = set()
    found: dict[str, set[int]] = defaultdict(set)
    held = [(holder, entry_id) for holder in kind.holders]
    if kind.twin is not None and (twin := kind.twin.of(entry_id)) is not None:
        held += [(holder, twin.pk) for holder in kind.twin.kind.holders]
    for holder, held_id in held:
        rows = holder.model._default_manager.filter(**{f"{holder.field}_id": held_id, holder.campaign: campaign_id})
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
        "hired_swords": len(found["hired_swords"]),
        "dramatis_personae": len(found["dramatis_personae"]),
    }
