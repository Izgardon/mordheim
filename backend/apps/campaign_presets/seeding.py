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

from apps.campaigns.models import HERO_DEATH_ROLL_CHOICES, CampaignType
from apps.core.seeding import clean, parse_int
from apps.exploration.models import ExplorationChart

from .models import CampaignPreset, CampaignPresetRule

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


def read_rules(name: str, label: str, folder: Path = RULE_SOURCES) -> list[dict[str, str]]:
    """The rules of `name.json` in `folder`, in its order: each a title and its text."""
    path = folder / f"{name}.json"
    if not path.is_file():
        raise Skipped(label, f"its rules file {name}.json isn't there")
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as exc:
        raise CommandError(f"Unable to read the campaign rules {path}: {exc}") from exc
    rows = data.get("rules") if isinstance(data, dict) else data
    if not isinstance(rows, list):
        raise CommandError(f"The campaign rules {path} should hold a list of rules.")
    rules = []
    for row in rows:
        if not isinstance(row, dict) or not clean(row.get("title")):
            raise CommandError(f"{label}: each rule in {name}.json needs a title.")
        rules.append({"title": clean(row.get("title")), "text": clean(row.get("text"))})
    titles = [rule["title"].lower() for rule in rules]
    if len(set(titles)) != len(titles):
        raise CommandError(f"{label}: {name}.json holds two rules of the same title.")
    return rules


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
    CampaignPresetRule.objects.bulk_create(
        CampaignPresetRule(preset=preset, order=place, **rule) for place, rule in enumerate(rules)
    )
    return preset


@dataclass
class SeedResult:
    presets: int = 0
    rules: int = 0
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
    return SeedResult(len(seen), _rule_count(seen), skipped)


def _rule_count(preset_ids: Iterable[int]) -> int:
    return CampaignPresetRule.objects.filter(preset_id__in=list(preset_ids)).count()
