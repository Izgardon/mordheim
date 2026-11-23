"""A published campaign's locations, read from the `location_groups` of each rules file it names (William, 23 Nov
2026; the shape is the rules files' README).

A group is a name, a description, restrictions as text the player reads and its locations; a location is its rules,
how many heroes go (a whole number, or "all": every hero the warband has), whether going takes the trading action,
its own tables (a chart's shape, shown only inside it) and the titles of the preset's charts it points to. Group
names are unique in a file and location names in the preset. When a preset reads several files, groups of one name
are one group: the later file's locations join the earlier file's, which keeps its description and restrictions.

A bad file stops the run (`CommandError`): a die we lack, a count that is not one, min above max, a name used twice,
a chart title the preset holds no chart of.
"""

from pathlib import Path
from typing import Any

from django.core.management.base import CommandError

from apps.core.seeding import clean

from .chart_sources import one_chart, read_source, write_charts
from .models import (
    CampaignPreset,
    CampaignPresetLocation,
    CampaignPresetLocationChart,
    CampaignPresetLocationGroup,
)

ALL = "all"


def _count(value: Any, label: str, place: str, field: str) -> int | None:
    """A whole number of heroes from 1, or None for "all"."""
    if isinstance(value, str) and value.strip().lower() == ALL:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise CommandError(f'{label}: {field} on {place} should be a whole number from 1, or "all".')
    return int(value)


def _location(row: Any, label: str, name: str) -> dict[str, Any]:
    if not isinstance(row, dict) or not clean(row.get("name")):
        raise CommandError(f"{label}: each location in {name}.json needs a name.")
    place = clean(row.get("name"))
    low = _count(row.get("min_heroes", 1), label, place, "min_heroes")
    high = _count(row.get("max_heroes", 1), label, place, "max_heroes")
    if high is not None and (low is None or low > high):
        raise CommandError(f"{label}: {place} takes more heroes at least than at most.")
    trading = row.get("trading_action", False)
    tables, charts = row.get("tables") or [], row.get("charts") or []
    if not isinstance(trading, bool) or not isinstance(tables, list) or not isinstance(charts, list):
        raise CommandError(f"{label}: {place} should give trading_action as true or false, and lists of tables.")
    if not all(isinstance(title, str) and title.strip() for title in charts):
        raise CommandError(f"{label}: {place} should name each chart it points to by its title.")
    return {
        "name": place,
        "rules": clean(row.get("rules")),
        "min_heroes": low,
        "max_heroes": high,
        "takes_trading_action": trading,
        "tables": [one_chart(table, place, label, name) for table in tables],
        "charts": [title.strip() for title in charts],
    }


def read_location_groups(name: str, label: str, folder: Path) -> list[dict[str, Any]]:
    """The location groups of `name.json`, in its order; [] for a file with none."""
    data = read_source(name, label, folder)
    rows = data.get("location_groups") if isinstance(data, dict) else None
    if rows is None:
        return []
    if not isinstance(rows, list):
        raise CommandError(f"{label}: location_groups in {name}.json should be a list.")
    groups: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict) or not clean(row.get("name")) or not isinstance(row.get("locations", []), list):
            raise CommandError(f"{label}: each location group in {name}.json needs a name and a list of locations.")
        places = [_location(place, label, name) for place in row.get("locations", [])]
        groups.append(
            {
                "name": clean(row.get("name")),
                "description": clean(row.get("description")),
                "restrictions": clean(row.get("restrictions")),
                "locations": places,
            }
        )
    names = [group["name"].casefold() for group in groups]
    if len(set(names)) != len(names):
        raise CommandError(f"{label}: {name}.json holds two location groups of the same name.")
    return groups


def merged_groups(files: list[list[dict[str, Any]]], label: str, chart_titles: set[str]) -> list[dict[str, Any]]:
    """The groups of every file the preset reads, in order, those of one name merged; then each location's name is
    checked unique in the preset and each chart it points to found among the preset's charts."""
    merged: dict[str, dict[str, Any]] = {}
    for groups in files:
        for group in groups:
            held = merged.setdefault(group["name"].casefold(), {**group, "locations": []})
            held["locations"] += group["locations"]
    groups = list(merged.values())
    places = [place for group in groups for place in group["locations"]]
    names = [place["name"].casefold() for place in places]
    if len(set(names)) != len(names):
        raise CommandError(f"{label}: its rules files hold two locations of the same name.")
    for place in places:
        for title in place["charts"]:
            if title.casefold() not in chart_titles:
                raise CommandError(f"{label}: {place['name']} points to the chart '{title}', which it doesn't hold.")
    return groups


def write_location_groups(preset: CampaignPreset, groups: list[dict[str, Any]]) -> None:
    """The preset's groups, locations, their own tables and chart links, written afresh, after its charts."""
    preset.location_groups.all().delete()
    if not groups:
        return
    stored = CampaignPresetLocationGroup.objects.bulk_create(
        CampaignPresetLocationGroup(
            preset=preset,
            order=place,
            name=group["name"],
            description=group["description"],
            restrictions=group["restrictions"],
        )
        for place, group in enumerate(groups)
    )
    sources = [(row, place) for row, group in zip(stored, groups, strict=True) for place in group["locations"]]
    locations = CampaignPresetLocation.objects.bulk_create(
        CampaignPresetLocation(
            group=row,
            order=index,
            **{key: place[key] for key in ("name", "rules", "min_heroes", "max_heroes", "takes_trading_action")},
        )
        for row, group in zip(stored, groups, strict=True)
        for index, place in enumerate(group["locations"])
    )
    owned = [
        (location, table) for location, (_, place) in zip(locations, sources, strict=True) for table in place["tables"]
    ]
    write_charts(
        preset, [table for _, table in owned], [location for location, _ in owned], keep=True, owner="location"
    )
    charts = {chart.title.casefold(): chart for chart in preset.charts.all() if chart.is_standalone}
    CampaignPresetLocationChart.objects.bulk_create(
        CampaignPresetLocationChart(location=location, chart=charts[title.casefold()], order=index)
        for location, (_, place) in zip(locations, sources, strict=True)
        for index, title in enumerate(place["charts"])
    )
