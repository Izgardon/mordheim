"""Today's name rule for the catalogue lists, written once (it was written eight times, CAT-CQ-01).

With a campaign, a list is the campaign's rows, then the book rows whose name none of those rows uses, whatever
their type (BUG-18: PR C replaces the rule with versions that reference the book entry they replace). The filters a
list takes (type, search) are applied to `rows` first, so the rule works within them. Without a campaign, a list is
the book alone. Either way it is one queryset, read with one prefetch chain (PERF-49).
"""

from typing import Any

from django.db.models import F, Q, QuerySet


def campaign_rows[RowsT: QuerySet[Any]](rows: RowsT, campaign_id: int, name_field: str = "name") -> RowsT:
    """The campaign's rows and the book rows it doesn't override by `name_field` (a restriction's text, a hired
    sword's entry name)."""
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
