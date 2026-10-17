"""The recruit queue's Save: one request that creates, updates and dismisses units of one kind (decision 1).

Everything is validated first and every error is reported at once, keyed by entry ("create.0.name",
"update.2.xp", "dismiss.1"). Then, in one transaction, the dismissals, updates and creates run through the
same services as the per-unit endpoints (dismissals first, so they free places under the caps). Any refusal
on the way (a cap) rolls the whole batch back: all or nothing, so Cancel never needs a server call.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from django.db import transaction

from apps.warbands.models import Warband, not_dismissed
from apps.warbands.units.errors import FieldErrors, RosterError, flatten_errors

from .create import recruit
from .dismiss import dismiss
from .update import save_update

if TYPE_CHECKING:
    from apps.warbands.units.kinds import UnitKindSpec
    from apps.warbands.units.serializers import UnitSerializers, UnitWriteSerializer


@dataclass
class BatchPlan:
    creates: list[tuple["UnitWriteSerializer", dict[str, Any]]] = field(default_factory=list)
    updates: list[tuple["UnitWriteSerializer", dict[str, Any]]] = field(default_factory=list)
    dismissals: list[Any] = field(default_factory=list)
    errors: FieldErrors = field(default_factory=dict)


def _update_ids(plan: BatchPlan, updates: list[dict[str, Any]], dismiss_ids: list[int]) -> list[int | None]:
    """Each update entry's unit id (None when unusable), recording missing, malformed and repeated ids."""
    ids: list[int | None] = []
    for index, entry in enumerate(updates):
        unit_id = entry.get("id")
        if not isinstance(unit_id, int) or isinstance(unit_id, bool):
            plan.errors[f"update.{index}.id"] = ["A unit id is required."]
            unit_id = None
        elif unit_id in ids:
            plan.errors[f"update.{index}.id"] = ["This unit is already listed."]
        elif unit_id in dismiss_ids:
            plan.errors[f"update.{index}.id"] = ["This unit is also listed to dismiss."]
        ids.append(unit_id)
    for index, unit_id in enumerate(dismiss_ids):
        if unit_id in dismiss_ids[:index]:
            plan.errors[f"dismiss.{index}"] = ["This unit is already listed."]
    return ids


def plan_batch(
    kind: "UnitKindSpec", serializers: "UnitSerializers", warband: Warband, body: Mapping[str, Any]
) -> BatchPlan:
    """Validate a batch body (already shaped as lists) without writing anything."""
    plan = BatchPlan()
    updates, dismiss_ids = body["update"], body["dismiss"]
    update_ids = _update_ids(plan, updates, dismiss_ids)
    wanted = {unit_id for unit_id in update_ids if unit_id is not None} | set(dismiss_ids)
    units = not_dismissed(kind.objects.filter(warband=warband, id__in=wanted))
    found = {unit.id: unit for unit in units.select_related("warband__campaign__settings")}
    context = {"campaign_id": warband.campaign_id}
    for index, unit_id in enumerate(dismiss_ids):
        if unit_id in found:
            plan.dismissals.append(found[unit_id])
        else:
            plan.errors.setdefault(f"dismiss.{index}", ["Not found."])
    for index, (unit_id, entry) in enumerate(zip(update_ids, updates, strict=True)):
        unit = found.get(unit_id) if unit_id is not None else None
        if unit is None or unit.dead:  # dead units are read-only here, as on PATCH
            plan.errors.setdefault(f"update.{index}.id", ["Not found."])
            continue
        sent = {key: value for key, value in entry.items() if key != "id"}
        writer = serializers.update(unit, data=sent, partial=True, context=context)
        if writer.is_valid():
            plan.updates.append((writer, sent))
        else:
            plan.errors.update(flatten_errors(writer.errors, f"update.{index}"))
    for index, entry in enumerate(body["create"]):
        writer = serializers.create(data=entry, context=context)
        if writer.is_valid():
            plan.creates.append((writer, entry))
        else:
            plan.errors.update(flatten_errors(writer.errors, f"create.{index}"))
    return plan


def apply_batch(kind: "UnitKindSpec", warband: Warband, plan: BatchPlan) -> None:
    """Run a valid plan in one transaction; a refusal (a cap) is reported on its entry and undoes it all."""
    if plan.errors:
        raise RosterError("Some of the changes are invalid; nothing was saved.", "invalid", plan.errors)
    with transaction.atomic():
        for unit in plan.dismissals:
            dismiss(kind, warband, unit)
        for writer, sent in plan.updates:
            save_update(kind, warband, writer, sent=sent)
        for index, (writer, sent) in enumerate(plan.creates):
            try:
                recruit(kind, warband, writer, sent=sent)
            except RosterError as refused:
                detail = refused.message
                raise RosterError(detail, refused.error_code, {f"create.{index}": [detail]}) from None
