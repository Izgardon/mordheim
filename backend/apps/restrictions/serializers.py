from collections.abc import Iterable, Mapping
from typing import Any

from rest_framework import serializers

from apps.core.catalogue.scope import refuse_unknown

from .models import Restriction


class RestrictionSerializer(serializers.ModelSerializer):
    """A restriction as lists and warband payloads show it; nothing writes restrictions through the API (SEC-06)."""

    class Meta:
        model = Restriction
        fields = (
            "id",
            "type",
            "restriction",
            "campaign",
            "campaign_type",  # CAT-NEW-04: always null today
        )
        read_only_fields = ("campaign", "campaign_type")


class RestrictionNoteSerializer(serializers.Serializer):
    """A restriction linked to an item's availability or a hired sword: `{"restriction_id", "additional_note"}`, or
    a bare id (the hired-sword forms send both)."""

    restriction_id = serializers.IntegerField(min_value=1)
    additional_note = serializers.CharField(max_length=200, allow_blank=True, default="")

    def to_internal_value(self, data: Any) -> Any:
        return super().to_internal_value(data if isinstance(data, Mapping) else {"restriction_id": data})


def unique_restriction_notes(notes: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """The links once each (one row per restriction and note), in the order sent."""
    keyed = {(note["restriction_id"], note["additional_note"]): dict(note) for note in notes}
    return list(keyed.values())


def refuse_unknown_restrictions(notes: Iterable[Mapping[str, Any]], campaign_id: int) -> None:
    """Every restriction must be the book's or the campaign's (SEC-07); one query for all of them."""
    refuse_unknown(Restriction.objects.all(), [note["restriction_id"] for note in notes], campaign_id)
