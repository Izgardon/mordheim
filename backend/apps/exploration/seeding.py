"""The book's exploration charts, read from the catalogue import's sources in place.

Each file in `catalogue_import/sources/exploration/` is one chart: its slug (what the book's row is upserted by),
its setting, its income table, its dice rule and its places with their rules text. A chart file the folder drops is
archived, as the other seeders archive a book entry the import drops; its places are written afresh every run.

A chart naming a setting we hold no `CampaignType` for is skipped with a warning, never seeded with none: an entry
with no setting is in play everywhere (apps/campaigns/in_play.py), which would put another world's chart into every
Mordheim campaign. An empty `income` is a chart that pays no wyrdstone at all (Albion's names a supply source
instead, written out in `income_note`): it is kept as it is, never filled in from another chart's table.
"""

import json
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from dataclasses import field as dataclass_field
from pathlib import Path
from typing import Any

from django.conf import settings as django_settings
from django.core.management.base import CommandError
from django.utils import timezone

from apps.campaigns.models import CampaignType
from apps.core.seeding import clean, parse_int

from .models import (
    DEFAULT_DICE_FOR_WIN,
    DEFAULT_DICE_PER_HERO,
    DEFAULT_MAX_CHOSEN,
    DEFAULT_MAX_DICE,
    ExplorationChart,
    ExplorationPlace,
)

EXPLORATION_SOURCES = Path(django_settings.BASE_DIR) / "catalogue_import" / "sources" / "exploration"
CHART_DEFAULTS = {  # the model's own, for a file that leaves one out
    "dice_per_hero": DEFAULT_DICE_PER_HERO,
    "dice_for_win": DEFAULT_DICE_FOR_WIN,
    "max_dice": DEFAULT_MAX_DICE,
    "max_chosen": DEFAULT_MAX_CHOSEN,
}
CHART_NUMBERS = tuple(CHART_DEFAULTS)


def read_charts(folder: Path = EXPLORATION_SOURCES) -> list[dict[str, Any]]:
    """Every chart file in `folder`, by file name, each a JSON object."""
    if not folder.is_dir():
        raise CommandError(f"No exploration chart sources at {folder}")
    charts = []
    for path in sorted(folder.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except (OSError, ValueError) as exc:
            raise CommandError(f"Unable to read the exploration chart {path}: {exc}") from exc
        if not isinstance(data, dict):
            raise CommandError(f"The exploration chart {path} should hold an object.")
        charts.append(data)
    return charts


def _income(rows: Any, label: str) -> list[dict[str, int | None]]:
    """The income table as the chart stores it: each band's highest total (null: any higher) and its shards. An
    empty list is a chart that pays no shards, and stays empty."""
    if rows is None:
        return []
    if not isinstance(rows, list):
        raise CommandError(f"{label}: income should be a list of bands.")
    table: list[dict[str, int | None]] = []
    for row in rows:
        if not isinstance(row, dict) or "amount" not in row:
            raise CommandError(f"{label}: each income band needs an amount.")
        total = row.get("max_total")
        table.append(
            {
                "max_total": None if total is None else parse_int(total),
                "amount": parse_int(row.get("amount")),
            }
        )
    return table


def _places(rows: Any, label: str) -> list[dict[str, Any]]:
    if not isinstance(rows, list):
        raise CommandError(f"{label}: places should be a list.")
    places = []
    for row in rows:
        if not isinstance(row, dict) or not clean(row.get("name")):
            raise CommandError(f"{label}: each place needs a name.")
        count, face = parse_int(row.get("count")), parse_int(row.get("face"))
        if not 2 <= count <= 6 or not 1 <= face <= 6:
            raise CommandError(f"{label}: {row.get('name')} has no count of 2-6 and face of 1-6.")
        places.append({"count": count, "face": face, "name": clean(row.get("name")), "rules": clean(row.get("rules"))})
    return places


def _setting_ids() -> Mapping[str, int]:
    return {row.name: row.pk for row in CampaignType.objects.all()}


class UnknownSetting(Exception):
    """The chart names a setting we hold no `CampaignType` for: it is skipped, never seeded without one."""

    def __init__(self, chart: str, setting: str) -> None:
        super().__init__(f"{chart}: the setting '{setting}' isn't seeded; the chart is skipped.")


def write_chart(entry: Mapping[str, Any], settings: Mapping[str, int]) -> ExplorationChart:
    """Upsert the book's chart by slug and write its places afresh."""
    slug = clean(entry.get("slug"))
    name = clean(entry.get("name"))
    if not slug or not name:
        raise CommandError(f"An exploration chart needs a slug and a name: {entry.get('slug') or entry.get('name')}")
    setting = clean(entry.get("setting"))
    if setting and setting not in settings:
        raise UnknownSetting(name, setting)
    defaults: dict[str, Any] = {
        "name": name,
        "campaign_type_id": settings.get(setting) if setting else None,
        "summary": clean(entry.get("summary")),
        "income": _income(entry.get("income"), name),
        "income_note": clean(entry.get("income_note")),
        "archived_at": None,
    }
    defaults.update({field: parse_int(entry.get(field), CHART_DEFAULTS[field]) for field in CHART_NUMBERS})
    chart, _created = ExplorationChart.objects.update_or_create(slug=slug, campaign=None, defaults=defaults)
    chart.places.all().delete()
    ExplorationPlace.objects.bulk_create(
        [ExplorationPlace(chart=chart, **place) for place in _places(entry.get("places"), name)]
    )
    return chart


def archive_dropped(seen: Iterable[int]) -> int:
    """Book charts the sources no longer hold are archived (never deleted: a campaign may have picked one)."""
    dropped = ExplorationChart.objects.filter(campaign__isnull=True, archived_at__isnull=True).exclude(
        pk__in=list(seen)
    )
    return dropped.update(archived_at=timezone.now())


@dataclass
class SeedResult:
    charts: int = 0
    places: int = 0
    archived: int = 0
    skipped: list[str] = dataclass_field(default_factory=list)  # a chart whose setting we don't hold, and why


def seed_book_charts(folder: Path = EXPLORATION_SOURCES) -> SeedResult:
    """Write every source chart whose setting we hold, skipping the rest with their reason."""
    settings = _setting_ids()
    seen: list[int] = []
    skipped: list[str] = []
    for entry in read_charts(folder):
        try:
            seen.append(write_chart(entry, settings).pk)
        except UnknownSetting as unknown:
            skipped.append(str(unknown))
    places = ExplorationPlace.objects.filter(chart_id__in=seen).count()
    return SeedResult(len(seen), places, archive_dropped(seen), skipped)
