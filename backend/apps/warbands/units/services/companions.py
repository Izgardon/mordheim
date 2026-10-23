"""Switching a mount or pet on and off for the unit holding it, and the warnings that follow (bestiary rewrite step 4).

`POST warbands/<id>/<kind>/<unit id>/items/<item row id>/companion/ {"on": bool}`. Only an Animal item whose beast
is a mount or a pet can be switched on (switching off always works, whatever the beast became). The switch moves
the unit's `updated_at`, like any loadout change. Warnings describe the state after the switch: two mounts on one
rider, a group's mounts against its living members, more than two mounts in the warband (units/companions.py).
"""

from collections.abc import Iterable
from typing import Any

from django.db import transaction

from apps.bestiary.models import MOUNT
from apps.warbands.models import Henchman, RosterUnit, Warband, on_roster
from apps.warbands.services.unit_items import touch_unit
from apps.warbands.units.companions import (
    COMPANION_KINDS,
    Warning,
    beast_kind,
    companion_warnings,
    unit_companion_warnings,
    warband_mount_warnings,
)
from apps.warbands.units.errors import RosterError
from apps.warbands.units.kinds import KINDS, UnitKindSpec

NOT_A_COMPANION = "Only a mount or a pet can be switched on for its unit; recruit a creature into henchmen instead."


def switch_companion(kind: UnitKindSpec, unit: RosterUnit, row_id: int, on: bool) -> None:
    """Switch the unit's item row on or off as its companion: 404 when the row isn't the unit's, 400
    `not_a_companion` when switching on anything but a mount or a pet."""
    links: Any = kind.items.model._default_manager
    row = links.select_related("item__bestiary_entry").filter(pk=row_id, **{kind.parent_field: unit}).first()
    if row is None:
        raise RosterError("This unit doesn't carry that item.", "not_found", status_code=404)
    if on and beast_kind(row.item) not in COMPANION_KINDS:
        raise RosterError(NOT_A_COMPANION, "not_a_companion", {"on": [NOT_A_COMPANION]})
    with transaction.atomic():
        links.filter(pk=row.pk).update(companion=on)
        touch_unit(kind.key, unit)


def warband_mounts(warband_id: int) -> int:
    """The mounts switched on across the warband's roster (dead and dismissed units left out): one query."""
    counted = []
    for kind in KINDS.values():
        parent = kind.parent_field
        rows: Any = kind.items.model._default_manager.filter(companion=True, item__bestiary_entry__kind=MOUNT)
        rows = rows.filter(**{f"{parent}__warband_id": warband_id, f"{parent}__dead": False})
        counted.append(rows.filter(**{f"{parent}__dismissed_at__isnull": True}).values("pk"))
    return int(counted[0].union(*counted[1:], all=True).count())


def loaded_unit_warnings(kind: UnitKindSpec, warband: Warband, unit: Any) -> list[Warning]:
    """The companion warnings for a unit read with its loadout (`with_loadout`: its item rows and living members)."""
    rows = getattr(unit, kind.items.relation).all()
    riders = len(unit.henchmen.all()) if kind.has_members else None
    return companion_warnings(_name(kind, unit), rows, riders, warband_mounts(warband.id))


def unit_warnings(kind: UnitKindSpec, warband: Warband, unit: RosterUnit) -> list[Warning]:
    """The companion warnings for a unit read without its loadout (three queries)."""
    return units_warnings(warband, [(kind, unit)])


def units_warnings(warband: Warband, units: Iterable[tuple[UnitKindSpec, RosterUnit]]) -> list[Warning]:
    """The companion warnings for units read without their loadout, once each (a roster Save may buy several mounts
    for one): each unit's rows and living members, then the warband's mounts once, after every change."""
    warnings: list[Warning] = []
    for kind, unit in {(kind.key, unit.pk): (kind, unit) for kind, unit in units}.values():
        links: Any = kind.items.model._default_manager
        rows = list(links.filter(**{kind.parent_field: unit}).select_related("item__bestiary_entry").order_by("id"))
        riders = on_roster(Henchman.objects.filter(group_id=unit.pk)).count() if kind.has_members else None
        warnings += unit_companion_warnings(_name(kind, unit), rows, riders)
    return warnings + warband_mount_warnings(warband_mounts(warband.id))


def _name(kind: UnitKindSpec, unit: Any) -> str:
    return str(unit.name or unit.unit_type or kind.unknown_name)
