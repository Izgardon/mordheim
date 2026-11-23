"""Reading a published campaign's rules file, and writing its charts: shared by the preset seeder (`seeding.py`)
and its locations (`location_seeding.py`).

A chart is a title, when it is rolled, its dice, a note and its results; a result may carry a table of its own
(Border Town Burning's Curious bloom), read and written with it.
"""

import json
from pathlib import Path
from typing import Any

from django.core.management.base import CommandError

from apps.campaigns.models import CHART_DICE
from apps.core.seeding import clean

from .models import CampaignPreset, CampaignPresetChart, CampaignPresetChartRow


class Skipped(Exception):
    """The preset names something we do not hold: it is skipped, never seeded without it."""

    def __init__(self, preset: str, reason: str) -> None:
        super().__init__(f"{preset}: {reason}; the preset is skipped.")


def one_chart(row: Any, title: str, label: str, name: str) -> dict[str, Any]:
    """One chart as the file gives it, by the rules `read_charts` applies."""
    if not isinstance(row, dict):
        raise CommandError(f"{label}: the chart on '{title}' in {name}.json should be an object.")
    dice = clean(row.get("dice"))
    if dice and dice not in CHART_DICE:
        raise CommandError(f"{label}: the chart '{title}' rolls {dice}, which isn't a die we hold.")
    return {
        "title": clean(row.get("title")) or title,
        "description": clean(row.get("description")),
        "dice": dice,
        "note": clean(row.get("note")),
        "umbrella": clean(row.get("umbrella")),
        "rows": chart_rows(row.get("rows"), title, label, name),
    }


def chart_rows(rows: Any, title: str, label: str, name: str) -> list[dict[str, Any]]:
    """A chart's results, in the order the file gives them. A result carrying a `chart` is one the book hangs a
    table of its own off (Border Town Burning's Curious bloom), read here and written with the result."""
    if not isinstance(rows, list) or not rows:
        raise CommandError(f"{label}: the chart '{title}' needs at least one result.")
    results = []
    for row in rows:
        if not isinstance(row, dict) or not clean(row.get("result")):
            raise CommandError(f"{label}: each result on the chart '{title}' needs what was rolled.")
        result: dict[str, Any] = {
            "result": clean(row.get("result")),
            "name": clean(row.get("name")),
            "text": clean(row.get("text")),
        }
        if row.get("chart") is not None:
            under = f"{title}: {result['name'] or result['result']}"
            result["table"] = one_chart(row["chart"], under, label, name)
        results.append(result)
    return results


def read_source(name: str, label: str, folder: Path) -> Any:
    """One campaign's rules file, parsed."""
    path = folder / f"{name}.json"
    if not path.is_file():
        raise Skipped(label, f"its rules file {name}.json isn't there")
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as exc:
        raise CommandError(f"Unable to read the campaign rules {path}: {exc}") from exc


def write_charts(
    preset: CampaignPreset,
    charts: list[dict[str, Any]],
    owners: list[Any] | None = None,
    keep: bool = False,
    owner: str = "rule",
) -> None:
    """The preset's charts, written afresh with their results. With `owners`, each chart is that owner's own table
    (a rule's, or with `owner="location"` a location's); `keep` leaves the charts already written in place (the
    owners' tables are written after the standalone ones)."""
    if not keep:
        preset.charts.all().delete()
    for place, chart in enumerate(charts):
        rows = chart.pop("rows")
        held = {owner: owners[place]} if owners else {}
        written = CampaignPresetChart.objects.create(preset=preset, order=place, **held, **chart)
        tables = [row.pop("table", None) for row in rows]
        stored = CampaignPresetChartRow.objects.bulk_create(
            CampaignPresetChartRow(chart=written, order=index, **row) for index, row in enumerate(rows)
        )
        for row, table in zip(stored, tables, strict=True):
            if table is not None:
                write_row_table(preset, row, table)


def write_row_table(preset: CampaignPreset, row: CampaignPresetChartRow, table: dict[str, Any]) -> None:
    """The table the book hangs off one result, written under that result."""
    rows = table.pop("rows")
    written = CampaignPresetChart.objects.create(preset=preset, order=0, row=row, **table)
    CampaignPresetChartRow.objects.bulk_create(
        CampaignPresetChartRow(
            chart=written, order=index, **{key: value for key, value in entry.items() if key != "table"}
        )
        for index, entry in enumerate(rows)
    )
