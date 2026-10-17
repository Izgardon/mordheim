"""Moving items between units and the stash, and selling them (POST item-transfers/ and item-sales/).

Units are looked up through the kinds registry. Each function returns (status, body). Too few copies to
move or sell raises ValueError, which rolls the whole move back. A source or target that isn't found
answers 404 from inside the transaction instead, so a removal already made is kept (a quirk pinned in
test_roster_characterisation_items; fixing it is a behaviour change).
"""

from collections.abc import Mapping
from typing import Any, cast

from django.db import transaction
from django.db.models import Prefetch

from apps.items.models import Item
from apps.warbands.models import Henchman, RosterUnit, Warband, WarbandItem, not_dismissed
from apps.warbands.serializers import UNIT_SERIALIZERS, WarbandItemSummarySerializer, WarbandSummarySerializer
from apps.warbands.units.kinds import KINDS, UnitKindKey
from apps.warbands.utils.trades import TradeHelper

Outcome = tuple[int, dict[str, Any]]


def _get_unit_instance(warband: Warband, unit_type: str, unit_id: int | None) -> Any:
    kind = KINDS[cast(UnitKindKey, unit_type)]  # validated against the kind keys
    # Transfers and sales answer with the detail payload, but henchmen list their members here dead ones too
    # (not dismissed ones: they have left the group).
    kept_members = Prefetch("henchmen", queryset=not_dismissed(Henchman.objects.all()))
    members = (kept_members,) if kind.has_members else ()
    units = kind.visible(kind.objects.filter(id=unit_id, warband=warband)).select_related("race")
    return kind.with_loadout(units, detail=True, living_members=False).prefetch_related(*members).first()


def _unit_payload(warband: Warband, unit_type: str, unit_id: int | None) -> Any:
    instance = _get_unit_instance(warband, unit_type, unit_id)
    if instance is None:
        return None
    return UNIT_SERIALIZERS[cast(UnitKindKey, unit_type)].detail(instance).data


def _remove_unit_items(unit_type: str, unit: RosterUnit, item_id: int, quantity: int) -> list[int | None]:
    kind = KINDS[cast(UnitKindKey, unit_type)]
    links: Any = kind.items.model._default_manager  # HeroItem, HenchmenGroupItem or HiredSwordItem
    rows = list(links.filter(**{kind.parent_field: unit, "item_id": item_id}).order_by("-id")[:quantity])
    if len(rows) < quantity:
        raise ValueError("Item not found.")
    costs = [row.cost for row in rows]
    links.filter(id__in=[row.id for row in rows]).delete()
    return costs


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
    stash_item = WarbandItem.objects.filter(warband=warband, item_id=item_id).select_related("item").first()
    if not stash_item or (stash_item.quantity or 0) < quantity:
        raise ValueError("Item not found in stash.")
    costs = [stash_item.cost] * quantity
    remaining = (stash_item.quantity or 0) - quantity
    if remaining <= 0:
        stash_item.delete()
        return costs, None
    stash_item.quantity = remaining
    stash_item.save(update_fields=["quantity"])
    stash_item.refresh_from_db()
    return costs, stash_item


def _add_stash_items(warband: Warband, item: Item, costs: list[int | None]) -> Any:
    quantity = len(costs)
    if quantity <= 0:
        return None
    stash_item = WarbandItem.objects.filter(warband=warband, item=item).select_related("item").first()
    next_cost = next((cost for cost in reversed(costs) if cost is not None), None)
    if stash_item:
        stash_item.quantity = (stash_item.quantity or 0) + quantity
        if next_cost is not None:
            stash_item.cost = next_cost
            stash_item.save(update_fields=["quantity", "cost"])
        else:
            stash_item.save(update_fields=["quantity"])
        stash_item.refresh_from_db()
        return stash_item
    create_kwargs: dict[str, Any] = {"warband": warband, "item": item, "quantity": quantity}
    if next_cost is not None:
        create_kwargs["cost"] = next_cost
    return WarbandItem.objects.create(**create_kwargs)


def add_to_stash(warband: Warband, item: Item, quantity: int, cost: int | None) -> WarbandItem:
    """POST items/: add copies to the stash; an item with one availability defaults to its cost."""
    if cost is None:
        availabilities = list(item.availabilities.all())
        if len(availabilities) == 1:
            cost = availabilities[0].cost
    warband_item = WarbandItem.objects.filter(warband=warband, item=item).first()
    if warband_item:
        warband_item.quantity = (warband_item.quantity or 0) + quantity
        if cost is not None:
            warband_item.cost = cost
        warband_item.save(update_fields=["quantity", "cost"])
        return warband_item
    return WarbandItem.objects.create(warband=warband, item=item, quantity=quantity, cost=cost)


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
    with transaction.atomic():
        stash_item = removed = None
        if source_type == "stash":
            costs, stash_item = _remove_stash_items(warband, item_id, quantity)
            if stash_item is None:
                removed = item_id
        else:
            source_unit = _get_unit_instance(warband, source_type, source_id)
            if not source_unit:
                return 404, {"detail": "Source not found"}
            costs = _remove_unit_items(source_type, source_unit, item_id, quantity)

        if target_type == "stash":
            stash_item = _add_stash_items(warband, item, costs)
        else:
            target_unit = _get_unit_instance(warband, target_type, target_id)
            if not target_unit:
                return 404, {"detail": "Target not found"}
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
    with transaction.atomic():
        stash_item = removed = None
        if source_type == "stash":
            _costs, stash_item = _remove_stash_items(warband, item_id, quantity)
            if stash_item is None:
                removed = item_id
            source = WarbandItemSummarySerializer(stash_item).data if stash_item else None
        else:
            source_unit = _get_unit_instance(warband, source_type, source_id)
            if not source_unit:
                return 404, {"detail": "Source not found"}
            _remove_unit_items(source_type, source_unit, item_id, quantity)
            source = _unit_payload(warband, source_type, source_id)

        TradeHelper.create_trade(
            warband=warband,
            action="Sold",
            description=f"{item.name} x {quantity}" if quantity > 1 else item.name,
            price=data["price"],
            notes="",
        )
        return 200, _item_change(warband, source=source, stash_item=stash_item, removed=removed)
