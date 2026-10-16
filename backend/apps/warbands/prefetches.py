"""Prefetch paths for unit detail payloads, shared by every view that serializes units.

The detail serializers render each item with its properties and its availabilities
(cost, rarity, restriction links). Prefetching all of it keeps the query count
constant however many units and items a warband has.
"""


def _unit_item_prefetches(items_relation: str) -> tuple[str, ...]:
    return (
        f"{items_relation}__item__property_links__property",
        f"{items_relation}__item__availabilities__restriction_links__restriction",
    )


HERO_DETAIL_PREFETCH = (
    *_unit_item_prefetches("hero_items"),
    "hero_skills__skill",
    "hero_specials__special",
    "hero_spells__spell",
)

HIRED_SWORD_DETAIL_PREFETCH = (
    *_unit_item_prefetches("hired_sword_items"),
    "hired_sword_skills__skill",
    "hired_sword_specials__special",
    "hired_sword_spells__spell",
)

HENCHMEN_GROUP_DETAIL_PREFETCH = (
    *_unit_item_prefetches("henchmen_group_items"),
    "henchmen_group_skills__skill",
    "henchmen_group_specials__special",
)
