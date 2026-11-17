"""The book's plots, read from the catalogue import's sources in place.

Each file in `catalogue_import/sources/plots/` is one setting's plots (its README holds the shape): a list of plots,
or an object with them under `plots`. A plot is upserted by slug, its scoring lines and its ladder written afresh
every run, and a plot the sources drop is archived, as the other seeders archive a book entry the import drops.

A plot naming a setting we hold no `CampaignType` for is skipped with a warning naming it, never seeded with none: an
entry with no setting is in play everywhere (apps/campaigns/in_play.py), which would put another world's plots into
every Mordheim campaign. Every plot carries its own name, and the unique name per campaign is left to do its job: a
file whose plots are not distinctly named is refused rather than half-seeded.
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

from .models import Plot, PlotAchievement, PlotScoringLine

PLOT_SOURCES = Path(django_settings.BASE_DIR) / "catalogue_import" / "sources" / "plots"


def read_plots(folder: Path = PLOT_SOURCES) -> list[dict[str, Any]]:
    """Every plot in every file in `folder`, in file and then book order."""
    if not folder.is_dir():
        raise CommandError(f"No plot sources at {folder}")
    plots: list[dict[str, Any]] = []
    for path in sorted(folder.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except (OSError, ValueError) as exc:
            raise CommandError(f"Unable to read the plots {path}: {exc}") from exc
        entries = data.get("plots") if isinstance(data, dict) else data
        if not isinstance(entries, list):
            raise CommandError(f"The plots {path} should hold a list of plots.")
        plots.extend(entry for entry in entries if isinstance(entry, dict))
    return plots


def _scoring(rows: Any, label: str) -> list[dict[str, Any]]:
    """The plot's scoring lines in the book's order: a flat number of points (null with a die) and its text."""
    if rows is None:
        return []
    if not isinstance(rows, list):
        raise CommandError(f"{label}: scoring should be a list of lines.")
    lines = []
    for position, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            raise CommandError(f"{label}: each scoring line should be an object.")
        points = row.get("points")
        lines.append(
            {
                "position": position,
                "points": None if points is None else parse_int(points),
                "dice": clean(row.get("dice")),
                "text": clean(row.get("text")),
            }
        )
    return lines


def _achievements(rows: Any, label: str) -> list[dict[str, Any]]:
    """The plot's ladder: one rung per campaign point total (the book's seven skip 30, which is the book)."""
    if rows is None:
        return []
    if not isinstance(rows, list):
        raise CommandError(f"{label}: achievements should be a list of rungs.")
    rungs = []
    for row in rows:
        if not isinstance(row, dict) or row.get("points") is None:
            raise CommandError(f"{label}: each achievement needs its points.")
        rungs.append(
            {"points": parse_int(row.get("points")), "name": clean(row.get("name")), "text": clean(row.get("text"))}
        )
    return rungs


def _setting_ids() -> Mapping[str, int]:
    return {row.name: row.pk for row in CampaignType.objects.all()}


class UnknownSetting(Exception):
    """The plot names a setting we hold no `CampaignType` for: it is skipped, never seeded without one."""

    def __init__(self, plot: str, setting: str) -> None:
        super().__init__(f"{plot}: the setting '{setting}' isn't seeded; the plot is skipped.")


def write_plot(entry: Mapping[str, Any], settings: Mapping[str, int]) -> Plot:
    """Upsert the book's plot by slug and write its scoring lines and its ladder afresh."""
    slug, name = clean(entry.get("slug")), clean(entry.get("name"))
    if not slug or not name:
        raise CommandError(f"A plot needs a slug and a name: {entry.get('slug') or entry.get('name')}")
    setting = clean(entry.get("setting"))
    if setting and setting not in settings:
        raise UnknownSetting(name, setting)
    alliances = entry.get("no_alliance_with") or []
    defaults: dict[str, Any] = {
        "name": name,
        "campaign_type_id": settings.get(setting) if setting else None,
        "summary": clean(entry.get("summary")),
        "who_text": clean(entry.get("who_text")),
        "variant_of": clean(entry.get("variant_of")),
        "no_alliance_with": [clean(slug) for slug in alliances] if isinstance(alliances, list) else [],
        "archived_at": None,
    }
    plot, _created = Plot.objects.update_or_create(slug=slug, campaign=None, defaults=defaults)
    plot.scoring_lines.all().delete()
    plot.achievements.all().delete()
    PlotScoringLine.objects.bulk_create(
        [PlotScoringLine(plot=plot, **line) for line in _scoring(entry.get("scoring"), name)]
    )
    PlotAchievement.objects.bulk_create(
        [PlotAchievement(plot=plot, **rung) for rung in _achievements(entry.get("achievements"), name)]
    )
    return plot


def archive_dropped(seen: Iterable[int]) -> int:
    """Book plots the sources no longer hold are archived (never deleted: a campaign may play with one)."""
    dropped = Plot.objects.filter(campaign__isnull=True, archived_at__isnull=True).exclude(pk__in=list(seen))
    return dropped.update(archived_at=timezone.now())


@dataclass
class SeedResult:
    plots: int = 0
    scoring: int = 0
    achievements: int = 0
    archived: int = 0
    skipped: list[str] = dataclass_field(default_factory=list)  # a plot whose setting we don't hold, and why


def seed_book_plots(folder: Path = PLOT_SOURCES) -> SeedResult:
    """Write every source plot whose setting we hold, skipping the rest with their reason."""
    settings = _setting_ids()
    seen: list[int] = []
    skipped: list[str] = []
    for entry in read_plots(folder):
        try:
            seen.append(write_plot(entry, settings).pk)
        except UnknownSetting as unknown:
            skipped.append(str(unknown))
    scoring = PlotScoringLine.objects.filter(plot_id__in=seen).count()
    rungs = PlotAchievement.objects.filter(plot_id__in=seen).count()
    return SeedResult(len(seen), scoring, rungs, archive_dropped(seen), skipped)
