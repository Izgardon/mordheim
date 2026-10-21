"""Which rows a catalogue list shows (CAT-TWEAK-03, BUG-18): a campaign's own entries, and the book's that it hasn't
replaced or removed.

With a campaign, a list is the campaign's rows, then the book rows it has no version of (`~Exists` of a campaign row
whose `replaces` is the book row) and hasn't removed (CAT-NEW-05's record). A campaign entry of a book entry's name
replaces nothing: only a version does, whatever its name or type. The filters a list takes (type, search) are
applied to `rows` first. Without a campaign, a list is the book alone. Either way it is one queryset, read with one
prefetch chain (PERF-49). Restrictions, which have no versions, keep the old rule: the campaign's rows, then the book
rows whose text none of them uses.
"""

from typing import TYPE_CHECKING, Any

from django.db.models import Exists, F, OuterRef, Q, QuerySet

from apps.core.models import CatalogueRemoval

if TYPE_CHECKING:
    from .kinds import CatalogueKindSpec


def campaign_list[RowsT: QuerySet[Any]](kind: "CatalogueKindSpec", rows: RowsT, campaign_id: int) -> RowsT:
    """The campaign's rows and the book rows it has neither a version of nor removed."""
    ref = OuterRef(kind.entry_ref())
    versioned = kind.entry_model._default_manager.filter(campaign_id=campaign_id, replaces_id=ref)
    removed = CatalogueRemoval.objects.filter(campaign_id=campaign_id, kind=kind.entry_key, entry_id=ref)
    book = Q(campaign__isnull=True) & ~Exists(versioned) & ~Exists(removed)
    shown: RowsT = rows.filter(Q(campaign_id=campaign_id) | book)
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
