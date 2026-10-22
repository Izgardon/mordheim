"""The campaign's current entry for an id (CAT-TWEAK-03): found through `replaces`, never through the name.

A book id the campaign has a version of stands for the version; any other id the campaign may use (a book entry, one
of its own) stands for itself; another campaign's id, or an unknown one, for nothing. Archived and removed entries
still resolve: copies and full-list PATCHes resend them (decision 5). Unit writes, hire presets, purchases, stash
adds and moves, the catalogue's own links, and battle finds and item uses resolve their ids here, in the query they
ran anyway. An open battle holds ids for hours, so a version reverted since stands for its book entry's current
entry (`RevertedVersion`), at the cost of one more query only when an id isn't found.
"""

from collections.abc import Iterable
from typing import Any

from django.db.models import Q, QuerySet

from apps.core.models import CatalogueEntry, RevertedVersion


def with_versions[RowsT: QuerySet[Any]](rows: RowsT, ids: Iterable[Any], campaign_id: int) -> RowsT:
    """`rows` among `ids` the campaign may use, and the campaign's versions of any of them (one query)."""
    wanted = list(ids)
    in_scope = Q(id__in=wanted) & (Q(campaign__isnull=True) | Q(campaign_id=campaign_id))
    found: RowsT = rows.filter(in_scope | Q(campaign_id=campaign_id, replaces_id__in=wanted))
    return found


def current_rows(rows: QuerySet[Any], ids: Iterable[Any], campaign_id: int) -> dict[int, Any]:
    """Each of `ids` the campaign may use -> the campaign's current row for it (one query)."""
    wanted = set(ids)
    if not wanted:
        return {}
    found: dict[int, Any] = {}
    versions: dict[int, Any] = {}
    for row in with_versions(rows, wanted, campaign_id):
        if row.id in wanted:
            found[row.id] = row
        if row.replaces_id in wanted and row.campaign_id == campaign_id:
            versions[row.replaces_id] = row
    return {**found, **versions}


def resolve(rows: QuerySet[Any], kind: str, ids: Iterable[Any], campaign_id: int) -> dict[int, Any]:
    """`current_rows`, and each id of a version reverted since -> its book entry's current row (`kind`: the entry
    table's, e.g. "items"): one more query only when an id isn't found, and one more when one was reverted."""
    wanted = set(ids)
    found = current_rows(rows, wanted, campaign_id)
    missing = wanted - set(found)
    if missing:
        reverted = dict(
            RevertedVersion.objects.filter(campaign_id=campaign_id, kind=kind, version_id__in=missing).values_list(
                "version_id", "book_id"
            )
        )
        books = current_rows(rows, set(reverted.values()), campaign_id) if reverted else {}
        found.update({old: books[book] for old, book in reverted.items() if book in books})
    return found


def is_entry_table(model: Any) -> bool:
    """Whether `model` is a catalogue entry table (it carries versions)."""
    return isinstance(model, type) and issubclass(model, CatalogueEntry)
