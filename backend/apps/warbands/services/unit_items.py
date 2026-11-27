"""A unit's copies of items, for moves, sales and purchases: found through the kinds registry.

A unit is named by kind and id and must be on the warband's roster (alive, not dismissed): anything else is a
404 before anything is written (BUG-06). A hero or hired sword holds one row per copy: copies are taken newest
first, a mount or pet switched on for him last (the one he rides stays with him), and checked by the delete count
(BUG-36); they are appended without touching the others, so no list is ever replaced, and a copy that arrives is never
a companion unless the caller says so (a purchase "assigned straight away"): moving, selling or trading a copy clears
the switch. A henchmen group holds a loadout (services/loadouts.py): copies arrive as one row, every member one each
(the newest members past the copies get gaps), and leave as one row, a copy for each member who carries it. Either
moves the unit's `updated_at`, the version a roster Save sends back (a stale one is a 409), and moves his armour
save by what the copies are worth (services/armour.py: a group's row once, whatever its members).
"""

from dataclasses import dataclass
from typing import Any, cast

from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.items.models import Item
from apps.warbands.models import RosterUnit, Warband
from apps.warbands.prefetches import item_detail_prefetches
from apps.warbands.services.armour import Save, equipped, unequipped
from apps.warbands.services.loadouts import add_row, living_ids, take_row
from apps.warbands.services.prices import house_rule_prices
from apps.warbands.units.companions import with_beasts
from apps.warbands.units.kinds import KINDS, UnitKindKey


def resolve_unit(warband: Warband, unit_type: str, unit_id: int | None, role: str) -> Any:
    """The unit a move, sale or purchase names, if it is on the warband's roster; NotFound (404) otherwise."""
    kind = KINDS[cast(UnitKindKey, unit_type)]  # validated against the kind keys
    rows = kind.visible(kind.objects.filter(id=unit_id, warband=warband))
    fields = ["id", "name", "unit_type", "movement", "armour_save"]  # what a mount changes, too
    if any(field.name == "caster" for field in kind.model._meta.concrete_fields):
        fields.append("caster")  # a wizard in armour warns (units/caster_armour.py)
    unit = rows.only(*fields).first()
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


@dataclass(frozen=True)
class TakenCopies:
    """The copies a take gave up: each one's cost, and the name they were given (weapon materials), read with them
    so a move never costs a query to learn it."""

    costs: list[int | None]
    shown_as: str = ""


def take_unit_copies(unit_type: str, unit: RosterUnit, item_id: int, quantity: int, material: str = "") -> TakenCopies:
    """Take the unit's newest `quantity` copies made of `material` ("" plain), its companions last; ValueError when it
    carries fewer, or when another request took some of them first (the delete count is checked, BUG-36). A group
    gives up one loadout row, whatever `quantity`: a copy for each member who carries it."""
    kind = KINDS[cast(UnitKindKey, unit_type)]
    if kind.has_members:
        taken = take_row(cast(Any, unit), item_id, material)
        touch_unit(unit_type, unit)
        unequipped(kind, unit, taken.save, [(taken.row_id, taken.companion)])
        return TakenCopies(taken.costs, taken.shown_as)
    links: Any = kind.items.model._default_manager  # HeroItem or HirelingItem
    columns = ("id", "cost", "shown_as", "companion", "item__save_bonus", "item__save_slot")
    rows = list(
        links.filter(**{kind.parent_field: unit, "item_id": item_id, "material": material})
        .order_by("companion", "-id")
        .values(*columns)[:quantity]
    )
    if len(rows) < quantity:
        raise ValueError("Item not found.")
    deleted, _ = links.filter(id__in=[row["id"] for row in rows]).delete()
    if deleted != quantity:
        raise ValueError("Item not found.")
    touch_unit(unit_type, unit)
    if rows:  # what the copies that left were worth, now that they are gone
        save = Save(rows[0]["item__save_bonus"], rows[0]["item__save_slot"])
        unequipped(kind, unit, save, [(row["id"], row["companion"]) for row in rows])
    return TakenCopies([row["cost"] for row in rows], rows[0]["shown_as"] if rows else "")


def add_unit_copies(
    unit_type: str,
    unit: RosterUnit,
    item: Item,
    costs: list[int | None],
    *,
    companion: bool = False,
    material: str = "",
    shown_as: str = "",
) -> None:
    """Append one copy per cost (None: unknown) to the unit, in one INSERT; `companion`: each switched on, `material`:
    what they are made of and `shown_as` the name they were given (weapon materials). A group gets one loadout row
    for them (`copies_wanted` keeps them to its members)."""
    if not costs:
        return
    kind = KINDS[cast(UnitKindKey, unit_type)]
    copies = 1 if kind.has_members else len(costs)  # a group takes the copies as one row, so one piece of armour
    equipped(kind, unit, Save.of(item), copies, companion=companion)  # before the rows: the body slot reads them
    if kind.has_members:
        add_row(cast(Any, unit), item, costs, companion=companion, material=material, shown_as=shown_as)
        touch_unit(unit_type, unit)
        return
    rows = []
    for cost in costs:
        kwargs: dict[str, Any] = {
            kind.parent_field: unit,
            "item": item,
            "companion": companion,
            "material": material,
            "shown_as": shown_as,
        }
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
