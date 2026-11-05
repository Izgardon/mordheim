"""Making one parent's child rows what an editor save sent (the templates plan, phase 4), in a fixed number of queries
whatever their number: a delete, a bulk update and a bulk create."""

from collections.abc import Iterable, Mapping
from typing import Any

from django.db.models import Model


def sync_rows(
    model: type[Model],
    existing: Iterable[Model],
    sent: list[dict[str, Any]],
    *,
    parent: Mapping[str, Any],
    copied: Mapping[int, int] | None = None,
) -> None:
    """The rows of one parent (`existing`, `parent`: its foreign key's value) become `sent`, in order: a row sent with
    its `id` is updated (on a book template's first save, the id of the book row it was copied from: `copied`), one
    without is made, and a row not sent goes. Each row's `position` is its place in the order sent."""
    rows = {row.pk: row for row in existing}
    copied = copied or {}
    kept: list[Model] = []
    made: list[Model] = []
    fields: set[str] = {"position"}
    for position, values in enumerate(sent):
        values = {**values, "position": position}
        sent_id = values.pop("id", None)
        row = rows.get(copied.get(sent_id, sent_id)) if sent_id is not None else None
        fields |= set(values)
        if row is None:
            made.append(model(**parent, **values))
            continue
        for field, value in values.items():
            setattr(row, field, value)
        kept.append(row)
    manager = model._default_manager
    gone = set(rows) - {row.pk for row in kept}
    if gone:
        manager.filter(pk__in=gone).delete()
    if kept:
        manager.bulk_update(kept, sorted(fields))
    if made:
        manager.bulk_create(made)
