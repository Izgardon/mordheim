"""Prefetches for unit payloads, shared by every view that serializes units.

The detail serializers render each item with its properties and its availabilities
(cost, rarity, restriction links). Prefetching all of it keeps the query count
constant however many units and items a warband has. Each join table is read with its
target in one query (`select_related`), in id order, which is the order the player set
(ROST-PERF-11).
"""

from django.db.models import Model, Prefetch, QuerySet

from apps.items.models import ItemAvailability, ItemAvailabilityRestriction, ItemPropertyLink
from apps.warbands.models import (
    Henchman,
    HenchmenGroup,
    HenchmenGroupItem,
    HenchmenGroupSkill,
    HenchmenGroupSpecial,
    Hero,
    HeroItem,
    HeroSkill,
    HeroSpecial,
    HeroSpell,
    HiredSword,
    HiredSwordItem,
    HiredSwordSkill,
    HiredSwordSpecial,
    HiredSwordSpell,
)


def _links(relation: str, join_model: type[Model], target: str) -> Prefetch:
    """A unit's join rows with their catalogue entry: one query instead of two."""
    return Prefetch(relation, queryset=join_model._default_manager.select_related(target).order_by("id"))


def _item_details(items_relation: str) -> tuple[Prefetch, ...]:
    """Each linked item's properties and availabilities (with their restrictions), for the detail payload."""
    restrictions = ItemAvailabilityRestriction.objects.select_related("restriction").order_by("id")
    return (
        Prefetch(
            f"{items_relation}__item__property_links",
            queryset=ItemPropertyLink.objects.select_related("property").order_by("id"),
        ),
        Prefetch(
            f"{items_relation}__item__availabilities",
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

HERO_DETAIL_PREFETCH = (*HERO_SUMMARY_PREFETCH, *_item_details("hero_items"))

HIRED_SWORD_DETAIL_PREFETCH = (*HIRED_SWORD_SUMMARY_PREFETCH, *_item_details("hired_sword_items"))

HENCHMEN_GROUP_DETAIL_PREFETCH = (*HENCHMEN_GROUP_SUMMARY_PREFETCH, *_item_details("henchmen_group_items"))


def alive_henchmen_prefetch() -> Prefetch:
    """A group's living members, in id order: what every roster payload lists (dead members are records)."""
    return Prefetch("henchmen", queryset=Henchman.objects.filter(dead=False).order_by("id"))


def hero_detail_queryset() -> QuerySet[Hero]:
    return Hero.objects.select_related("race").prefetch_related(*HERO_DETAIL_PREFETCH)


def henchmen_group_detail_queryset() -> QuerySet[HenchmenGroup]:
    return HenchmenGroup.objects.select_related("race").prefetch_related(
        *HENCHMEN_GROUP_DETAIL_PREFETCH, alive_henchmen_prefetch()
    )


def hired_sword_detail_queryset() -> QuerySet[HiredSword]:
    return HiredSword.objects.select_related("race").prefetch_related(*HIRED_SWORD_DETAIL_PREFETCH)
