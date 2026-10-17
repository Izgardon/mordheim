"""Prefetches for unit payloads, shared by every view that serializes units.

The detail serializers render each item with its properties and its availabilities
(cost, rarity, restriction links). Prefetching all of it keeps the query count
constant however many units and items a warband has. Each join table is read with its
target in one query (`select_related`), in id order, which is the order the player set
(ROST-PERF-11).
"""

from django.db.models import Model, Prefetch

from apps.items.models import ItemAvailability, ItemAvailabilityRestriction, ItemPropertyLink
from apps.warbands.models import (
    Henchman,
    HenchmenGroupItem,
    HenchmenGroupSkill,
    HenchmenGroupSpecial,
    HeroItem,
    HeroSkill,
    HeroSpecial,
    HeroSpell,
    HiredSwordItem,
    HiredSwordSkill,
    HiredSwordSpecial,
    HiredSwordSpell,
)


def _links(relation: str, join_model: type[Model], target: str) -> Prefetch:
    """A unit's join rows with their catalogue entry: one query instead of two."""
    return Prefetch(relation, queryset=join_model._default_manager.select_related(target).order_by("id"))


def item_detail_prefetches(prefix: str = "") -> tuple[Prefetch, ...]:
    """An item's properties and availabilities (with their restrictions), for the detail payload.

    `prefix` reaches the items from a unit, e.g. "hero_items__item__"; without it, prefetch onto items.
    """
    restrictions = ItemAvailabilityRestriction.objects.select_related("restriction").order_by("id")
    return (
        Prefetch(
            f"{prefix}property_links",
            queryset=ItemPropertyLink.objects.select_related("property").order_by("id"),
        ),
        Prefetch(
            f"{prefix}availabilities",
            queryset=ItemAvailability.objects.prefetch_related(Prefetch("restriction_links", queryset=restrictions)),
        ),
    )


HERO_SUMMARY_PREFETCH = (
    _links("hero_items", HeroItem, "item"),
    _links("hero_skills", HeroSkill, "skill"),
    _links("hero_specials", HeroSpecial, "special"),
    _links("hero_spells", HeroSpell, "spell"),
)

HIRED_SWORD_SUMMARY_PREFETCH = (
    _links("hired_sword_items", HiredSwordItem, "item"),
    _links("hired_sword_skills", HiredSwordSkill, "skill"),
    _links("hired_sword_specials", HiredSwordSpecial, "special"),
    _links("hired_sword_spells", HiredSwordSpell, "spell"),
)

HENCHMEN_GROUP_SUMMARY_PREFETCH = (
    _links("henchmen_group_items", HenchmenGroupItem, "item"),
    _links("henchmen_group_skills", HenchmenGroupSkill, "skill"),
    _links("henchmen_group_specials", HenchmenGroupSpecial, "special"),
)

HERO_DETAIL_PREFETCH = (*HERO_SUMMARY_PREFETCH, *item_detail_prefetches("hero_items__item__"))

HIRED_SWORD_DETAIL_PREFETCH = (*HIRED_SWORD_SUMMARY_PREFETCH, *item_detail_prefetches("hired_sword_items__item__"))

HENCHMEN_GROUP_DETAIL_PREFETCH = (
    *HENCHMEN_GROUP_SUMMARY_PREFETCH,
    *item_detail_prefetches("henchmen_group_items__item__"),
)


def alive_henchmen_prefetch() -> Prefetch:
    """A group's living members, in id order: what every roster payload lists (dead members are records)."""
    return Prefetch("henchmen", queryset=Henchman.objects.filter(dead=False).order_by("id"))
