"""Campaign bestiary entries and hired swords written whole or not at all (BUG-53), their links in bulk (PERF-44).

The input is already validated (`BestiaryEntryWriteSerializer`, `HiredSwordWriteSerializer`): fields, costs and
every linked id. Each write runs in one transaction, so a failure leaves no entry without its links or its profile,
and each kind of link goes in one INSERT. A list a write sends replaces that list; a list it leaves out stays.
"""

from collections.abc import Mapping
from typing import Any

from django.db import models

from apps.core.catalogue.duplicates import refusing_duplicates

from .models import (
    BestiaryEntry,
    BestiaryEntryItem,
    BestiaryEntrySkill,
    BestiaryEntrySpecial,
    BestiaryEntrySpell,
    HiredSwordProfile,
    HiredSwordProfileRestriction,
)

DUPLICATE = "a bestiary entry or hired sword with this name"  # the base constraint (BUG-17)
ID_LINKS: tuple[tuple[str, type[models.Model], str], ...] = (
    ("skill_ids", BestiaryEntrySkill, "skill_id"),
    ("special_ids", BestiaryEntrySpecial, "special_id"),
    ("spell_ids", BestiaryEntrySpell, "spell_id"),
)
PROFILE_FIELDS = (
    "hire_cost",
    "hire_cost_expression",
    "upkeep_cost",
    "upkeep_cost_expression",
    "rating",
    "grade",
    "race",
    "available_skill_types",
)
LISTS = ("skill_ids", "special_ids", "spell_ids", "item_entries", "restriction_ids")


def _entry_fields(data: Mapping[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in data.items() if key not in LISTS and key not in PROFILE_FIELDS}


def _profile_fields(data: Mapping[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in data.items() if key in PROFILE_FIELDS}


def _save_fields(row: models.Model, fields: Mapping[str, Any]) -> None:
    for field, value in fields.items():
        setattr(row, field, value)
    if fields:
        row.save(update_fields=list(fields))


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


def _write_restrictions(profile: HiredSwordProfile, notes: list[Mapping[str, Any]], *, replace: bool) -> None:
    if replace:
        HiredSwordProfileRestriction.objects.filter(hired_sword_profile=profile).delete()
    HiredSwordProfileRestriction.objects.bulk_create(
        [
            HiredSwordProfileRestriction(
                hired_sword_profile=profile,
                restriction_id=note["restriction_id"],
                additional_note=note["additional_note"],
            )
            for note in notes
        ]
    )


def create_entry(campaign_id: int, data: Mapping[str, Any]) -> BestiaryEntry:
    with refusing_duplicates(DUPLICATE):
        entry = BestiaryEntry.objects.create(campaign_id=campaign_id, **_entry_fields(data))
        _write_links(entry, data, replace=False)
    return entry


def update_entry(entry: BestiaryEntry, data: Mapping[str, Any]) -> None:
    with refusing_duplicates(DUPLICATE):
        _save_fields(entry, _entry_fields(data))
        _write_links(entry, data, replace=True)


def create_hired_sword(campaign_id: int, data: Mapping[str, Any]) -> HiredSwordProfile:
    """The entry (a "Hired Sword" unless the write says otherwise), its links, then its profile with the grade and
    race it was sent (BUG-53: create dropped them)."""
    with refusing_duplicates(DUPLICATE):
        entry = BestiaryEntry.objects.create(campaign_id=campaign_id, **{"type": "Hired Sword", **_entry_fields(data)})
        _write_links(entry, data, replace=False)
        profile = HiredSwordProfile.objects.create(
            campaign_id=campaign_id, bestiary_entry=entry, **_profile_fields(data)
        )
        _write_restrictions(profile, data.get("restriction_ids", []), replace=False)
    return profile


def update_hired_sword(profile: HiredSwordProfile, data: Mapping[str, Any]) -> None:
    with refusing_duplicates(DUPLICATE):
        _save_fields(profile.bestiary_entry, _entry_fields(data))
        _write_links(profile.bestiary_entry, data, replace=True)
        _save_fields(profile, _profile_fields(data))
        if "restriction_ids" in data:
            _write_restrictions(profile, data["restriction_ids"], replace=True)
