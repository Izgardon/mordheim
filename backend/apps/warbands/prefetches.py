"""How unit payloads are read: a fixed number of queries however many units and items a warband has.

A unit's skills, specials and spells come with the unit's own row, each list as an ordered JSON array
(`loadout_entries`); its items are prefetched, and for the detail payload their rules and price rows
too (with who may buy each). Join rows are always in id order, which is the order the player set
(ROST-PERF-11).
"""

from typing import Any

from django.contrib.postgres.expressions import ArraySubquery
from django.db.models import Model, OuterRef, Prefetch
from django.db.models.functions import JSONObject

from apps.items.models import ItemAvailability, ItemAvailabilityWarband, ItemRuleLink
from apps.warbands.models import Henchman, HenchmanItemGap, on_roster
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


def entries_array(join_model: type[Model], parent_field: str, target: str, kept: tuple[str, ...] = ()) -> Any:
    """A unit's skills (or specials, spells) as one ordered array of JSON objects, read with the unit's row, with the
    join row's own `kept` fields (a spell's `dc_change`)."""
    rows = join_model._default_manager.filter(**{parent_field: OuterRef("pk")}).order_by("id")
    columns = {column: f"{target}__{column}" for column in ENTRY_COLUMNS[target]} | {name: name for name in kept}
    return ArraySubquery(rows.values(entry=JSONObject(**columns)))


def item_detail_prefetches(prefix: str = "") -> tuple[Prefetch, ...]:
    """An item's rules (with their shared rules) and price rows (with who may buy each), for the detail payload.

    `prefix` reaches the items from a unit, e.g. "hero_items__item__"; without it, prefetch onto items.
    """
    return (
        Prefetch(
            f"{prefix}rule_links", queryset=ItemRuleLink.objects.select_related("rule").order_by("position", "id")
        ),
        availabilities_prefetch(prefix),
    )


def availabilities_prefetch(prefix: str = "") -> Prefetch:
    """An item's price rows with their who-can lines and those lines' types and groups (two queries), e.g. a beast's
    item's ("animal_item__")."""
    lines = ItemAvailabilityWarband.objects.select_related("warband_type", "warband_group").order_by("id")
    return Prefetch(
        f"{prefix}availabilities",
        queryset=ItemAvailability.objects.order_by("id").prefetch_related(Prefetch("warband_links", queryset=lines)),
    )


def gap_entries() -> ArraySubquery:
    """A member's gaps (the loadout rows he lacks) read with his row, oldest first: services/loadouts.py."""
    gaps = HenchmanItemGap.objects.filter(henchman_id=OuterRef("pk")).order_by("id")
    entry = JSONObject(id="id", row_id="group_item_id", item_id="group_item__item_id", reason="reason", left="left")
    return ArraySubquery(gaps.values(entry=entry))


def members_with_gaps(members: Any) -> Any:
    """Members read with their gaps (`gap_entries`), in id order."""
    return members.annotate(gap_entries=gap_entries()).order_by("id")


def alive_henchmen_prefetch() -> Prefetch:
    """A group's living members with their gaps, in id order: what every roster payload lists (dead and dismissed
    ones are records)."""
    return Prefetch("henchmen", queryset=members_with_gaps(on_roster(Henchman.objects.all())))
