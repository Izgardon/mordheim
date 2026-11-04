"""What the catalogue seeders share (BUG-54, IMP-81): reading the JSON, cleaning its values and upserting the book's
rows.

Every seeder reads and writes the book only (BUG-17): `upsert_global` matches and creates rows with no campaign
(whatever their setting).
"""

import json
import re
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import CommandError
from django.core.management.color import no_style
from django.db import connection
from django.db.models import Model

from apps.campaigns.models import CampaignType
from apps.warbands.models import WarbandGroup, WarbandType

# The catalogue import's generated files (backend/catalogue_import/out/), which the seeders read in place: settings,
# warband types and groups, items and their shared rules, skills and skill groups, and the settings and who-can lists
# of the skills, hired swords and dramatis personae we seed
IMPORT_OUT = Path(settings.BASE_DIR) / "catalogue_import" / "out"

STAT_FIELDS = (
    "movement",
    "weapon_skill",
    "ballistic_skill",
    "strength",
    "toughness",
    "wounds",
    "initiative",
    "attacks",
    "leadership",
)
WHOLE_NUMBER = re.compile(r"-?\d+")


def clean(value: Any) -> str:
    """A JSON value as stripped text ("" for None)."""
    return str(value or "").strip()


def parse_int(value: Any, default: int = 0) -> int:
    """A whole number as it is, the first whole number in a text ("5 gc" is 5), or `default` when there is none."""
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    match = WHOLE_NUMBER.search(clean(value))
    return int(match.group(0)) if match else default


def parse_armour_save(value: Any) -> int | None:
    """The number in "4+" or "5+"; None when blank or "-"."""
    if not value or str(value).strip() in ("", "-"):
        return None
    match = re.search(r"\d+", str(value))
    return int(match.group(0)) if match else None


def entry_value(entry: Any, aliases: Iterable[str]) -> Any:
    """The value of the first key of `aliases` the entry has, whatever its case or surrounding spaces."""
    if not isinstance(entry, dict):
        return None
    keys = {str(key).strip().lower(): key for key in entry}
    for alias in aliases:
        if alias in keys:
            return entry.get(keys[alias])
    return None


def read_json_list(path: Path, what: str = "objects") -> list[Any]:
    """A JSON file holding a list; a missing file, bad JSON or another shape stops the seeder with the path."""
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError as exc:
        raise CommandError(f"JSON file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise CommandError(f"Unable to parse JSON ({path}): {exc}") from exc
    if not isinstance(data, list):
        raise CommandError(f"JSON data should be a list of {what}: {path}")
    return data


def upsert_global[RowT: Model](
    model: type[RowT], lookup: Mapping[str, Any], defaults: Mapping[str, Any]
) -> tuple[RowT, bool]:
    """The book's row matching `lookup` (no campaign: the book holds every setting's rows, each in its setting) with
    `defaults` written, and whether it is new."""
    row, created = model._default_manager.update_or_create(**lookup, campaign=None, defaults=dict(defaults))
    return row, created


def reset_sequence(model: type[Model]) -> None:
    """After rows were written with ids from the JSON, new rows take ids after them."""
    with connection.cursor() as cursor:
        for sql in connection.ops.sequence_reset_sql(no_style(), [model]):
            cursor.execute(sql)


def read_stats(values: Mapping[str, Any], label: str) -> dict[str, int]:
    """A seeded profile's nine characteristics as whole numbers. A missing or blank stat, or one that isn't a whole
    number, stops the seeder with an error naming the profile and the stat (BUG-54: fail loudly, never a 0 or a crash
    on save); the seeder's transaction keeps nothing it wrote."""
    stats: dict[str, int] = {}
    problems: list[str] = []
    for field in STAT_FIELDS:
        value = values.get(field)
        text = "" if value is None else str(value).strip()
        if not text.lstrip("-").isdigit():
            problems.append(f"{field} {'is missing' if not text else f'is {value!r}'}")
            continue
        stats[field] = int(text)
    if problems:
        raise CommandError(f"{label}: {', '.join(problems)}.")
    return stats


class SettingAssignments:
    """The settings the catalogue import gives our seeded skills, hired swords and dramatis personae
    (`out/setting-assignments.json`, grading phase 1), as setting ids: `of(name, type)`. A row the file doesn't list
    is Mordheim's; while the settings aren't seeded every row's setting is null (which counts as Mordheim's too)."""

    def __init__(self, kind: str) -> None:
        settings = dict(CampaignType.objects.values_list("slug", "id"))
        try:
            data = json.loads((IMPORT_OUT / "setting-assignments.json").read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise CommandError(f"Unable to read the setting assignments: {exc}") from exc
        self.default = settings.get("mordheim")
        self.ids = {
            (clean(row.get("name")).lower(), clean(row.get("type")).lower()): settings.get(row.get("setting"))
            for row in data.get(kind, [])
        }

    def of(self, name: str, row_type: str = "") -> int | None:
        return self.ids.get((name.strip().lower(), row_type.strip().lower()), self.default)


class AccessLines:
    """Who-can lines from the catalogue import's slugs (`{"type": slug}` or `{"group": slug}`, `excluded`) as the
    writes take them (`warband_type_id` or `warband_group_id`, `excluded`). The lines name warband types and groups,
    so they apply once seed_warband_types has run (seed_all runs it first): before that nothing is `ready`. A slug the
    database lacks once they are seeded stops the run."""

    def __init__(self) -> None:
        self.types = dict(WarbandType.objects.filter(campaign__isnull=True).values_list("slug", "id"))
        self.groups = dict(WarbandGroup.objects.values_list("slug", "id"))

    @property
    def ready(self) -> bool:
        return bool(self.types)

    def line(self, line: Mapping[str, Any], name: str) -> dict[str, Any]:
        if "type" in line:
            if line["type"] not in self.types:
                raise CommandError(f"{name}: warband type '{line['type']}' isn't seeded.")
            return {"warband_type_id": self.types[line["type"]], "excluded": bool(line.get("excluded"))}
        if line.get("group") not in self.groups:
            raise CommandError(f"{name}: warband group '{line.get('group')}' isn't seeded.")
        return {"warband_group_id": self.groups[line["group"]], "excluded": bool(line.get("excluded"))}

    def of(self, lines: Iterable[Mapping[str, Any]], name: str) -> list[dict[str, Any]]:
        return [self.line(line, name) for line in lines]


class WhoCanLists:
    """Who may hire each of our seeded hired swords and dramatis personae (`out/who-can.json`, the items rebuild), the
    warband slugs as ids: `of(name)` gives the file's row with `lines` ready for the writes (AccessLines), or None for
    a row it doesn't list. Before the warband types are seeded every row is for everyone, as an unlisted one is."""

    def __init__(self, kind: str) -> None:
        self.access = AccessLines()
        try:
            data = json.loads((IMPORT_OUT / "who-can.json").read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise CommandError(f"Unable to read who can hire and learn: {exc}") from exc
        self.rows = {
            (clean(row.get("name")).lower(), clean(row.get("type")).lower()): row for row in data.get(kind, [])
        }

    def of(self, name: str, row_type: str = "") -> dict[str, Any] | None:
        row = self.rows.get((name.strip().lower(), row_type.strip().lower())) if self.access.ready else None
        if row is None:
            return None
        return {**row, "lines": self.access.of(row.get("warbands", []), name)}
