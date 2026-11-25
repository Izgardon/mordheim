"""The workshop's request bodies (docs/plans/workshop.md, "API")."""

from typing import Any

from rest_framework import serializers

from apps.campaigns.models import SHARE_CODE_LENGTH
from apps.warband_templates.models import WarbandTemplate
from apps.warbands.models import WarbandType

CODE_LENGTH = SHARE_CODE_LENGTH + 4  # room for the spaces or dashes a pasted code may carry


def _name(value: Any) -> str:
    cleaned = str(value).strip()
    if not cleaned:
        raise serializers.ValidationError("Name is required")
    return cleaned


class WarbandWorkshopSerializer(serializers.Serializer):
    """`POST workshop/warbands/`: a name and a type, the variant for a type that presets none, and a shared list's
    code to raise it from (its type one the list serves: the first when none is sent)."""

    name = serializers.CharField(max_length=120)
    warband_type_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    template_variant = serializers.CharField(max_length=40, required=False, allow_blank=True)
    list_code = serializers.CharField(max_length=CODE_LENGTH, required=False, allow_blank=True)

    def validate_name(self, value: Any) -> str:
        return _name(value)


class ListWorkshopSerializer(serializers.Serializer):
    """`POST workshop/lists/`: a name, the book template it copies (none: blank) and the book warband types it serves
    (left out: a copy's source's, none for a blank one)."""

    name = serializers.CharField(max_length=160)
    copy_of_template_id = serializers.PrimaryKeyRelatedField(
        queryset=WarbandTemplate.objects.filter(campaign__isnull=True, archived_at__isnull=True),
        required=False,
        allow_null=True,
        source="copy_of",
    )
    warband_type_ids = serializers.PrimaryKeyRelatedField(
        queryset=WarbandType.objects.filter(campaign__isnull=True), many=True, required=False
    )

    def validate_name(self, value: Any) -> str:
        return _name(value)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if "warband_type_ids" in attrs:
            attrs["warband_type_ids"] = list(dict.fromkeys(row.pk for row in attrs["warband_type_ids"]))
        return attrs


class CodeSerializer(serializers.Serializer):
    """An import's body: the code shared."""

    code = serializers.CharField(max_length=CODE_LENGTH)
