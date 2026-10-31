"""A unit's copies of items, for moves, sales and purchases: found through the kinds registry.

A unit is named by kind and id and must be on the warband's roster (alive, not dismissed): anything else is a
404 before anything is written (BUG-06). A hero or hired sword holds one row per copy: copies are taken newest
first, a mount or pet switched on for him last (the one he rides stays with him), and checked by the delete count
(BUG-36); they are appended without touching the others, so no list is ever replaced, and a copy that arrives is never
a companion unless the caller says so (a purchase "assigned straight away"): moving, selling or trading a copy clears
the switch. A henchmen group holds a loadout (services/loadouts.py): copies arrive as one row, every member one each
(the newest members past the copies get gaps), and leave as one row, a copy for each member who carries it. Either
moves the unit's `updated_at`, the version a roster Save sends back (a stale one is a 409).
"""

from typing import Any, cast

from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.items.models import Item
from apps.warbands.models import RosterUnit, Warband
from apps.warbands.prefetches import item_detail_prefetches
from apps.warbands.services.loadouts import add_row, living_ids, take_row
from apps.warbands.services.prices import house_rule_prices
from apps.warbands.units.companions import with_beasts
from apps.warbands.units.kinds import KINDS, UnitKindKey


def resolve_unit(warband: Warband, unit_type: str, unit_id: int | None, role: str) -> Any:
    """The unit a move, sale or purchase names, if it is on the warband's roster; NotFound (404) otherwise."""
    kind = KINDS[cast(UnitKindKey, unit_type)]  # validated against the kind keys
    rows = kind.visible(kind.objects.filter(id=unit_id, warband=warband))
    unit = rows.only("id", "name", "unit_type", "movement", "armour_save").first()  # what a mount changes, too
    if unit is None:
        raise NotFound(f"{role} not found")
    return unit


def holds_loadout(unit_type: str) -> bool:
    """A henchmen group: its rows are a loadout, one copy per member."""
    return KINDS[cast(UnitKindKey, unit_type)].has_members


def copies_wanted(unit_type: str, unit: RosterUnit, quantity: int) -> int:
    """How many copies moving into the unit takes from their source: as asked, but a group takes at most one for each
    living member (one query, for a group only)."""
    return min(quantity, len(living_ids(unit.pk))) if holds_loadout(unit_type) else quantity


def take_unit_copies(unit_type: str, unit: RosterUnit, item_id: int, quantity: int) -> list[int | None]:
    """Take the unit's newest `quantity` copies, its companions last; ValueError when it carries fewer, or when
    another request took some of them first (the delete count is checked, BUG-36). A group gives up one loadout row,
    whatever `quantity`: a copy for each member who carries it."""
    kind = KINDS[cast(UnitKindKey, unit_type)]
    if kind.has_members:
        costs = take_row(cast(Any, unit), item_id).costs
        touch_unit(unit_type, unit)
        return costs
    links: Any = kind.items.model._default_manager  # HeroItem or HirelingItem
    rows = list(
        links.filter(**{kind.parent_field: unit, "item_id": item_id})
        .order_by("companion", "-id")
        .values_list("id", "cost")[:quantity]
    )
    if len(rows) < quantity:
        raise ValueError("Item not found.")
    deleted, _ = links.filter(id__in=[row_id for row_id, _cost in rows]).delete()
    if deleted != quantity:
        raise ValueError("Item not found.")
    touch_unit(unit_type, unit)
    return [cost for _row_id, cost in rows]


def add_unit_copies(
    unit_type: str, unit: RosterUnit, item: Item, costs: list[int | None], *, companion: bool = False
) -> None:
    """Append one copy per cost (None: unknown) to the unit, in one INSERT; `companion`: each switched on. A group gets
    one loadout row for them (`copies_wanted` keeps them to its members)."""
    if not costs:
        return
    kind = KINDS[cast(UnitKindKey, unit_type)]
    if kind.has_members:
        add_row(cast(Any, unit), item, costs, companion=companion)
        touch_unit(unit_type, unit)
        return
    rows = []
    for cost in costs:
        kwargs: dict[str, Any] = {kind.parent_field: unit, "item": item, "companion": companion}
        if cost is not None:
            kwargs["cost"] = cost
        rows.append(kind.items.model(**kwargs))
    kind.items.model._default_manager.bulk_create(rows)
    touch_unit(unit_type, unit)


def touch_unit(unit_type: str, unit: RosterUnit) -> None:
    """Move the unit's `updated_at` to now (its loadout changed), on the row and on `unit`."""
    now = timezone.now()
    KINDS[cast(UnitKindKey, unit_type)].objects.filter(pk=unit.pk).update(updated_at=now)
    unit.updated_at = now


def unit_item_rows(unit_type: str, unit: RosterUnit) -> list[Any]:
    """The unit's copies in id order with their items' details (properties, availabilities), for an answer."""
    kind = KINDS[cast(UnitKindKey, unit_type)]
    links: Any = kind.items.model._default_manager.filter(**{kind.parent_field: unit})
    links = with_beasts(links)
    links = links.annotate(**house_rule_prices(f"{kind.parent_field}__warband__campaign_id", "item_id"))
    return list(links.prefetch_related(*item_detail_prefetches("item__")).order_by("id"))
