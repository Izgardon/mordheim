"""Upgrades bought onto a hero (the templates plan, phase 3): a Mutation, a Blessing of Nurgle, a Sacred marking or a
Mark of the Dark Gods from the warband's template, as a roster Save's `upgrades` (the hire dialog's, for the hero it
creates; the store's, for a hero on the roster). Each links the upgrade's special to the hero, as any special link, and
writes a Buy row at the price sent through the ledger (none at 0 gc, as a free item writes none; two or more share a
"Group" header). Who may take one, its group's most per fighter, the second and later at double and "Bought only when
recruited." are the pages' warnings, never checked here. Removing the special later refunds nothing, as with other
specials. Heroes only: no upgrade in the book is for henchmen."""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from rest_framework import serializers

from apps.logs.utils import log_warband_event
from apps.warbands.models import LedgerAction, RosterUnit, Warband, WarbandTrade
from apps.warbands.serializers.purchases import BatchTargetSerializer
from apps.warbands.services import economy_log, ledger
from apps.warbands.units.errors import FieldErrors, flatten_errors

from ..models import TemplateUpgrade
from .resolve import template_id_for

if TYPE_CHECKING:
    from apps.warbands.units.kinds import UnitKindSpec

NOT_IN_TEMPLATE = "Not one of this warband's template upgrades."
HEROES_ONLY = "Upgrades are bought for heroes."


class UpgradeLineSerializer(BatchTargetSerializer):
    """A roster Save's `upgrades` entry: an upgrade of the warband's template for one of the batch's heroes, at the
    price the tally or the basket says."""

    upgrade_id = serializers.IntegerField()
    price = serializers.IntegerField(min_value=0, max_value=ledger.MAX_TRADE_PRICE)


@dataclass
class UpgradeLine:
    key: str  # "upgrades.0"
    data: dict[str, Any]
    upgrade: TemplateUpgrade | None = None


@dataclass
class UpgradeLines:
    lines: list[UpgradeLine] = field(default_factory=list)

    def unit_ids(self) -> set[int]:
        return {line.data["unit_id"] for line in self.lines if line.data.get("unit_id") is not None}


def plan_upgrades(
    kind: "UnitKindSpec",
    warband: Warband,
    entries: Sequence[Mapping[str, Any]],
    target_error: Callable[[Mapping[str, Any]], str | None],
    errors: FieldErrors,
) -> UpgradeLines:
    """Validate the batch's `upgrades` (`target_error`: what is wrong with a line's unit, as for purchases), recording
    errors, each line's upgrade read from the warband's template (one query); nothing is written."""
    planned = UpgradeLines()
    if not entries:
        return planned
    if kind.key != "hero":
        errors["upgrades"] = [HEROES_ONLY]
        return planned
    for index, entry in enumerate(entries):
        key, body = f"upgrades.{index}", UpgradeLineSerializer(data=entry)
        if not body.is_valid():
            errors.update(flatten_errors(body.errors, key))
            continue
        problem = target_error(body.validated_data)
        if problem:
            errors[f"{key}.unit_id"] = [problem]
            continue
        planned.lines.append(UpgradeLine(key, dict(body.validated_data)))
    wanted = {line.data["upgrade_id"] for line in planned.lines}
    rows = TemplateUpgrade.objects.filter(template_id=template_id_for(warband), id__in=wanted).select_related("special")
    upgrades = {row.pk: row for row in rows} if wanted else {}
    for line in planned.lines:
        line.upgrade = upgrades.get(line.data["upgrade_id"])
        if line.upgrade is None:
            errors[f"{line.key}.upgrade_id"] = [NOT_IN_TEMPLATE]
    return planned


def _header(kind: "UnitKindSpec", warband: Warband, charged: Sequence[tuple[UpgradeLine, RosterUnit]]) -> Any:
    """Two or more charges share a "Group" header, as a Save's purchases do."""
    if len(charged) < 2:
        return None
    names = list(dict.fromkeys(economy_log.unit_name(kind.key, unit) or "" for _line, unit in charged))
    total = sum(line.data["price"] for line, _unit in charged)
    return ledger.group_header(warband, f"Upgraded {', '.join(names)} ({len(charged)} upgrades, {total} gc)")


def buy_upgrades(
    kind: "UnitKindSpec",
    warband: Warband,
    planned: UpgradeLines,
    units: Mapping[int, RosterUnit],
    created: Sequence[RosterUnit],
) -> list[WarbandTrade]:
    """Inside the batch's transaction, after its creates: a Buy row at each upgrade's price (the gold first, as
    purchases lock it), then its special linked to its hero and logged as a special the hero gained; the rows."""
    placed = [
        (
            line,
            created[line.data["create_index"]]
            if line.data.get("create_index") is not None
            else units[line.data["unit_id"]],
        )
        for line in planned.lines
        if line.upgrade is not None
    ]
    charged = [(line, unit) for line, unit in placed if line.data["price"] > 0]
    header = _header(kind, warband, charged)
    trades = ledger.record_entries(
        [
            ledger.Entry(warband, LedgerAction.BUY, -line.data["price"], line.upgrade.special.name, parent=header)
            for line, _unit in charged
            if line.upgrade is not None
        ]
    )
    link = kind.specials
    link.model._default_manager.bulk_create(
        link.model(**{kind.parent_field: unit, link.target: line.upgrade.special})
        for line, unit in placed
        if line.upgrade
    )
    for line, unit in placed:
        assert line.upgrade is not None
        special = line.upgrade.special
        payload = {"hero": economy_log.unit_name(kind.key, unit), "special": special.name, "special_type": special.type}
        log_warband_event(
            warband.id, "loadout", link.log_entry or "hero_special", {**payload, "price": line.data["price"]}
        )
    return trades
