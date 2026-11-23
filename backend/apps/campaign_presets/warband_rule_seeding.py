"""A published campaign's warband rules, read from the `warband_rules` of each rules file it names (William, 23 Nov
2026; the shape is the rules files' README).

A warband rule is a title, its text and whom it is for: warband groups by name ("Dwarfs", "Skaven") and warband types
by slug ("witch-hunters"), at least one of either. A preset reading several files reads every file's, in order, and no
title may repeat across them. A group or type we do not hold skips the preset (`Skipped`), as a setting does, rather
than seeding it with a rule for nobody; a bad file stops the run (`CommandError`).
"""

from collections.abc import Mapping
from pathlib import Path
from typing import Any

from django.core.management.base import CommandError

from apps.core.seeding import clean

from .chart_sources import Skipped, read_source
from .models import CampaignPreset, CampaignPresetWarbandRule


def _names(row: Mapping[str, Any], key: str, label: str, title: str) -> list[str]:
    named = row.get(key) or []
    if not isinstance(named, list) or not all(isinstance(one, str) and one.strip() for one in named):
        raise CommandError(f"{label}: {key} on the warband rule '{title}' should be a list of names.")
    return [one.strip() for one in named]


def read_warband_rules(name: str, label: str, folder: Path) -> list[dict[str, Any]]:
    """The warband rules of `name.json`, in its order; [] for a file with none."""
    data = read_source(name, label, folder)
    rows = data.get("warband_rules") if isinstance(data, dict) else None
    if rows is None:
        return []
    if not isinstance(rows, list):
        raise CommandError(f"{label}: warband_rules in {name}.json should be a list.")
    rules: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict) or not clean(row.get("title")):
            raise CommandError(f"{label}: each warband rule in {name}.json needs a title.")
        title = clean(row.get("title"))
        groups, types = _names(row, "groups", label, title), _names(row, "types", label, title)
        if not groups and not types:
            raise CommandError(f"{label}: the warband rule '{title}' should name at least one group or type.")
        rules.append({"title": title, "text": clean(row.get("text")), "groups": groups, "types": types})
    return rules


def found_warband_rules(
    rules: list[dict[str, Any]], label: str, groups: Mapping[str, int], types: Mapping[str, int]
) -> list[dict[str, Any]]:
    """Each rule with the ids of the groups (by name, any case) and book types (by slug) it names; a title used twice
    across the preset's files stops the run, and a name we don't hold skips the preset."""
    titles = [rule["title"].casefold() for rule in rules]
    if len(set(titles)) != len(titles):
        raise CommandError(f"{label}: its rules files hold two warband rules of the same title.")
    found = []
    for rule in rules:
        group_ids, type_ids = [], []
        for name in rule["groups"]:
            if name.casefold() not in groups:
                raise Skipped(label, f"the warband group '{name}' isn't seeded")
            group_ids.append(groups[name.casefold()])
        for slug in rule["types"]:
            if slug not in types:
                raise Skipped(label, f"the warband type '{slug}' isn't seeded")
            type_ids.append(types[slug])
        found.append({"title": rule["title"], "text": rule["text"], "group_ids": group_ids, "type_ids": type_ids})
    return found


def write_warband_rules(preset: CampaignPreset, rules: list[dict[str, Any]]) -> None:
    """The preset's warband rules and whom each is for, written afresh."""
    preset.warband_rules.all().delete()
    if not rules:
        return
    stored = CampaignPresetWarbandRule.objects.bulk_create(
        CampaignPresetWarbandRule(preset=preset, order=place, title=rule["title"], text=rule["text"])
        for place, rule in enumerate(rules)
    )
    pairs = list(zip(stored, rules, strict=True))
    CampaignPresetWarbandRule.warband_groups.through.objects.bulk_create(
        CampaignPresetWarbandRule.warband_groups.through(campaignpresetwarbandrule_id=row.pk, warbandgroup_id=one)
        for row, rule in pairs
        for one in rule["group_ids"]
    )
    CampaignPresetWarbandRule.warband_types.through.objects.bulk_create(
        CampaignPresetWarbandRule.warband_types.through(campaignpresetwarbandrule_id=row.pk, warbandtype_id=one)
        for row, rule in pairs
        for one in rule["type_ids"]
    )
