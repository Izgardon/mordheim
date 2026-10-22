"""How bestiary entries are read for their detail payloads (PERF-46, CAT-PERF-04, CAT-TEST-08).

A fixed number of queries whatever the equipment: the skills, specials and spells in one query each, the equipment
links with their items, then the items' properties, availabilities (with their restrictions) and, for an animal's
item, its entry's specials. The GETs and the POST and PATCH answers read through here.
"""

from django.db.models import Prefetch, QuerySet

from apps.core.catalogue.payloads import badge_joins
from apps.warbands.prefetches import item_detail_prefetches

from .models import BestiaryEntry, BestiaryEntryItem


def entry_details() -> QuerySet[BestiaryEntry]:
    """Bestiary entries read for the detail payload: 8 queries, 9 when an item is an animal's."""
    equipment = (
        BestiaryEntryItem.objects.select_related("item__bestiary_entry")
        .prefetch_related(*item_detail_prefetches("item__"), "item__bestiary_entry__specials")
        .order_by("id")
    )
    return BestiaryEntry.objects.select_related(*badge_joins()).prefetch_related(
        "skills", "specials", "spells", Prefetch("bestiary_entry_items", queryset=equipment)
    )
