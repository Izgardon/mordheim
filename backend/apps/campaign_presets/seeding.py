"""The campaign presets, read from the catalogue import's sources in place.

Each file in `catalogue_import/sources/campaign-presets/` is one published campaign: its slug (what the row is
upserted by), its name, the settings it guides the content choice towards, the structural settings it dictates and
the file in `sources/campaign-rules/` holding its rules. A field left out is a field the preset says nothing about,
so nothing is filled in from another preset or from the app's defaults: silence is data.

A preset naming a setting, a chart, a warband group or type or a rules file we do not hold is skipped with a warning
naming it, and never seeded half-built — a campaign that picked it would otherwise be told a chart or a setting it
cannot see. A preset
the folder drops is left where it is (as `seed_settings` leaves a dropped setting), because a campaign may have
picked it.
"""

import json
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from dataclasses import field as dataclass_field
from pathlib import Path
from typing import Any

from django.conf import settings as django_settings
from django.core.management.base import CommandError

from apps.campaigns.models import ENCAMPMENT_RULE, HERO_DEATH_ROLL_CHOICES, CampaignType
from apps.core.seeding import clean, parse_int
from apps.exploration.models import ExplorationChart
from apps.warbands.models import WarbandGroup, WarbandType

from .chart_sources import Skipped, one_chart, read_source, write_charts
from .encampment_seeding import merged_encampment_groups, read_encampment_groups, write_encampment_groups
from .location_seeding import merged_groups, read_location_groups, write_location_groups
from .models import (
    CampaignPreset,
    CampaignPresetChart,
    CampaignPresetEncampment,
    CampaignPresetLocation,
    CampaignPresetRule,
    CampaignPresetWarbandRule,
)
from .warband_rule_seeding import found_warband_rules, read_warband_rules, write_warband_rules

PRESET_SOURCES = Path(django_settings.BASE_DIR) / "catalogue_import" / "sources" / "campaign-presets"
RULE_SOURCES = Path(django_settings.BASE_DIR) / "catalogue_import" / "sources" / "campaign-rules"
FLAGS = ("enable_locations", "enable_encampments", "enable_campaign_points", "enable_blood_pacts")
DEATH_ROLLS = {key for key, _label in HERO_DEATH_ROLL_CHOICES}
KEYS = frozenset(
    {
        "slug",
        "name",
        "sort_order",
        "settings",
        "exploration_chart",
        "max_heroes",
        "hero_death_roll",
        "rules",
        "main_resource",
        "resources",
        "skill_wordings",
        *FLAGS,
    }
)


def read_presets(folder: Path = PRESET_SOURCES) -> list[dict[str, Any]]:
    """Every preset file in `folder`, by file name, each a JSON object."""
    if not folder.is_dir():
        raise CommandError(f"No campaign preset sources at {folder}")
    presets = []
    for path in sorted(folder.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except (OSError, ValueError) as exc:
            raise CommandError(f"Unable to read the campaign preset {path}: {exc}") from exc
        if not isinstance(data, dict):
            raise CommandError(f"The campaign preset {path} should hold an object.")
        unknown = sorted(set(data) - KEYS)
        if unknown:
            raise CommandError(f"The campaign preset {path} holds unknown fields: {', '.join(unknown)}.")
        presets.append(data)
    return presets


def _rules_of(rows: Any, kind: str, name: str, label: str) -> list[dict[str, str]]:
    """One list of rules from a source file, each given `kind`: a title, its text and its umbrella."""
    if not isinstance(rows, list):
        raise CommandError(
            f"{label}: {name}.json should hold a list of rules under each of rules, battle_rules and encampment_rules."
        )
    rules = []
    for row in rows:
        if not isinstance(row, dict) or not clean(row.get("title")):
            raise CommandError(f"{label}: each rule in {name}.json needs a title.")
        entry: dict[str, Any] = {
            "kind": kind,
            "title": clean(row.get("title")),
            "text": clean(row.get("text")),
            "umbrella": clean(row.get("umbrella")),
        }
        if row.get("chart") is not None:  # the rule's own table, not a chart of its own
            entry["table"] = one_chart(row["chart"], entry["title"], label, name)
        rules.append(entry)
    return rules


def read_rules(name: str, label: str, folder: Path = RULE_SOURCES) -> list[dict[str, Any]]:
    """The rules of `name.json` in `folder`, in its order: the campaign rules under `rules`, then the battle rules
    under `battle_rules` (William, 19 Nov 2026), then how its encampments are held under `encampment_rules` (William,
    24 Nov 2026). A plain list is read as campaign rules, as the first files held."""
    data = read_source(name, label, folder)
    rows = data.get("rules") if isinstance(data, dict) else data
    rules = _rules_of(rows, "campaign", name, label)
    for key, kind in (("battle_rules", "battle"), ("encampment_rules", ENCAMPMENT_RULE)):
        if isinstance(data, dict) and data.get(key) is not None:
            rules += _rules_of(data[key], kind, name, label)
    titles = [rule["title"].lower() for rule in rules]
    if len(set(titles)) != len(titles):
        raise CommandError(f"{label}: {name}.json holds two rules of the same title.")
    return rules


def read_charts(name: str, label: str, folder: Path = RULE_SOURCES) -> list[dict[str, Any]]:
    """The charts of `name.json`, in its order: each its title, when it is rolled, its dice and a row per result.
    A file with no `charts` key holds no charts, which is not the same as holding none we could read."""
    data = read_source(name, label, folder)
    rows = data.get("charts") if isinstance(data, dict) else None
    if rows is None:
        return []
    if not isinstance(rows, list):
        raise CommandError(f"{label}: charts in {name}.json should be a list.")
    charts: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict) or not clean(row.get("title")):
            raise CommandError(f"{label}: each chart in {name}.json needs a title.")
        charts.append(one_chart(row, clean(row.get("title")), label, name))
    titles = [chart["title"].lower() for chart in charts]
    if len(set(titles)) != len(titles):
        raise CommandError(f"{label}: {name}.json holds two charts of the same title.")
    return charts


def _flags(entry: Mapping[str, Any], label: str) -> dict[str, bool | None]:
    """The switches the preset dictates; a key it leaves out stays null (it says nothing)."""
    values: dict[str, bool | None] = {}
    for flag in FLAGS:
        stated = entry.get(flag)
        if stated is None:
            values[flag] = None
        elif isinstance(stated, bool):
            values[flag] = stated
        else:
            raise CommandError(f"{label}: {flag} should be true or false.")
    return values


def _rule_files(entry: Mapping[str, Any], label: str) -> list[str]:
    """The rules files it names: one name, or a list read in order; none for a campaign we hold no rules of."""
    named = entry.get("rules")
    if named is None or named == "":
        return []
    names = named if isinstance(named, list) else [named]
    if not all(isinstance(one, str) and one.strip() for one in names):
        raise CommandError(f"{label}: rules should name a file, or a list of files.")
    return [one.strip() for one in names]


def _unique(titles: list[str], label: str, what: str) -> None:
    """Two of its files must not hold the same title: both are copied into the same campaign."""
    lowered = [title.lower() for title in titles]
    if len(set(lowered)) != len(lowered):
        raise CommandError(f"{label}: its {what} files hold two of the same title.")


def _skill_wordings(entry: Mapping[str, Any], label: str) -> list[dict[str, str]]:
    """Its own wording of book skills, each {"skill", "description"}; matched by name when a campaign takes it up."""
    rows = entry.get("skill_wordings") or []
    wordings = []
    for row in rows if isinstance(rows, list) else [None]:
        if not isinstance(row, dict) or not clean(row.get("skill")) or not clean(row.get("description")):
            raise CommandError(f"{label}: each skill wording needs a skill and a description.")
        wordings.append({"skill": clean(row.get("skill")), "description": clean(row.get("description"))})
    return wordings


def _resources(entry: Mapping[str, Any], label: str) -> dict[str, Any]:
    """Its main resource (blank: it says nothing) and the others every warband is given, each a name."""
    others = entry.get("resources") or []
    if not isinstance(others, list) or not all(isinstance(name, str) and name.strip() for name in others):
        raise CommandError(f"{label}: resources should be a list of names.")
    return {"main_resource": clean(entry.get("main_resource")), "resources": [name.strip() for name in others]}


def _death_roll(entry: Mapping[str, Any], label: str) -> str:
    roll = clean(entry.get("hero_death_roll")).lower()
    if roll and roll not in DEATH_ROLLS:
        raise CommandError(f"{label}: hero_death_roll should be one of {', '.join(sorted(DEATH_ROLLS))}.")
    return roll


def _chart_id(entry: Mapping[str, Any], label: str, charts: Mapping[str, int]) -> int | None:
    slug = clean(entry.get("exploration_chart"))
    if not slug:
        return None
    if slug not in charts:
        raise Skipped(label, f"the exploration chart '{slug}' isn't seeded")
    return charts[slug]


def _setting_ids(entry: Mapping[str, Any], label: str, settings: Mapping[str, int]) -> list[int]:
    names = entry.get("settings") or []
    if not isinstance(names, list):
        raise CommandError(f"{label}: settings should be a list of setting names.")
    ids = []
    for name in names:
        cleaned = clean(name)
        if cleaned not in settings:
            raise Skipped(label, f"the setting '{cleaned}' isn't seeded")
        ids.append(settings[cleaned])
    return ids


def write_preset(
    entry: Mapping[str, Any],
    settings: Mapping[str, int],
    charts: Mapping[str, int],
    rule_folder: Path = RULE_SOURCES,
    warbands: tuple[Mapping[str, int], Mapping[str, int]] = ({}, {}),
) -> CampaignPreset:
    """Upsert one preset by slug, with its settings and its rules written afresh; `warbands` are the warband groups
    (by name, folded) and book warband types (by slug) its warband rules may name."""
    slug, name = clean(entry.get("slug")), clean(entry.get("name"))
    if not slug or not name:
        raise CommandError(f"A campaign preset needs a slug and a name: {entry.get('slug') or entry.get('name')}")
    # everything the preset names is found before anything is written, so a skipped preset leaves no half-built row;
    # its rules may come from several files, in order (Marienburg's, then the Annual's on top)
    named = _rule_files(entry, name)
    rules = [rule for one in named for rule in read_rules(one, name, rule_folder)]
    preset_charts = [chart for one in named for chart in read_charts(one, name, rule_folder)]
    _unique([rule["title"] for rule in rules], name, "rules")
    _unique([chart["title"] for chart in preset_charts], name, "charts")
    titles = {chart["title"].casefold() for chart in preset_charts}
    groups = merged_groups([read_location_groups(one, name, rule_folder) for one in named], name, titles)
    camps = merged_encampment_groups([read_encampment_groups(one, name, rule_folder) for one in named], name)
    warband_rules = [rule for one in named for rule in read_warband_rules(one, name, rule_folder)]
    warband_rules = found_warband_rules(warband_rules, name, *warbands)
    setting_ids = _setting_ids(entry, name, settings)
    defaults: dict[str, Any] = {
        "name": name,
        "sort_order": parse_int(entry.get("sort_order")),
        "exploration_chart_id": _chart_id(entry, name, charts),
        "max_heroes": None if entry.get("max_heroes") is None else parse_int(entry.get("max_heroes")),
        "hero_death_roll": _death_roll(entry, name),
        **_resources(entry, name),
        "skill_wordings": _skill_wordings(entry, name),
        **_flags(entry, name),
    }
    preset, _created = CampaignPreset.objects.update_or_create(slug=slug, defaults=defaults)
    preset.settings.set(setting_ids)
    preset.rules.all().delete()
    tables = [rule.pop("table", None) for rule in rules]
    written = CampaignPresetRule.objects.bulk_create(
        CampaignPresetRule(preset=preset, order=place, **rule) for place, rule in enumerate(rules)
    )
    write_charts(preset, preset_charts)
    # a rule's own table: the same chart rows, pointed at the rule rather than standing on their own
    write_charts(preset, [t for t in tables if t], [r for r, t in zip(written, tables, strict=True) if t], keep=True)
    write_location_groups(preset, groups)  # after the charts, which its locations point to by title
    write_encampment_groups(preset, camps)
    write_warband_rules(preset, warband_rules)
    return preset


@dataclass
class SeedResult:
    presets: int = 0
    rules: int = 0
    charts: int = 0
    skipped: list[str] = dataclass_field(default_factory=list)  # a preset naming something we don't hold, and why
    locations: int = 0
    warband_rules: int = 0
    encampments: int = 0


def seed_presets(folder: Path = PRESET_SOURCES, rule_folder: Path = RULE_SOURCES) -> SeedResult:
    """Write every source preset we hold everything for, skipping the rest with their reason."""
    settings = {row.name: row.pk for row in CampaignType.objects.all()}
    charts = {
        row.slug: row.pk for row in ExplorationChart.objects.filter(campaign__isnull=True).exclude(slug="") if row.slug
    }
    warbands = (
        {row.name.casefold(): row.pk for row in WarbandGroup.objects.all()},
        {row.slug: row.pk for row in WarbandType.objects.filter(campaign__isnull=True, archived_at__isnull=True)},
    )
    seen: list[int] = []
    skipped: list[str] = []
    for entry in read_presets(folder):
        try:
            seen.append(write_preset(entry, settings, charts, rule_folder, warbands).pk)
        except Skipped as skip:
            skipped.append(str(skip))
    locations = CampaignPresetLocation.objects.filter(group__preset_id__in=seen).count()
    warband_rules = CampaignPresetWarbandRule.objects.filter(preset_id__in=seen).count()
    encampments = CampaignPresetEncampment.objects.filter(group__preset_id__in=seen).count()
    return SeedResult(len(seen), _rule_count(seen), _chart_count(seen), skipped, locations, warband_rules, encampments)


def _rule_count(preset_ids: Iterable[int]) -> int:
    return CampaignPresetRule.objects.filter(preset_id__in=list(preset_ids)).count()


def _chart_count(preset_ids: Iterable[int]) -> int:
    return CampaignPresetChart.objects.filter(preset_id__in=list(preset_ids)).count()
