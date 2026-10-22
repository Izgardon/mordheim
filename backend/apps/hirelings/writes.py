"""Hired swords and dramatis personae written whole or not at all (BUG-53), their links in bulk (PERF-44): the one
link builder for both kinds, which the catalogue's writes and the seeders use.

A write's input is already validated (`HirelingProfileWriteSerializer`, or the seeder's resolved data): fields and
every linked id. A catalogue write runs in the catalogue's transaction (`apps/core/catalogue/writes.py`), so a
failure leaves no entry without its links, and each kind of link goes in one INSERT. A list the data holds replaces
that list; a list it leaves out stays.
"""

from collections.abc import Mapping
from typing import Any

from .models import HirelingProfile
from .selectors import link_model, owner_field

ID_LINKS = (  # write key -> the relation it fills and the linked entry's column
    ("skill_ids", "skill_links", "skill_id"),
    ("special_ids", "special_links", "special_id"),
    ("spell_ids", "spell_links", "spell_id"),
)
LISTS = ("skill_ids", "special_ids", "spell_ids", "item_entries", "restriction_ids")


def _replace(entry: HirelingProfile, relation: str, rows: list[dict[str, Any]], *, replace: bool) -> None:
    """The entry's links of `relation` become `rows` (each the link's columns but its owner)."""
    model, owner = link_model(type(entry), relation), owner_field(type(entry), relation)
    if replace:
        model.objects.filter(**{owner: entry}).delete()
    model.objects.bulk_create([model(**{owner: entry, **row}) for row in rows])


def write_links(entry: HirelingProfile, data: Mapping[str, Any], *, replace: bool) -> None:
    """Each list `data` holds: skill, special and spell ids, item entries (`item_id`, `quantity`) and restriction
    notes (`restriction_id`, `additional_note`)."""
    for key, relation, column in ID_LINKS:
        if key in data:
            _replace(entry, relation, [{column: pk} for pk in data[key]], replace=replace)
    if "item_entries" in data:
        rows = [{"item_id": row["item_id"], "quantity": row["quantity"]} for row in data["item_entries"]]
        _replace(entry, "item_links", rows, replace=replace)
    if "restriction_ids" in data:
        notes = [{"restriction_id": note["restriction_id"], "additional_note": note["additional_note"]} for note in data["restriction_ids"]]  # fmt: skip
        _replace(entry, "restriction_links", notes, replace=replace)


def _fields(data: Mapping[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in data.items() if key not in LISTS}


def create_profile(model: type[HirelingProfile], campaign_id: int, data: Mapping[str, Any]) -> HirelingProfile:
    values = {"campaign_id": campaign_id, **_fields(data)}
    entry = model._default_manager.create(**values)
    write_links(entry, data, replace=False)
    return entry


def update_profile(entry: HirelingProfile, data: Mapping[str, Any]) -> None:
    fields = _fields(data)
    for field, value in fields.items():
        setattr(entry, field, value)
    if fields:
        entry.save(update_fields=list(fields))
    write_links(entry, data, replace=True)
