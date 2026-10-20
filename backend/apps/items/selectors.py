"""How items are read for their payload: the list, the detail and a write's answer (PERF-49)."""

from django.db.models import QuerySet

from apps.warbands.prefetches import item_detail_prefetches

from .models import Item


def item_rows(rows: QuerySet[Item] | None = None) -> QuerySet[Item]:
    """Items with what ItemSerializer reads: an animal's entry joined to the row, then one query each for the
    property links (with their properties), the availabilities, their restriction links (with their restrictions)
    and, when an item hires an animal, the animal's specials."""
    rows = Item.objects.all() if rows is None else rows
    return rows.select_related("bestiary_entry").prefetch_related(*item_detail_prefetches(), "bestiary_entry__specials")
