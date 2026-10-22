"""What the catalogue seeders share (BUG-54, IMP-81): reading the JSON, cleaning its values, upserting the book's
rows and writing an item's prices.

Every seeder reads and writes the book only (BUG-17): `upsert_global` matches and creates rows with no campaign and
no add-on, and the restrictions an item's "unique to" text names come from `restrictions.book.BookRestrictions`.
"""

import json
import re
from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path
from typing import Any

from django.core.management.base import CommandError
from django.core.management.color import no_style
from django.db import connection
from django.db.models import Model

from apps.items.models import Item, ItemAvailability, ItemAvailabilityRestriction
from apps.restrictions.book import BookRestrictions

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


def parse_rarity(value: Any) -> int:
    """A rarity between 2 and 20, as ItemAvailability allows; 2 (common) when the value has none."""
    return max(2, min(20, parse_int(value, default=2)))


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
    """The book's row matching `lookup` (no campaign, no add-on) with `defaults` written, and whether it is new."""
    book: dict[str, Any] = {"campaign": None}
    if any(field.name == "campaign_type" for field in model._meta.get_fields()):
        book["campaign_type"] = None
    row, created = model._default_manager.update_or_create(**lookup, **book, defaults=dict(defaults))
    return row, created


def reset_sequence(model: type[Model]) -> None:
    """After rows were written with ids from the JSON, new rows take ids after them."""
    with connection.cursor() as cursor:
        for sql in connection.ops.sequence_reset_sql(no_style(), [model]):
            cursor.execute(sql)


def sync_availabilities(item: Item, rows: Sequence[Mapping[str, Any]], restrictions: BookRestrictions) -> None:
    """Replace the item's prices: one ItemAvailability per row (cost, rarity, variable cost), each linked to the
    restrictions its "unique to" text names. One INSERT for the prices, one for their restrictions."""
    item.availabilities.all().delete()
    created = ItemAvailability.objects.bulk_create(
        [
            ItemAvailability(
                item=item,
                cost=parse_int(row.get("cost"), 0),
                rarity=parse_rarity(row.get("rarity")),
                variable_cost=clean(row.get("variable_cost")) or None,
            )
            for row in rows
        ]
    )
    ItemAvailabilityRestriction.objects.bulk_create(
        [
            ItemAvailabilityRestriction(item_availability=availability, restriction=restriction, additional_note=note)
            for availability, row in zip(created, rows, strict=True)
            if clean(row.get("unique_to"))
            for restriction, note in restrictions.resolve(clean(row.get("unique_to")))
        ]
    )


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
