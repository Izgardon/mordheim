"""A roster Save's purchases and stash takes (decision 1, BUG-07, BUG-108), in the batch's own transaction.

Each line names its unit by `unit_id` (a unit of the batch's kind on the roster, not dismissed by the batch) or
`create_index` (a unit the batch creates). The server appends the copies, so they must not also be in that
unit's `items` list. A purchase charges and logs as POST purchases/ does (several charges share one "Group"
header); a stash take moves copies out of the stash with their costs, as a move does, so a copy is never in
both places or in neither. Everything is validated, prices included, before anything is written.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from apps.core.catalogue.current import current_rows
from apps.items.models import Item
from apps.warbands.models import RosterUnit, Warband
from apps.warbands.serializers.purchases import BatchPurchaseSerializer, StashTakeSerializer
from apps.warbands.services import economy_log
from apps.warbands.services.purchases import Line, Warning, buy_lines, price_line
from apps.warbands.services.stash import StashShortage, remove_from_stash
from apps.warbands.services.unit_items import add_unit_copies
from apps.warbands.units.errors import FieldErrors, RosterError, flatten_errors

if TYPE_CHECKING:
    from apps.warbands.units.kinds import UnitKindSpec


@dataclass
class ItemLine:
    key: str  # "purchases.0", "stash_takes.1"
    data: dict[str, Any]  # the validated line
    item: Item | None = None
    price: int | None = None  # purchases: one copy's cost


@dataclass
class ItemLines:
    purchases: list[ItemLine] = field(default_factory=list)
    stash_takes: list[ItemLine] = field(default_factory=list)

    @property
    def all(self) -> list[ItemLine]:
        return self.purchases + self.stash_takes

    def unit_ids(self) -> set[int]:
        return {line.data["unit_id"] for line in self.all if line.data.get("unit_id") is not None}


def _target_error(data: Mapping[str, Any], creates: int, unit_ids: set[int]) -> str | None:
    unit_id, create_index = data.get("unit_id"), data.get("create_index")
    if (unit_id is None) == (create_index is None):
        return "Name the unit with unit_id or create_index."
    if create_index is not None and create_index >= creates:
        return "Not one of this batch's creates."
    if unit_id is not None and unit_id not in unit_ids:
        return "Not a unit of this kind on the roster (or the batch dismisses it)."
    return None


def _validated(body: Mapping[str, Any], creates: int, unit_ids: set[int], errors: FieldErrors) -> ItemLines:
    lines = ItemLines()
    for name, serializer_class, bucket in (
        ("purchases", BatchPurchaseSerializer, lines.purchases),
        ("stash_takes", StashTakeSerializer, lines.stash_takes),
    ):
        for index, entry in enumerate(body.get(name) or []):
            key, line = f"{name}.{index}", serializer_class(data=entry)
            if not line.is_valid():
                errors.update(flatten_errors(line.errors, key))
                continue
            target = _target_error(line.validated_data, creates, unit_ids)
            if target:
                errors[f"{key}.unit_id"] = [target]
                continue
            bucket.append(ItemLine(key, dict(line.validated_data)))
    return lines


def plan_lines(
    warband: Warband, body: Mapping[str, Any], creates: int, unit_ids: set[int], errors: FieldErrors
) -> ItemLines:
    """Validate the body's `purchases` and `stash_takes`, recording errors; nothing is written."""
    lines = _validated(body, creates, unit_ids, errors)
    wanted = {line.data["item_id"] for line in lines.all}

    items = current_rows(Item.objects.prefetch_related("availabilities"), wanted, warband.campaign_id)  # CAT-TWEAK-03
    for line in lines.all:
        line.item = items.get(line.data["item_id"])
        if line.item is None:
            errors[f"{line.key}.item_id"] = ["Item not found."]
    for line in lines.purchases:
        if line.item is not None:
            try:
                line.price = price_line(warband, line.item, line.data, line.key)
            except RosterError as refused:
                errors.update(refused.fields)
    return lines


def _unit(line: ItemLine, units: Mapping[int, RosterUnit], created: Sequence[RosterUnit]) -> RosterUnit:
    create_index: int | None = line.data.get("create_index")
    if create_index is not None:
        return created[create_index]
    unit_id: int = line.data["unit_id"]
    return units[unit_id]


def _take_from_stash(kind: "UnitKindSpec", warband: Warband, line: ItemLine, unit: RosterUnit) -> None:
    item = line.item
    assert item is not None
    try:
        take = remove_from_stash(warband.id, item.id, line.data["quantity"])
    except StashShortage as shortage:
        message = f"The stash holds {shortage.held} of these."
        raise RosterError(message, "not_enough_in_stash", {f"{line.key}.quantity": [message]}) from None
    add_unit_copies(kind.key, unit, item, take.costs)
    target = (kind.key, economy_log.unit_name(kind.key, unit))
    economy_log.log_move(warband, item.name, len(take.costs), ("stash", None), target)


def apply_lines(
    kind: "UnitKindSpec",
    warband: Warband,
    lines: ItemLines,
    created: Sequence[RosterUnit],
) -> list[Warning]:
    """Inside the batch's transaction, after its creates: take the stash copies, then buy; the purchases' warnings."""
    ids = lines.unit_ids()
    units = {unit.pk: unit for unit in kind.objects.filter(id__in=ids).only("id", "name", "unit_type")} if ids else {}
    for line in lines.stash_takes:
        _take_from_stash(kind, warband, line, _unit(line, units, created))
    purchases = [
        Line(line.item, kind.key, _unit(line, units, created), line.data, line.price, line.key)
        for line in lines.purchases
        if line.item is not None
    ]
    _trades, warnings = buy_lines(warband, purchases)
    return warnings
