"""A unit's copies of items, for moves, sales and purchases: found through the kinds registry, one row per copy.

A unit is named by kind and id and must be on the warband's roster (alive, not dismissed): anything else is a
404 before anything is written (BUG-06). Copies are taken newest first and checked by the delete count (BUG-36)
and appended without touching the others, so no list is ever replaced.
"""

from typing import Any, cast

from rest_framework.exceptions import NotFound

from apps.items.models import Item
from apps.warbands.models import RosterUnit, Warband
from apps.warbands.units.kinds import KINDS, UnitKindKey


def resolve_unit(warband: Warband, unit_type: str, unit_id: int | None, role: str) -> Any:
    """The unit a move, sale or purchase names, if it is on the warband's roster; NotFound (404) otherwise."""
    kind = KINDS[cast(UnitKindKey, unit_type)]  # validated against the kind keys
    unit = kind.visible(kind.objects.filter(id=unit_id, warband=warband)).only("id", "name", "unit_type").first()
    if unit is None:
        raise NotFound(f"{role} not found")
    return unit


def take_unit_copies(unit_type: str, unit: RosterUnit, item_id: int, quantity: int) -> list[int | None]:
    """Take the unit's newest `quantity` copies; ValueError when it carries fewer, or when another request took
    some of them first (the delete count is checked, BUG-36)."""
    kind = KINDS[cast(UnitKindKey, unit_type)]
    links: Any = kind.items.model._default_manager  # HeroItem, HenchmenGroupItem or HiredSwordItem
    rows = list(
        links.filter(**{kind.parent_field: unit, "item_id": item_id})
        .order_by("-id")
        .values_list("id", "cost")[:quantity]
    )
    if len(rows) < quantity:
        raise ValueError("Item not found.")
    deleted, _ = links.filter(id__in=[row_id for row_id, _cost in rows]).delete()
    if deleted != quantity:
        raise ValueError("Item not found.")
    return [cost for _row_id, cost in rows]


def add_unit_copies(unit_type: str, unit: RosterUnit, item: Item, costs: list[int | None]) -> None:
    """Append one copy per cost (None: unknown) to the unit, in one INSERT."""
    if not costs:
        return
    kind = KINDS[cast(UnitKindKey, unit_type)]
    rows = []
    for cost in costs:
        kwargs: dict[str, Any] = {kind.parent_field: unit, "item": item}
        if cost is not None:
            kwargs["cost"] = cost
        rows.append(kind.items.model(**kwargs))
    kind.items.model._default_manager.bulk_create(rows)
