"""Which rows a catalogue list shows (CAT-TWEAK-03, -04, BUG-18): a campaign's own entries, and the book's that
it hasn't replaced or removed; archived entries and removed ones only when asked (`?archived=1`).

With a campaign, a list is the campaign's rows, then the book rows it has no version of (`~Exists` of a campaign row
whose `replaces` is the book row) and hasn't removed (CAT-NEW-05's record). A campaign entry of a book entry's name
replaces nothing: only a version does, whatever its name or type. The filters a list takes (type, search) are
applied to `rows` first. Without a campaign, a list is the book alone. Either way it is one queryset, read with one
prefetch chain (PERF-49). Restrictions, which have no versions, keep the old rule: the campaign's rows, then the book
rows whose text none of them uses.
"""

from typing import TYPE_CHECKING, Any

from django.db.models import Exists, F, OuterRef, Q, QuerySet, Subquery

from apps.core.models import CatalogueRemoval

if TYPE_CHECKING:
    from .kinds import CatalogueKindSpec


def campaign_list[RowsT: QuerySet[Any]](
    kind: "CatalogueKindSpec", rows: RowsT, campaign_id: int, *, archived: bool = False
) -> RowsT:
    """The campaign's rows and the book rows it has no version of, without its archived rows and the book rows it
    removed; with them when `archived` (each row then says since when: `archived_at`, or `removed_at`)."""
    ref = OuterRef(kind.entry_ref())
    versioned = kind.entry_model._default_manager.filter(campaign_id=campaign_id, replaces_id=ref)
    removed = CatalogueRemoval.objects.filter(campaign_id=campaign_id, kind=kind.entry_key, entry_id=ref)
    own, book = Q(campaign_id=campaign_id), Q(campaign__isnull=True) & ~Exists(versioned)
    if archived:
        shown: RowsT = rows.filter(own | book).annotate(removed_at=Subquery(removed.values("removed_at")[:1]))
        return shown
    shown = rows.filter((own & Q(**{kind.entry_path("archived_at__isnull"): True})) | (book & ~Exists(removed)))
    return shown


def campaign_rows[RowsT: QuerySet[Any]](rows: RowsT, campaign_id: int, name_field: str = "name") -> RowsT:
    """The campaign's rows and the book rows it doesn't override by `name_field` (the restrictions' text)."""
    taken = rows.filter(campaign_id=campaign_id).values(name_field)
    overridden = Q(**{f"{name_field}__in": taken})
    merged: RowsT = rows.filter(Q(campaign_id=campaign_id) | (Q(campaign__isnull=True) & ~overridden))
    return merged


def book_rows[RowsT: QuerySet[Any]](rows: RowsT) -> RowsT:
    book: RowsT = rows.filter(campaign__isnull=True)
    return book


def campaign_first(*order: str) -> tuple[Any, ...]:
    """An ordering that lists the campaign's rows before the book's, each part by `order`."""
    return (F("campaign_id").asc(nulls_last=True), *order)
