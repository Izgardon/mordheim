"""The stat lines of a warband's on-roster units, for the campaign overview's roster expand (PERF-42).

The expand fetched the heroes, henchmen groups and hired swords lists (3 requests, 13 queries) to show one stat line
per unit. This reads the three kinds' shared stat columns in one UNION ALL query; each kind's rows come from its
own table, as the kinds share their columns (models/shared.py `RosterUnit`).
"""

from typing import Any

from django.db.models import CharField, F, IntegerField, QuerySet, Value

from apps.warbands.models import HenchmenGroup, Hero, Hireling
from apps.warbands.models.shared import STAT_FIELDS, on_roster

COLUMNS = ("id", "name", "unit_type", *STAT_FIELDS, "armour_save")
KINDS: tuple[tuple[str, Any], ...] = (
    ("heroes", Hero),
    ("henchmen_groups", HenchmenGroup),
    ("hirelings", Hireling),
)


def _rows(kind: str, order: int, model: Any, warband_id: int) -> QuerySet[Any, dict[str, Any]]:
    annotated = {f"v_{column}": F(column) for column in COLUMNS}
    rows = on_roster(model.objects.filter(warband_id=warband_id)).annotate(
        v_kind=Value(kind, output_field=CharField()), v_order=Value(order, output_field=IntegerField()), **annotated
    )
    values: QuerySet[Any, dict[str, Any]] = rows.values("v_kind", "v_order", *annotated)
    return values


def roster_stats(warband_id: int) -> dict[str, list[dict[str, Any]]]:
    """{"heroes": [...], "henchmen_groups": [...], "hirelings": [...]}: each unit's id, name, type and stats,
    oldest first, in one query."""
    parts = [_rows(kind, order, model, warband_id) for order, (kind, model) in enumerate(KINDS)]
    union = parts[0].union(*parts[1:], all=True).order_by("v_order", "v_id")
    stats: dict[str, list[dict[str, Any]]] = {kind: [] for kind, _model in KINDS}
    for row in union:
        stats[row["v_kind"]].append({column: row[f"v_{column}"] for column in COLUMNS})
    return stats
