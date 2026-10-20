"""Catalogue ids a write may link: a book entry's or one of the writer's campaign's (SEC-07, CAT-TEST-16).

An id of another campaign's entry reads exactly like an unknown id, so other campaigns' entries stay invisible. The
serializer's context carries the campaign (`context["campaign_id"]`). A list is checked in one query, not one per id
as DRF's PrimaryKeyRelatedField would (PERF-44).
"""

from collections.abc import Iterable
from typing import Any

from django.db.models import QuerySet
from rest_framework import serializers

from apps.warbands.units.catalogue_scope import in_campaign_scope


def unknown_ids(rows: QuerySet[Any], ids: Iterable[int], campaign_id: int) -> list[int]:
    """The ids among `ids` that are neither the book's nor the campaign's, in the order sent (one query)."""
    wanted = list(dict.fromkeys(ids))
    if not wanted:
        return []
    known = set(in_campaign_scope(rows.filter(id__in=wanted), campaign_id).values_list("id", flat=True))
    return [pk for pk in wanted if pk not in known]


def refuse_unknown(rows: QuerySet[Any], ids: Iterable[int], campaign_id: int) -> None:
    """A ValidationError naming each id a campaign may not link, worded as DRF words an unknown id."""
    missing = unknown_ids(rows, ids, campaign_id)
    if missing:
        raise serializers.ValidationError([f'Invalid pk "{pk}" - object does not exist.' for pk in missing])


class CatalogueEntryField(serializers.PrimaryKeyRelatedField):
    """One entry's id (e.g. an item's animal, `bestiary_entry_id`)."""

    def get_queryset(self) -> Any:
        return in_campaign_scope(super().get_queryset(), self.context["campaign_id"])


class CatalogueIdsField(serializers.ListField):
    """A list of entry ids (e.g. `skill_ids`), checked in one query; a repeated id counts once."""

    def __init__(self, *, rows: QuerySet[Any], **kwargs: Any) -> None:
        self.rows = rows
        super().__init__(child=serializers.IntegerField(min_value=1), **kwargs)

    def to_internal_value(self, data: Any) -> list[int]:
        ids = list(dict.fromkeys(super().to_internal_value(data)))
        refuse_unknown(self.rows.all(), ids, self.context["campaign_id"])
        return ids
