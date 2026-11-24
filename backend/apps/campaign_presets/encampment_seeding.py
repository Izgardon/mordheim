"""A published campaign's encampments, read from the `encampment_groups` of each rules file it names (William, 24 Nov
2026; the shape is the rules files' README). Its holding rules are the file's `encampment_rules`, read with the
other rules (`seeding.read_rules`) as rules of kind `encampment`.

A group is a name, a description and its encampments; an encampment is its name, how it is gained (one short line),
whether it is fortified and what holding it gives. Group names are unique in a file and encampment names in the
preset. When a preset reads several files, groups of one name are one group: the later file's encampments join the
earlier file's, which keeps its description.

A bad file stops the run (`CommandError`), naming the preset and the place: a name missing, a name used twice, a
value of the wrong type.
"""

from pathlib import Path
from typing import Any

from django.core.management.base import CommandError

from apps.core.seeding import clean

from .chart_sources import read_source
from .models import CampaignPreset, CampaignPresetEncampment, CampaignPresetEncampmentGroup

FIELDS = ("name", "gained_by", "fortified", "text")


def _words(row: dict[str, Any], key: str, label: str, place: str) -> str:
    value = row.get(key)
    if value is not None and not isinstance(value, str):
        raise CommandError(f"{label}: {key} on {place} should be text.")
    return clean(value)


def _encampment(row: Any, label: str, group: str) -> dict[str, Any]:
    if not isinstance(row, dict) or not isinstance(row.get("name"), str) or not clean(row.get("name")):
        raise CommandError(f"{label}: each encampment in {group} needs a name.")
    place = clean(row["name"])
    fortified = row.get("fortified", False)
    if not isinstance(fortified, bool):
        raise CommandError(f"{label}: fortified on {place} should be true or false.")
    gained_by, text = _words(row, "gained_by", label, place), _words(row, "text", label, place)
    if not gained_by or not text:
        raise CommandError(f"{label}: {place} needs gained_by and text.")
    return {"name": place, "gained_by": gained_by, "fortified": fortified, "text": text}


def read_encampment_groups(name: str, label: str, folder: Path) -> list[dict[str, Any]]:
    """The encampment groups of `name.json`, in its order; [] for a file with none."""
    data = read_source(name, label, folder)
    rows = data.get("encampment_groups") if isinstance(data, dict) else None
    if rows is None:
        return []
    if not isinstance(rows, list):
        raise CommandError(f"{label}: encampment_groups in {name}.json should be a list.")
    groups: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("name"), str) or not clean(row.get("name")):
            raise CommandError(f"{label}: each encampment group in {name}.json needs a name.")
        group = clean(row["name"])
        places = row.get("encampments", [])
        if not isinstance(places, list):
            raise CommandError(f"{label}: encampments in {group} should be a list.")
        groups.append(
            {
                "name": group,
                "description": _words(row, "description", label, group),
                "encampments": [_encampment(place, label, group) for place in places],
            }
        )
    names = [group["name"].casefold() for group in groups]
    if len(set(names)) != len(names):
        raise CommandError(f"{label}: {name}.json holds two encampment groups of the same name.")
    return groups


def merged_encampment_groups(files: list[list[dict[str, Any]]], label: str) -> list[dict[str, Any]]:
    """The groups of every file the preset reads, in order, those of one name merged; then each encampment's name
    is checked unique in the preset."""
    merged: dict[str, dict[str, Any]] = {}
    for groups in files:
        for group in groups:
            held = merged.setdefault(group["name"].casefold(), {**group, "encampments": []})
            held["encampments"] += group["encampments"]
    groups = list(merged.values())
    names = [place["name"].casefold() for group in groups for place in group["encampments"]]
    if len(set(names)) != len(names):
        raise CommandError(f"{label}: its rules files hold two encampments of the same name.")
    return groups


def write_encampment_groups(preset: CampaignPreset, groups: list[dict[str, Any]]) -> None:
    """The preset's encampment groups and their encampments, written afresh (two INSERTs)."""
    preset.encampment_groups.all().delete()
    if not groups:
        return
    stored = CampaignPresetEncampmentGroup.objects.bulk_create(
        CampaignPresetEncampmentGroup(preset=preset, order=place, name=group["name"], description=group["description"])
        for place, group in enumerate(groups)
    )
    CampaignPresetEncampment.objects.bulk_create(
        CampaignPresetEncampment(group=row, order=index, **{key: place[key] for key in FIELDS})
        for row, group in zip(stored, groups, strict=True)
        for index, place in enumerate(group["encampments"])
    )
