"""Moving items between units and the stash, and selling them (POST item-transfers/ and item-sales/).

Units are looked up through the kinds registry. Each function returns (status, body). The source and the
target are resolved before anything is written: one that isn't on the warband's roster (missing, dead or
dismissed) raises NotFound and nothing moves (BUG-06). Too few copies to move or sell raises ValueError,
which rolls the whole move back.
"""

from collections.abc import Mapping
from typing import Any, cast

from django.db import transaction
from django.db.models import Prefetch
from rest_framework.exceptions import NotFound

from apps.items.models import Item
from apps.warbands.models import Henchman, RosterUnit, Warband, not_dismissed
from apps.warbands.serializers import UNIT_SERIALIZERS, WarbandItemSummarySerializer, WarbandSummarySerializer
from apps.warbands.services import ledger
from apps.warbands.services.stash import add_to_stash, remove_from_stash, stash_row
from apps.warbands.units.kinds import KINDS, UnitKindKey

Outcome = tuple[int, dict[str, Any]]


def _get_unit_instance(warband: Warband, unit_type: str, unit_id: int | None) -> Any:
    kind = KINDS[cast(UnitKindKey, unit_type)]  # validated against the kind keys
    # Transfers and sales answer with the detail payload, but henchmen list their members here dead ones too
    # (not dismissed ones: they have left the group).
    kept_members = Prefetch("henchmen", queryset=not_dismissed(Henchman.objects.all()))
    members = (kept_members,) if kind.has_members else ()
    units = kind.visible(kind.objects.filter(id=unit_id, warband=warband)).select_related("race")
    return kind.with_loadout(units, detail=True, living_members=False).prefetch_related(*members).first()


def _resolve_unit(warband: Warband, unit_type: str, unit_id: int | None, role: str) -> Any:
    """The unit a move or sale names, if it is on the warband's roster; NotFound (404) otherwise."""
    kind = KINDS[cast(UnitKindKey, unit_type)]  # validated against the kind keys
    unit = kind.visible(kind.objects.filter(id=unit_id, warband=warband)).only("id").first()
    if unit is None:
        raise NotFound(f"{role} not found")
    return unit


def _unit_payload(warband: Warband, unit_type: str, unit_id: int | None) -> Any:
    instance = _get_unit_instance(warband, unit_type, unit_id)
    if instance is None:
        return None
    return UNIT_SERIALIZERS[cast(UnitKindKey, unit_type)].detail(instance).data


def _remove_unit_items(unit_type: str, unit: RosterUnit, item_id: int, quantity: int) -> list[int | None]:
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


def _add_unit_items(unit_type: str, unit: RosterUnit, item: Item, costs: list[int | None]) -> None:
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


def _remove_stash_items(warband: Warband, item_id: int, quantity: int) -> tuple[list[int | None], Any]:
    take = remove_from_stash(warband.id, item_id, quantity)  # StashShortage is a ValueError: a 400
    return [take.cost] * quantity, take.remaining


def _add_stash_items(warband: Warband, item: Item, costs: list[int | None]) -> Any:
    """Copies moved into the stash share one cost: the last known one among them (BUG-117 keeps this for now)."""
    next_cost = next((cost for cost in reversed(costs) if cost is not None), None)
    add_to_stash(warband.id, item.id, len(costs), next_cost)
    return stash_row(warband.id, item)


def _item_change(warband: Warband, *, source: Any, target: Any = None, stash_item: Any, removed: Any) -> dict[str, Any]:
    return {
        "summary": WarbandSummarySerializer(warband).data,
        "source": source,
        "target": target,
        "stash_item": WarbandItemSummarySerializer(stash_item).data if stash_item else None,
        "removed_stash_item_id": removed,
    }


def transfer_item(warband: Warband, item: Item, data: Mapping[str, Any]) -> Outcome:
    """Move `quantity` copies of `item` from the source to the target of a validated transfer body."""
    item_id, quantity = data["item_id"], data["quantity"]
    source_type, source_id = data["source_type"], data.get("source_id")
    target_type, target_id = data["target_type"], data.get("target_id")
    # both ends first: a missing, dead or dismissed one must not cost the source its copies (BUG-06)
    source_unit = None if source_type == "stash" else _resolve_unit(warband, source_type, source_id, "Source")
    target_unit = None if target_type == "stash" else _resolve_unit(warband, target_type, target_id, "Target")
    with transaction.atomic():
        stash_item = removed = None
        if source_unit is None:
            costs, stash_item = _remove_stash_items(warband, item_id, quantity)
            if stash_item is None:
                removed = item_id
        else:
            costs = _remove_unit_items(source_type, source_unit, item_id, quantity)

        if target_unit is None:
            stash_item = _add_stash_items(warband, item, costs)
        else:
            _add_unit_items(target_type, target_unit, item, costs)

        source = _unit_payload(warband, source_type, source_id) if source_type != "stash" else None
        if target_type != "stash":
            target = _unit_payload(warband, target_type, target_id)
        else:
            target = WarbandItemSummarySerializer(stash_item).data if stash_item else None
        return 200, _item_change(warband, source=source, target=target, stash_item=stash_item, removed=removed)


def sell_item(warband: Warband, item: Item, data: Mapping[str, Any]) -> Outcome:
    """Sell `quantity` copies of `item` from the source of a validated sale body, with a "Sold" trade."""
    item_id, quantity = data["item_id"], data["quantity"]
    source_type, source_id = data["source_type"], data.get("source_id")
    source_unit = None if source_type == "stash" else _resolve_unit(warband, source_type, source_id, "Source")
    with transaction.atomic():
        # the gold first: it locks the warband before the stash row, as postbattle and trade completion do
        description = f"{item.name} x {quantity}" if quantity > 1 else item.name
        ledger.record(warband, "Sold", data["price"], description)
        stash_item = removed = None
        if source_unit is None:
            _costs, stash_item = _remove_stash_items(warband, item_id, quantity)
            if stash_item is None:
                removed = item_id
            source = WarbandItemSummarySerializer(stash_item).data if stash_item else None
        else:
            _remove_unit_items(source_type, source_unit, item_id, quantity)
            source = _unit_payload(warband, source_type, source_id)
        return 200, _item_change(warband, source=source, stash_item=stash_item, removed=removed)
