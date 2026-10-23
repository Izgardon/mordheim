"""How bestiary entries are read for their payloads (PERF-46, CAT-PERF-04, CAT-TEST-08), and the list's kind filter.

A detail costs a fixed number of queries whatever the equipment: the beast's own item joined to it with its prices
(two queries), the skills, specials and spells in one query each, the equipment links with their items, then the
items' properties, availabilities (with their restrictions) and, for an animal's item, its entry's specials. The GETs
and the POST and PATCH answers read through here. A list row adds its item and prices: two queries for any number of
rows.
"""

from django.db.models import Prefetch, Q, QuerySet

from apps.core.catalogue.payloads import badge_joins
from apps.core.errors import ApiError
from apps.warbands.prefetches import availabilities_prefetch, item_detail_prefetches

from .models import BEAST_KINDS, BestiaryEntry, BestiaryEntryItem

KIND_VALUES = tuple(value for value, _ in BEAST_KINDS)


def by_kind(value: str) -> Q:
    """`?kind=mount` or `?kind=mount,pet` (any case): the entries of those kinds; an unknown kind is a 400."""
    wanted = [part.strip().lower() for part in value.split(",") if part.strip()]
    unknown = [part for part in wanted if part not in KIND_VALUES]
    if unknown:
        message = f'"{unknown[0]}" is not a kind: use {", ".join(KIND_VALUES)}.'
        raise ApiError(message, code="invalid", fields={"kind": [message]})
    return Q(kind__in=wanted) if wanted else Q()


def with_items(rows: QuerySet[BestiaryEntry]) -> QuerySet[BestiaryEntry]:
    """`rows` with each beast's Animal item joined and its prices prefetched (two queries, none without items)."""
    return rows.select_related("animal_item").prefetch_related(availabilities_prefetch("animal_item__"))


def entry_details() -> QuerySet[BestiaryEntry]:
    """Bestiary entries read for the detail payload: 10 queries, 11 when an equipment item is an animal's."""
    equipment = (
        BestiaryEntryItem.objects.select_related("item__bestiary_entry")
        .prefetch_related(*item_detail_prefetches("item__"), "item__bestiary_entry__specials")
        .order_by("id")
    )
    rows = BestiaryEntry.objects.select_related(*badge_joins()).prefetch_related(
        "skills", "specials", "spells", Prefetch("bestiary_entry_items", queryset=equipment)
    )
    return with_items(rows)
