"""How unit payloads are read: a fixed number of queries however many units and items a warband has.

A unit's skills, specials and spells come with the unit's own row, each list as an ordered JSON array
(`loadout_entries`); its items are prefetched, and for the detail payload their properties and
availabilities too (cost, rarity, restriction links). Join rows are always in id order, which is the
order the player set (ROST-PERF-11).
"""

from typing import Any

from django.contrib.postgres.expressions import ArraySubquery
from django.db.models import Model, OuterRef, Prefetch
from django.db.models.functions import JSONObject

from apps.items.models import ItemAvailability, ItemAvailabilityRestriction, ItemPropertyLink
from apps.warbands.models import Henchman, on_roster
from apps.warbands.services.prices import house_rule_prices
from apps.warbands.units.catalogue import SkillDetailSerializer, SpecialDetailSerializer, SpellDetailSerializer
from apps.warbands.units.companions import with_beasts

# The catalogue columns a unit payload shows for each kind of entry: the detail serializers' fields, which
# include the summary ones.
ENTRY_COLUMNS: dict[str, tuple[str, ...]] = {
    "skill": tuple(SkillDetailSerializer.Meta.fields),
    "special": tuple(SpecialDetailSerializer.Meta.fields),
    "spell": tuple(SpellDetailSerializer.Meta.fields),
}


def links_prefetch(relation: str, join_model: type[Model], target: str) -> Prefetch:
    """A unit's join rows with their catalogue entry: one query instead of two."""
    return Prefetch(relation, queryset=join_model._default_manager.select_related(target).order_by("id"))


def item_links_prefetch(relation: str, join_model: type[Model], parent_field: str) -> Prefetch:
    """A unit's copies with their items and each Animal item's beast and its entries (its mount or pet:
    units/companions.py), and the campaign's house rule for each item read in the same query (the sale price,
    decision 3)."""
    rows = with_beasts(join_model._default_manager.all())
    rows = rows.annotate(**house_rule_prices(f"{parent_field}__warband__campaign_id", "item_id"))
    return Prefetch(relation, queryset=rows.order_by("id"))


def entries_attr(relation: str) -> str:
    """The attribute holding a unit's entries read by `entries_array`, e.g. "hero_skills_entries"."""
    return f"{relation}_entries"


def entries_array(join_model: type[Model], parent_field: str, target: str) -> Any:
    """A unit's skills (or specials, spells) as one ordered array of JSON objects, read with the unit's row."""
    rows = join_model._default_manager.filter(**{parent_field: OuterRef("pk")}).order_by("id")
    columns = {column: f"{target}__{column}" for column in ENTRY_COLUMNS[target]}
    return ArraySubquery(rows.values(entry=JSONObject(**columns)))


def item_detail_prefetches(prefix: str = "") -> tuple[Prefetch, ...]:
    """An item's properties and availabilities (with their restrictions), for the detail payload.

    `prefix` reaches the items from a unit, e.g. "hero_items__item__"; without it, prefetch onto items.
    """
    return (
        Prefetch(
            f"{prefix}property_links",
            queryset=ItemPropertyLink.objects.select_related("property").order_by("id"),
        ),
        availabilities_prefetch(prefix),
    )


def availabilities_prefetch(prefix: str = "") -> Prefetch:
    """An item's availabilities with their restrictions (two queries), e.g. a beast's item's ("animal_item__")."""
    restrictions = ItemAvailabilityRestriction.objects.select_related("restriction").order_by("id")
    return Prefetch(
        f"{prefix}availabilities",
        queryset=ItemAvailability.objects.prefetch_related(Prefetch("restriction_links", queryset=restrictions)),
    )


def alive_henchmen_prefetch() -> Prefetch:
    """A group's living members, in id order: what every roster payload lists (dead and dismissed ones are records)."""
    return Prefetch("henchmen", queryset=on_roster(Henchman.objects.all()).order_by("id"))
