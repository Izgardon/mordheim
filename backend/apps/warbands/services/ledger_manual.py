"""Rows entered by hand (POST and PATCH trades/): append-only history, corrected by adjustments (decisions 4-6).

Anyone who can edit the warband may enter a row; it records who did. A mistake is corrected by a new
"Adjustment" row (signed, with its reason as the description) that may name the row it corrects. A row entered
by hand keeps its description and notes editable; nothing changes an amount, an action or a row entered by the
server, and nothing deletes a row.
"""

from collections.abc import Mapping
from typing import Any

from django.db.models import Prefetch, QuerySet
from rest_framework.exceptions import ValidationError

from apps.warbands.models import Warband, WarbandTrade

from . import ledger

EDITABLE_FIELDS = ("description", "notes")


class NotEditable(Exception):
    """The row was written by the server (or before pass 2): correct it with an adjustment."""


def treasury_rows(warband: Warband) -> QuerySet[WarbandTrade]:
    """The warband's ledger rows with their authors and nested rows (one query for the rows, one for the nested)."""
    nested = Prefetch("children", queryset=WarbandTrade.objects.select_related("created_by"))
    return WarbandTrade.objects.filter(warband=warband).select_related("created_by").prefetch_related(nested)


def enter_row(warband: Warband, user: Any, data: Mapping[str, Any]) -> WarbandTrade:
    """Write a validated hand-entered row for `user`. An unknown parent is ignored, as it always was; an unknown
    row to correct is a 400."""
    parent = None
    if data.get("parent_id"):
        parent = WarbandTrade.objects.filter(id=data["parent_id"], warband=warband).first()
    corrects = None
    if data.get("corrects_id") is not None:
        corrects = WarbandTrade.objects.filter(id=data["corrects_id"], warband=warband).first()
        if corrects is None:
            raise ValidationError({"corrects_id": ["Not a row of this warband's ledger."]})
    return ledger.record(
        warband,
        data["action"],
        data["amount"],
        data["description"],
        notes=data.get("notes", ""),
        parent=parent,
        created_by=user,
        corrects=corrects,
    )


def edit_row(warband: Warband, row_id: int, changes: Mapping[str, str]) -> WarbandTrade | None:
    """Change a hand-entered row's description and notes; None when the warband has no such row."""
    row = treasury_rows(warband).filter(id=row_id).first()
    if row is None:
        return None
    if row.created_by_id is None:
        raise NotEditable()
    fields = [name for name in EDITABLE_FIELDS if name in changes]
    for name in fields:
        setattr(row, name, changes[name])
    row.save(update_fields=[*fields, "updated_at"])
    return row
