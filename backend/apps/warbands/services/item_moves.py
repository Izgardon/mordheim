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

from apps.items.models import Item
from apps.warbands.models import Henchman, LedgerAction, RosterUnit, Warband, WarbandItem, not_dismissed
from apps.warbands.prefetches import members_with_gaps
from apps.warbands.serializers import UNIT_SERIALIZERS, WarbandItemSummarySerializer, WarbandSummarySerializer
from apps.warbands.services import economy_log, ledger
from apps.warbands.services.loadouts import carriers_of, peek_row
from apps.warbands.services.prices import CampaignPrices
from apps.warbands.services.stash import ANY_COST, add_costs, remove_from_stash, stash_entry
from apps.warbands.services.unit_items import (
    add_unit_copies,
    copies_wanted,
    holds_loadout,
    resolve_unit,
    take_unit_copies,
)
from apps.warbands.units.kinds import KINDS, UnitKindKey
from apps.warbands.utils.leaders import lock_warband

Outcome = tuple[int, dict[str, Any]]


def _get_unit_instance(warband: Warband, unit_type: str, unit_id: int | None) -> Any:
    kind = KINDS[cast(UnitKindKey, unit_type)]  # validated against the kind keys
    # Transfers and sales answer with the detail payload, but henchmen list their members here dead ones too
    # (not dismissed ones: they have left the group).
    kept_members = Prefetch("henchmen", queryset=members_with_gaps(not_dismissed(Henchman.objects.all())))
    members = (kept_members,) if kind.has_members else ()
    units = kind.visible(kind.objects.filter(id=unit_id, warband=warband)).select_related("race")
    return kind.with_loadout(units, detail=True, living_members=False).prefetch_related(*members).first()


def _unit_payload(warband: Warband, unit_type: str, unit_id: int | None) -> Any:
    instance = _get_unit_instance(warband, unit_type, unit_id)
    if instance is None:
        return None
    return UNIT_SERIALIZERS[cast(UnitKindKey, unit_type)].detail(instance).data


def _remove_stash_items(warband: Warband, item_id: int, data: Mapping[str, Any]) -> tuple[list[int | None], Any]:
    """Take the copies out of the stash, newest row first or only those of the cost sent; StashShortage is a
    ValueError: a 400."""
    cost = data["cost"] if "cost" in data else ANY_COST
    take = remove_from_stash(warband.id, item_id, data["quantity"], cost)
    return take.costs, take.remaining


def _add_stash_items(warband: Warband, item: Item, costs: list[int | None]) -> Any:
    """Copies moved into the stash keep their costs (BUG-117)."""
    add_costs(warband.id, item.id, costs)
    return stash_entry(warband.id, item)


def _sale_total(warband: Warband, item: Item, data: Mapping[str, Any], unit: RosterUnit | None, quantity: int) -> int:
    """The price sent, else the suggested sale price of each copy sold (decision 3): half the current campaign
    price, or half the stored cost of the copies that leave first; ValueError (a 400) when neither is known."""
    if data.get("price") is not None:
        return int(data["price"])
    if unit is None:
        rows: Any = WarbandItem.objects.filter(warband=warband, item=item).order_by("-id")
        rows = rows.filter(cost=data["cost"]) if data.get("cost") is not None else rows
    else:
        kind = KINDS[cast(UnitKindKey, data["source_type"])]
        rows = kind.items.model._default_manager.filter(**{kind.parent_field: unit, "item": item})
        rows = rows.order_by("companion", "-id")  # as take_unit_copies takes them: the one he rides last
    stored = rows.values_list("cost", flat=True).first()
    sale = CampaignPrices(warband.campaign_id).sale_price(item, stored)
    if sale.price is None:
        raise ValueError("No price is known for this item; send one.")
    return int(sale.price) * quantity


def _quantity(data: Mapping[str, Any], unit: RosterUnit | None, item_id: int) -> int:
    """The copies a move or sale takes from its source: as sent, or a group's row's carriers (one loadout row
    leaves whole: services/loadouts.py); 0 when the group carries none (the take then refuses)."""
    if unit is None or not holds_loadout(data["source_type"]):
        return int(data["quantity"])
    row = peek_row(cast(Any, unit), item_id)
    return carriers_of(row) if row is not None else 0


def _item_change(warband: Warband, *, source: Any, target: Any = None, stash_item: Any, removed: Any) -> dict[str, Any]:
    return {
        "summary": WarbandSummarySerializer(warband).data,
        "source": source,
        "target": target,
        "stash_item": WarbandItemSummarySerializer(stash_item).data if stash_item else None,
        "removed_stash_item_id": removed,
    }


def _into_unit(warband: Warband, item: Item, costs: list[int | None], target: Any, target_type: str) -> None:
    """The copies join the unit; a group takes one for each living member, and any more go to the stash (a group's
    row given to a smaller group)."""
    wanted = copies_wanted(target_type, target, len(costs))
    add_unit_copies(target_type, target, item, costs[:wanted])
    if costs[wanted:]:
        add_costs(warband.id, item.id, costs[wanted:])


def transfer_item(warband: Warband, item: Item, data: Mapping[str, Any]) -> Outcome:
    """Move copies of `item` from the source to the target of a validated transfer body: `quantity` of them, a group's
    whole row from a group (a copy for each member who carries it), at most one per living member into a group (the
    members past the copies get gaps)."""
    item_id = data["item_id"]
    source_type, source_id = data["source_type"], data.get("source_id")
    target_type, target_id = data["target_type"], data.get("target_id")
    # both ends first: a missing, dead or dismissed one must not cost the source its copies (BUG-06)
    source_unit = None if source_type == "stash" else resolve_unit(warband, source_type, source_id, "Source")
    target_unit = None if target_type == "stash" else resolve_unit(warband, target_type, target_id, "Target")
    with transaction.atomic():
        lock_warband(warband.id)  # before the stash rows and the units, as a recruit or a PATCH sending items does
        stash_item = removed = None
        if source_unit is None:
            quantity = data["quantity"]
            if target_unit is not None:
                quantity = copies_wanted(target_type, target_unit, quantity)
            costs, stash_item = _remove_stash_items(warband, item_id, {**data, "quantity": quantity})
            if stash_item is None:
                removed = item_id
        else:
            quantity = data["quantity"]
            if target_unit is not None and not holds_loadout(source_type):
                quantity = copies_wanted(target_type, target_unit, quantity)
            costs = take_unit_copies(source_type, source_unit, item_id, quantity)

        if target_unit is None:
            stash_item = _add_stash_items(warband, item, costs)
        else:
            _into_unit(warband, item, costs, target_unit, target_type)
        source_end = (source_type, economy_log.unit_name(source_type, source_unit))
        target_end = (target_type, economy_log.unit_name(target_type, target_unit))
        economy_log.log_move(warband, item.name, len(costs), source_end, target_end)

        source = _unit_payload(warband, source_type, source_id) if source_type != "stash" else None
        if target_type != "stash":
            target = _unit_payload(warband, target_type, target_id)
        else:
            target = WarbandItemSummarySerializer(stash_item).data if stash_item else None
        return 200, _item_change(warband, source=source, target=target, stash_item=stash_item, removed=removed)


def sell_item(warband: Warband, item: Item, data: Mapping[str, Any]) -> Outcome:
    """Sell copies of `item` from the source of a validated sale body (`quantity`, or a group's row's carriers), with
    a "Sell" ledger row."""
    item_id = data["item_id"]
    source_type, source_id = data["source_type"], data.get("source_id")
    source_unit = None if source_type == "stash" else resolve_unit(warband, source_type, source_id, "Source")
    quantity = _quantity(data, source_unit, item_id)
    price = _sale_total(warband, item, data, source_unit, quantity)
    with transaction.atomic():
        # the gold first: it locks the warband before the stash row, as postbattle and trade completion do
        description = f"{item.name} x {quantity}" if quantity > 1 else item.name
        ledger.record(warband, LedgerAction.SELL, price, description)
        stash_item = removed = None
        if source_unit is None:
            _costs, stash_item = _remove_stash_items(warband, item_id, data)
            if stash_item is None:
                removed = item_id
            source = WarbandItemSummarySerializer(stash_item).data if stash_item else None
        else:
            take_unit_copies(source_type, source_unit, item_id, quantity)
            source = _unit_payload(warband, source_type, source_id)
        source_end = (source_type, economy_log.unit_name(source_type, source_unit))
        economy_log.log_sale(warband, item.name, quantity, price, source_end)
        return 200, _item_change(warband, source=source, stash_item=stash_item, removed=removed)
