"""The campaign presets, read from the catalogue import's sources in place.

Each file in `catalogue_import/sources/campaign-presets/` is one published campaign: its slug (what the row is
upserted by), its name, the settings it guides the content choice towards, the structural settings it dictates and
the file in `sources/campaign-rules/` holding its rules. A field left out is a field the preset says nothing about,
so nothing is filled in from another preset or from the app's defaults: silence is data.

A preset naming a setting, a chart or a rules file we do not hold is skipped with a warning naming it, and never
seeded half-built — a campaign that picked it would otherwise be told a chart or a setting it cannot see. A preset
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

from apps.campaigns.models import CHART_DICE, HERO_DEATH_ROLL_CHOICES, CampaignType
from apps.core.seeding import clean, parse_int
from apps.exploration.models import ExplorationChart

from .models import CampaignPreset, CampaignPresetChart, CampaignPresetChartRow, CampaignPresetRule

PRESET_SOURCES = Path(django_settings.BASE_DIR) / "catalogue_import" / "sources" / "campaign-presets"
RULE_SOURCES = Path(django_settings.BASE_DIR) / "catalogue_import" / "sources" / "campaign-rules"
FLAGS = ("enable_locations", "enable_encampments", "enable_campaign_points", "enable_blood_pacts")
DEATH_ROLLS = {key for key, _label in HERO_DEATH_ROLL_CHOICES}
KEYS = frozenset(
    {"slug", "name", "sort_order", "settings", "exploration_chart", "max_heroes", "hero_death_roll", "rules", *FLAGS}
)


class Skipped(Exception):
    """The preset names something we do not hold: it is skipped, never seeded without it."""

    def __init__(self, preset: str, reason: str) -> None:
        super().__init__(f"{preset}: {reason}; the preset is skipped.")


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
        raise CommandError(f"{label}: {name}.json should hold a list of rules under each of rules and battle_rules.")
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
            entry["table"] = _one_chart(row["chart"], entry["title"], label, name)
        rules.append(entry)
    return rules


def _one_chart(row: Any, title: str, label: str, name: str) -> dict[str, Any]:
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
        "rows": _chart_rows(row.get("rows"), title, label, name),
    }


def read_rules(name: str, label: str, folder: Path = RULE_SOURCES) -> list[dict[str, Any]]:
    """The rules of `name.json` in `folder`, in its order: the campaign rules under `rules`, then the battle rules
    under `battle_rules` (William, 19 Nov 2026). A plain list is read as campaign rules, as the first files held."""
    data = _read_source(name, label, folder)
    rows = data.get("rules") if isinstance(data, dict) else data
    rules = _rules_of(rows, "campaign", name, label)
    if isinstance(data, dict) and data.get("battle_rules") is not None:
        rules += _rules_of(data["battle_rules"], "battle", name, label)
    titles = [rule["title"].lower() for rule in rules]
    if len(set(titles)) != len(titles):
        raise CommandError(f"{label}: {name}.json holds two rules of the same title.")
    return rules


def read_charts(name: str, label: str, folder: Path = RULE_SOURCES) -> list[dict[str, Any]]:
    """The charts of `name.json`, in its order: each its title, when it is rolled, its dice and a row per result.
    A file with no `charts` key holds no charts, which is not the same as holding none we could read."""
    data = _read_source(name, label, folder)
    rows = data.get("charts") if isinstance(data, dict) else None
    if rows is None:
        return []
    if not isinstance(rows, list):
        raise CommandError(f"{label}: charts in {name}.json should be a list.")
    charts: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict) or not clean(row.get("title")):
            raise CommandError(f"{label}: each chart in {name}.json needs a title.")
        charts.append(_one_chart(row, clean(row.get("title")), label, name))
    titles = [chart["title"].lower() for chart in charts]
    if len(set(titles)) != len(titles):
        raise CommandError(f"{label}: {name}.json holds two charts of the same title.")
    return charts


def _chart_rows(rows: Any, title: str, label: str, name: str) -> list[dict[str, Any]]:
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
            result["table"] = _one_chart(row["chart"], under, label, name)
        results.append(result)
    return results


def _read_source(name: str, label: str, folder: Path) -> Any:
    """One campaign's rules file, parsed."""
    path = folder / f"{name}.json"
    if not path.is_file():
        raise Skipped(label, f"its rules file {name}.json isn't there")
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as exc:
        raise CommandError(f"Unable to read the campaign rules {path}: {exc}") from exc


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
) -> CampaignPreset:
    """Upsert one preset by slug, with its settings and its rules written afresh."""
    slug, name = clean(entry.get("slug")), clean(entry.get("name"))
    if not slug or not name:
        raise CommandError(f"A campaign preset needs a slug and a name: {entry.get('slug') or entry.get('name')}")
    # everything the preset names is found before anything is written, so a skipped preset leaves no half-built row
    named = clean(entry.get("rules"))
    rules = read_rules(named, name, rule_folder) if named else []
    preset_charts = read_charts(named, name, rule_folder) if named else []
    setting_ids = _setting_ids(entry, name, settings)
    defaults: dict[str, Any] = {
        "name": name,
        "sort_order": parse_int(entry.get("sort_order")),
        "exploration_chart_id": _chart_id(entry, name, charts),
        "max_heroes": None if entry.get("max_heroes") is None else parse_int(entry.get("max_heroes")),
        "hero_death_roll": _death_roll(entry, name),
        **_flags(entry, name),
    }
    preset, _created = CampaignPreset.objects.update_or_create(slug=slug, defaults=defaults)
    preset.settings.set(setting_ids)
    preset.rules.all().delete()
    tables = [rule.pop("table", None) for rule in rules]
    written = CampaignPresetRule.objects.bulk_create(
        CampaignPresetRule(preset=preset, order=place, **rule) for place, rule in enumerate(rules)
    )
    _write_charts(preset, preset_charts)
    # a rule's own table: the same chart rows, pointed at the rule rather than standing on their own
    _write_charts(preset, [t for t in tables if t], [r for r, t in zip(written, tables, strict=True) if t], keep=True)
    return preset


def _write_charts(
    preset: CampaignPreset,
    charts: list[dict[str, Any]],
    rules: list[Any] | None = None,
    keep: bool = False,
) -> None:
    """The preset's charts, written afresh with their results. With `rules`, each chart is that rule's own table;
    `keep` leaves the charts already written in place (the rules' tables are written after the standalone ones)."""
    if not keep:
        preset.charts.all().delete()
    for place, chart in enumerate(charts):
        rows = chart.pop("rows")
        written = CampaignPresetChart.objects.create(
            preset=preset, order=place, rule=rules[place] if rules else None, **chart
        )
        tables = [row.pop("table", None) for row in rows]
        stored = CampaignPresetChartRow.objects.bulk_create(
            CampaignPresetChartRow(chart=written, order=index, **row) for index, row in enumerate(rows)
        )
        for row, table in zip(stored, tables, strict=True):
            if table is not None:
                _write_row_table(preset, row, table)


def _write_row_table(preset: CampaignPreset, row: CampaignPresetChartRow, table: dict[str, Any]) -> None:
    """The table the book hangs off one result, written under that result."""
    rows = table.pop("rows")
    written = CampaignPresetChart.objects.create(preset=preset, order=0, row=row, **table)
    CampaignPresetChartRow.objects.bulk_create(
        CampaignPresetChartRow(
            chart=written, order=index, **{key: value for key, value in entry.items() if key != "table"}
        )
        for index, entry in enumerate(rows)
    )


@dataclass
class SeedResult:
    presets: int = 0
    rules: int = 0
    charts: int = 0
    skipped: list[str] = dataclass_field(default_factory=list)  # a preset naming something we don't hold, and why


def seed_presets(folder: Path = PRESET_SOURCES, rule_folder: Path = RULE_SOURCES) -> SeedResult:
    """Write every source preset we hold everything for, skipping the rest with their reason."""
    settings = {row.name: row.pk for row in CampaignType.objects.all()}
    charts = {
        row.slug: row.pk for row in ExplorationChart.objects.filter(campaign__isnull=True).exclude(slug="") if row.slug
    }
    seen: list[int] = []
    skipped: list[str] = []
    for entry in read_presets(folder):
        try:
            seen.append(write_preset(entry, settings, charts, rule_folder).pk)
        except Skipped as skip:
            skipped.append(str(skip))
    return SeedResult(len(seen), _rule_count(seen), _chart_count(seen), skipped)


def _rule_count(preset_ids: Iterable[int]) -> int:
    return CampaignPresetRule.objects.filter(preset_id__in=list(preset_ids)).count()


def _chart_count(preset_ids: Iterable[int]) -> int:
    return CampaignPresetChart.objects.filter(preset_id__in=list(preset_ids)).count()
