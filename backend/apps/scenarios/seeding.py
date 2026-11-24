"""The book's scenarios, read from the catalogue import's `out/scenarios.json` in place (catalogue_import/scenarios.py
builds it from mordheimer's pages).

A scenario is upserted by slug with its sections written afresh every run, and a book scenario the import drops is
archived, as the other seeders archive a book entry the import drops (never deleted: a campaign may list one, and its
battles name it). A setting's scenarios (`SettingScenario`) are written afresh from the import's tables; a table
naming a setting we hold no `CampaignType` for is skipped with a warning naming it, never seeded with none. A
campaign's own list is never read or written: a campaign made before a scenario was seeded gets it by ticking a
setting that adds it, or by a manager's add.
"""

import json
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from dataclasses import field as dataclass_field
from decimal import Decimal
from pathlib import Path
from typing import Any

from django.conf import settings as django_settings
from django.core.management.base import CommandError
from django.utils import timezone

from apps.campaigns.models import CampaignType
from apps.core.seeding import clean

from .models import PLAYERS, Scenario, SettingScenario

SCENARIO_OUT = Path(django_settings.BASE_DIR) / "catalogue_import" / "out" / "scenarios.json"
PLAYER_VALUES = frozenset(value for value, _ in PLAYERS)


def read_import(path: Path = SCENARIO_OUT) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise CommandError(f"Unable to read the scenarios {path}: {exc}") from exc
    if not isinstance(data, dict) or not isinstance(data.get("scenarios"), list):
        raise CommandError(f"The scenarios {path} should hold a list of scenarios.")
    return data


def _sections(rows: Any, label: str) -> list[dict[str, Any]]:
    if not isinstance(rows, list) or not all(isinstance(row, dict) and clean(row.get("title")) for row in rows):
        raise CommandError(f"{label}: each section needs its title.")
    return [
        {"title": clean(row["title"]), "text": clean(row.get("text")), "tables": row.get("tables") or []}
        for row in rows
    ]


def write_scenario(entry: Mapping[str, Any]) -> Scenario:
    slug, name = clean(entry.get("slug")), clean(entry.get("name"))
    if not slug or not name:
        raise CommandError(f"A scenario needs a slug and a name: {entry.get('slug') or entry.get('name')}")
    players = clean(entry.get("players"))
    if players not in PLAYER_VALUES:
        raise CommandError(f"{name}: players should be one of {', '.join(sorted(PLAYER_VALUES))}.")
    defaults = {
        "name": name,
        "number": clean(entry.get("number")),
        "source": clean(entry.get("source")),
        "players": players,
        "summary": clean(entry.get("summary")),
        "intro": clean(entry.get("intro")),
        "sections": _sections(entry.get("sections"), name),
        "archived_at": None,
    }
    scenario, _created = Scenario.objects.update_or_create(slug=slug, campaign=None, defaults=defaults)
    return scenario


def archive_dropped(seen: Iterable[int]) -> int:
    dropped = Scenario.objects.filter(campaign__isnull=True, archived_at__isnull=True).exclude(pk__in=list(seen))
    return dropped.update(archived_at=timezone.now())


def write_settings(tables: Any, by_slug: Mapping[str, int]) -> tuple[int, list[str]]:
    """Each table's scenarios at its weights, for its setting: the settings' rows written afresh."""
    settings = {row.name: row.pk for row in CampaignType.objects.all()}
    rows: dict[tuple[int, int], Decimal] = {}
    skipped = []
    for table in tables if isinstance(tables, list) else []:
        setting = clean(table.get("setting"))
        if setting not in settings:
            skipped.append(f"{table.get('table')}: the setting '{setting}' isn't seeded; its scenarios are skipped.")
            continue
        for row in table.get("scenarios", []):
            scenario = by_slug.get(clean(row.get("slug")))
            if scenario is None:
                raise CommandError(f"{table.get('table')}: no scenario {row.get('slug')}")
            rows[(settings[setting], scenario)] = Decimal(str(row["weight"]))
    SettingScenario.objects.filter(scenario__campaign__isnull=True).delete()
    SettingScenario.objects.bulk_create(
        [SettingScenario(setting_id=setting, scenario_id=pk, weight=weight) for (setting, pk), weight in rows.items()]
    )
    return len(rows), skipped


@dataclass
class SeedResult:
    scenarios: int = 0
    archived: int = 0
    setting_links: int = 0
    skipped: list[str] = dataclass_field(default_factory=list)


def seed_book_scenarios(path: Path = SCENARIO_OUT) -> SeedResult:
    data = read_import(path)
    by_slug = {}
    for entry in data["scenarios"]:
        scenario = write_scenario(entry)
        by_slug[scenario.slug] = scenario.pk
    links, skipped = write_settings(data.get("settings"), by_slug)
    return SeedResult(len(by_slug), archive_dropped(by_slug.values()), links, skipped)
