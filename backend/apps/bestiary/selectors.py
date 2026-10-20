"""How bestiary entries and hired swords are read for their detail payloads (PERF-46, CAT-PERF-04, CAT-TEST-08).

A fixed number of queries whatever the equipment: the skills, specials and spells in one query each, the equipment
links with their items, then the items' properties, availabilities (with their restrictions) and, for an animal's
item, its entry's specials. The GETs and the POST and PATCH answers read through here.
"""

from django.db.models import Prefetch, QuerySet

from apps.warbands.prefetches import item_detail_prefetches

from .models import BestiaryEntry, BestiaryEntryItem, HiredSwordProfile, HiredSwordProfileRestriction


def _entry_prefetches(prefix: str = "") -> tuple[str | Prefetch, ...]:
    """What BestiaryEntrySerializer reads; `prefix` reaches the entry from another row (a hired sword's profile)."""
    equipment = (
        BestiaryEntryItem.objects.select_related("item__bestiary_entry")
        .prefetch_related(*item_detail_prefetches("item__"), "item__bestiary_entry__specials")
        .order_by("id")
    )
    return (
        f"{prefix}skills",
        f"{prefix}specials",
        f"{prefix}spells",
        Prefetch(f"{prefix}bestiary_entry_items", queryset=equipment),
    )


def entry_details() -> QuerySet[BestiaryEntry]:
    """Bestiary entries read for the detail payload: 8 queries, 9 when an item is an animal's."""
    return BestiaryEntry.objects.prefetch_related(*_entry_prefetches())


def hired_sword_details() -> QuerySet[HiredSwordProfile]:
    """Hired-sword profiles read for the detail payload: their entry's as above, plus the profile's restrictions."""
    restrictions = HiredSwordProfileRestriction.objects.select_related("restriction").order_by("id")
    return HiredSwordProfile.objects.select_related("bestiary_entry").prefetch_related(
        *_entry_prefetches("bestiary_entry__"), Prefetch("restriction_links", queryset=restrictions)
    )
