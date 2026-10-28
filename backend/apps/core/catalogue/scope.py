"""Catalogue ids a write may link: a book entry's or one of the writer's campaign's (SEC-07, CAT-TEST-16), each
landing on the campaign's current entry for it (CAT-TWEAK-03: a book id the campaign has a version of links the
version).

An id of another campaign's entry reads exactly like an unknown id, so other campaigns' entries stay invisible. The
serializer's context carries the campaign (`context["campaign_id"]`). A list is checked in one query, not one per id
as DRF's PrimaryKeyRelatedField would (PERF-44). Restrictions and item properties have no versions: their ids stand
for themselves.
"""

from collections.abc import Iterable, Mapping
from typing import Any

from django.db.models import Q, QuerySet
from rest_framework import serializers

from apps.items.models import Item

from .current import current_rows, is_entry_table


def current_ids(rows: QuerySet[Any], ids: Iterable[int], campaign_id: int) -> tuple[list[int], dict[int, int]]:
    """The ids among `ids` that are neither the book's nor the campaign's, in the order sent, and each other id -> the
    campaign's current id for it (one query)."""
    wanted = list(dict.fromkeys(ids))
    if not wanted:
        return [], {}
    if is_entry_table(rows.model):
        current = current_rows(rows.only("id", "campaign_id", "replaces_id"), wanted, campaign_id)
        found = {pk: row.pk for pk, row in current.items()}
    else:
        scoped = rows.filter(Q(campaign__isnull=True) | Q(campaign_id=campaign_id), id__in=wanted)
        found = {pk: pk for pk in scoped.values_list("id", flat=True)}
    return [pk for pk in wanted if pk not in found], found


def refuse_unknown(rows: QuerySet[Any], ids: Iterable[int], campaign_id: int) -> dict[int, int]:
    """Each of `ids` -> the campaign's current id for it; a ValidationError naming each id a campaign may not link,
    worded as DRF words an unknown id."""
    missing, current = current_ids(rows, ids, campaign_id)
    if missing:
        raise serializers.ValidationError([f'Invalid pk "{pk}" - object does not exist.' for pk in missing])
    return current


def as_id(value: Any) -> Any:
    """`value` as a whole number when it is one (not a bool), else as it was sent."""
    if isinstance(value, bool):
        return value
    try:
        return int(value)
    except (TypeError, ValueError):
        return value


class CatalogueEntryField(serializers.PrimaryKeyRelatedField):
    """One entry's id (a unit's or a hired sword's race), read as the campaign's current entry for it in the field's
    one query."""

    def campaign_id(self) -> int:
        """The writer's campaign: the serializer's context, else its own (a unit's update reads its warband's)."""
        campaign_id: Any = self.context.get("campaign_id")
        if campaign_id is None and hasattr(self.parent, "_campaign_id"):
            campaign_id = self.parent._campaign_id()
        return int(campaign_id)

    def to_internal_value(self, data: Any) -> Any:
        pk = as_id(data)
        if isinstance(data, bool) or not isinstance(pk, int):
            self.fail("incorrect_type", data_type=type(data).__name__)
        entry = current_rows(self.get_queryset(), [pk], self.campaign_id()).get(pk)
        if entry is None:
            self.fail("does_not_exist", pk_value=data)
        return entry


class CatalogueIdsField(serializers.ListField):
    """A list of entry ids (e.g. `skill_ids`), checked in one query; a repeated id counts once."""

    def __init__(self, *, rows: QuerySet[Any], **kwargs: Any) -> None:
        self.rows = rows
        super().__init__(child=serializers.IntegerField(min_value=1), **kwargs)

    def to_internal_value(self, data: Any) -> list[int]:
        ids = list(dict.fromkeys(super().to_internal_value(data)))
        current = refuse_unknown(self.rows.all(), ids, self.context["campaign_id"])
        return list(dict.fromkeys(current[pk] for pk in ids))


class EquipmentInputSerializer(serializers.Serializer):
    """One item a catalogue entry carries (a bestiary entry's equipment, a hired sword's kit): `{"item_id",
    "quantity"}`, or a bare item id (one of it)."""

    item_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=2_147_483_647, default=1)  # the column's largest

    def to_internal_value(self, data: Any) -> Any:
        return super().to_internal_value(data if isinstance(data, Mapping) else {"item_id": data})

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        return {"quantity": 1, **attrs}  # in a PATCH too, where DRF skips defaults


def current_equipment(rows: list[dict[str, Any]], campaign_id: int) -> list[dict[str, Any]]:
    """Each item once (an item listed twice: its first quantity), as the campaign's current item for it; an item the
    campaign may not link is refused as an unknown id (one query)."""
    first = {row["item_id"]: row for row in reversed(rows)}
    current = refuse_unknown(Item.objects.all(), first, campaign_id)
    unique: dict[int, dict[str, Any]] = {}
    for item_id in dict.fromkeys(row["item_id"] for row in rows):
        unique.setdefault(current[item_id], {**first[item_id], "item_id": current[item_id]})
    return list(unique.values())
