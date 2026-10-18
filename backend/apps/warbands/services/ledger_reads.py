"""Reading the warband log and the treasury: the server-side filters behind GET logs/ and trades/ (ECON-PERF-06)."""

from collections.abc import Sequence

from django.db.models import Q, QuerySet
from rest_framework.exceptions import ValidationError

from apps.warbands.models import LedgerAction, Warband, WarbandLog, WarbandTrade

from .ledger_manual import treasury_rows
from .ledger_names import parse_action


def log_rows(warband: Warband, feature: str | None) -> QuerySet[WarbandLog]:
    """The warband's log, of one feature (case-insensitive) when one is given."""
    logs = WarbandLog.objects.filter(warband=warband)
    if feature and feature.strip():
        logs = logs.filter(feature__iexact=feature.strip())
    return logs


def log_features(warband: Warband) -> list[str]:
    """The features the warband's log holds, for the filter (the first page sends them)."""
    features = WarbandLog.objects.filter(warband=warband).values_list("feature", flat=True)
    return list(features.distinct().order_by("feature"))


def action_filter(values: Sequence[str]) -> list[LedgerAction]:
    """`?action=Buy,Sell` (repeatable, any case, older names too) as vocabulary actions; 400 for an unknown one."""
    names = [name for value in values for name in value.split(",") if name.strip()]
    actions = []
    for name in names:
        parsed = parse_action(name)
        if parsed is None:
            raise ValidationError({"action": [f"Unknown action: {name.strip()}."]})
        actions.append(parsed.action)
    return actions


def treasury_top_rows(warband: Warband, actions: Sequence[LedgerAction]) -> QuerySet[WarbandTrade]:
    """The treasury's top-level rows with their nested rows; with `actions`, only the rows of those actions and
    the headers with a nested row of one of them (each header keeps all its nested rows)."""
    rows = treasury_rows(warband).filter(parent__isnull=True)
    if actions:
        matching = WarbandTrade.objects.filter(warband=warband, action__in=actions)
        headers = matching.filter(parent__isnull=False).values("parent_id")
        rows = rows.filter(Q(action__in=actions) | Q(id__in=headers))
    return rows
