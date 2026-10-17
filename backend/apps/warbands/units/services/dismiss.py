"""Dismissing a unit (DELETE), the same for every kind.

The unit is deleted with its loadout and members, nothing is refunded, and one log row records it.
Decisions 3 and 4 (lost items said plainly, soft delete) are changes to this one function (PR C).
"""

from typing import TYPE_CHECKING

from django.db import transaction

from apps.logs.utils import log_warband_event
from apps.warbands.models import RosterUnit, Warband

if TYPE_CHECKING:
    from apps.warbands.units.kinds import UnitKindSpec


def dismiss_unit(kind: "UnitKindSpec", warband: Warband, unit: RosterUnit) -> None:
    payload = {"name": unit.name or kind.unknown_name, "type": unit.unit_type or kind.unknown_type}
    with transaction.atomic():
        kind.hooks.before_dismiss(warband)
        log_warband_event(warband.id, "personnel", kind.recruit.log_remove, payload)
        unit.delete()
        kind.hooks.after_dismiss(warband)
