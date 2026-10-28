"""How items are read for their payload: the list, the detail and a write's answer (PERF-49, CAT-NEW-03)."""

from django.db.models import Q, QuerySet

from apps.core.errors import ApiError
from apps.warbands.prefetches import item_detail_prefetches
from apps.warbands.services.prices import own_price_of

from .models import Item


def by_listing(value: str) -> Q:
    """`?listed=1` (or `true`): the items the shop sells; `0` (or `false`): the ones it doesn't; anything else is a 400."""
    choice = {"1": True, "true": True, "0": False, "false": False}.get(value.lower())
    if choice is None:
        message = f'"{value}" is not a listing: use 1 (sold in the shop) or 0.'
        raise ApiError(message, code="invalid", fields={"listed": [message]})
    return Q(listed=choice)


def item_rows(rows: QuerySet[Item] | None = None) -> QuerySet[Item]:
    """Items with what the catalogue's item payload reads: an animal's entry, the book item a version replaces and the
    last writer joined to the row, the book item's price annotated on it (the badge's "Book: 5 gc"), then one query
    each for the property links (with their properties), the availabilities, their restriction links (with their
    restrictions) and, when an item hires an animal, the animal's specials."""
    rows = Item.objects.all() if rows is None else rows
    rows = rows.select_related("bestiary_entry", "replaces", "updated_by").annotate(
        book_price=own_price_of("replaces_id")
    )
    return rows.prefetch_related(*item_detail_prefetches(), "bestiary_entry__specials")
