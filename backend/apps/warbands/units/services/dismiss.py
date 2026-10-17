"""Dismissing a unit (DELETE), the same for every kind (decisions 3 and 4).

The unit is kept as a record with `dismissed_at` set, so every roster, battle and cap ignores it while its
kills still count in kill history and the campaign's top killers. Nothing is refunded, and its items stay
on the dismissed record: they are lost to the warband, as the rules say. One log row records it.
"""

from typing import TYPE_CHECKING

from django.db import transaction
from django.utils import timezone

from apps.logs.utils import log_warband_event
from apps.warbands.models import RosterUnit, Warband

if TYPE_CHECKING:
    from apps.warbands.units.kinds import UnitKindSpec


def dismiss(kind: "UnitKindSpec", warband: Warband, unit: RosterUnit) -> None:
    """Dismiss `unit` inside the caller's transaction; a dismissed hero loses the crown."""
    payload = {"name": unit.name or kind.unknown_name, "type": unit.unit_type or kind.unknown_type}
    kind.hooks.before_dismiss(warband)
    log_warband_event(warband.id, "personnel", kind.recruit.log_remove, payload)
    unit.dismissed_at = timezone.now()
    unit.save(update_fields=["dismissed_at", "updated_at"])
    kind.hooks.after_dismiss(warband)


def dismiss_unit(kind: "UnitKindSpec", warband: Warband, unit: RosterUnit) -> None:
    with transaction.atomic():
        dismiss(kind, warband, unit)
