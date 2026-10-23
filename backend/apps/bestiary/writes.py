"""Campaign bestiary entries written whole or not at all (BUG-53), their links in bulk (PERF-44).

The input is already validated (`BestiaryEntryWriteSerializer`): fields and every linked id. Each write runs in the
catalogue write's transaction (`apps/core/catalogue/writes.py`), so a failure leaves no entry without its links, and
each kind of link goes in one INSERT. A list a write sends replaces that list; a list it leaves out stays. A beast
without a profile keeps its stats at 0 and its save empty, whatever the write sends.
"""

from collections.abc import Mapping
from typing import Any

from django.db import models

from apps.core.catalogue.payloads import STAT_FIELDS

from .models import BestiaryEntry, BestiaryEntryItem, BestiaryEntrySkill, BestiaryEntrySpecial, BestiaryEntrySpell

ID_LINKS: tuple[tuple[str, type[models.Model], str], ...] = (
    ("skill_ids", BestiaryEntrySkill, "skill_id"),
    ("special_ids", BestiaryEntrySpecial, "special_id"),
    ("spell_ids", BestiaryEntrySpell, "spell_id"),
)
LISTS = ("skill_ids", "special_ids", "spell_ids", "item_entries")
NO_PROFILE: dict[str, Any] = {**{stat: 0 for stat in STAT_FIELDS}, "armour_save": None}


def _entry_fields(data: Mapping[str, Any], has_profile: bool) -> dict[str, Any]:
    fields = {key: value for key, value in data.items() if key not in LISTS}
    return fields if has_profile else {**fields, **NO_PROFILE}


def _write_links(entry: BestiaryEntry, data: Mapping[str, Any], *, replace: bool) -> None:
    for key, model, column in ID_LINKS:
        if key in data:
            if replace:
                model._default_manager.filter(bestiary_entry=entry).delete()
            model._default_manager.bulk_create([model(bestiary_entry=entry, **{column: pk}) for pk in data[key]])
    if "item_entries" in data:
        if replace:
            BestiaryEntryItem.objects.filter(bestiary_entry=entry).delete()
        BestiaryEntryItem.objects.bulk_create(
            [
                BestiaryEntryItem(bestiary_entry=entry, item_id=row["item_id"], quantity=row["quantity"])
                for row in data["item_entries"]
            ]
        )


def create_entry(campaign_id: int, data: Mapping[str, Any]) -> BestiaryEntry:
    fields = _entry_fields(data, data.get("has_profile", True))
    entry = BestiaryEntry.objects.create(campaign_id=campaign_id, **fields)
    _write_links(entry, data, replace=False)
    return entry


def update_entry(entry: BestiaryEntry, data: Mapping[str, Any]) -> None:
    fields = _entry_fields(data, data.get("has_profile", entry.has_profile))
    for field, value in fields.items():
        setattr(entry, field, value)
    if fields:
        entry.save(update_fields=list(fields))
    _write_links(entry, data, replace=True)
