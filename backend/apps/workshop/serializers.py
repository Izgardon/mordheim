"""The workshop's request bodies (docs/plans/workshop.md, "Version 2 API")."""

from typing import Any

from rest_framework import serializers

from apps.core.share_codes import SHARE_CODE_LENGTH
from apps.warband_templates.models import WarbandTemplate
from apps.warbands.models import WarbandType

CODE_LENGTH = SHARE_CODE_LENGTH + 4  # room for the spaces or dashes a pasted code may carry


def _name(value: Any) -> str:
    cleaned = str(value).strip()
    if not cleaned:
        raise serializers.ValidationError("Name is required")
    return cleaned


DEFAULT_MOST_WARRIORS = 15
BOTH = "A warband with no list is raised from no list: leave the list out."


class WarbandWorkshopSerializer(serializers.Serializer):
    """`POST workshop/warbands/`: a name and a type, the variant for a type that presets none, and the list to raise
    it from: one of mine (`list_id`) or a shared one's code (its type one the list serves: the first when none is
    sent); or none (`no_list`, William, 26 Nov 2026), with its own most warriors."""

    name = serializers.CharField(max_length=120)
    warband_type_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    template_variant = serializers.CharField(max_length=40, required=False, allow_blank=True)
    list_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    list_code = serializers.CharField(max_length=CODE_LENGTH, required=False, allow_blank=True)
    no_list = serializers.BooleanField(required=False, default=False)
    max_units = serializers.IntegerField(min_value=1, max_value=999, required=False)

    def validate_name(self, value: Any) -> str:
        return _name(value)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if not attrs["no_list"]:
            return attrs
        if attrs.get("list_id") or attrs.get("list_code"):
            raise serializers.ValidationError({"no_list": [BOTH]})
        attrs.setdefault("max_units", DEFAULT_MOST_WARRIORS)
        return attrs


class ListWorkshopSerializer(serializers.Serializer):
    """`POST workshop/lists/`: a name, the template it copies (the book's or one of mine; none: blank) and the book
    warband types it serves (left out: a copy's source's, none for a blank one)."""

    name = serializers.CharField(max_length=160)
    copy_of_template_id = serializers.PrimaryKeyRelatedField(
        queryset=WarbandTemplate.objects.filter(archived_at__isnull=True),
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


ONE_OF = "Send a code or one of your own, not both."
NEITHER = "Send a code, or pick one of your own."


class CampaignImportSerializer(serializers.Serializer):
    """A campaign import's body: the code shared, or the id of one of the player's own in his workshop (`own`, the
    field a subclass names: William, 27 Nov 2026, his own "there already"), never both."""

    own = ""
    code = serializers.CharField(max_length=CODE_LENGTH, required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        has_code, has_own = "code" in attrs, attrs.get(self.own) is not None
        if has_code and has_own:
            raise serializers.ValidationError({self.own: [ONE_OF]})
        if not has_code and not has_own:
            raise serializers.ValidationError({"code": [NEITHER]})
        return attrs


class WarbandImportSerializer(CampaignImportSerializer):
    """`POST campaigns/<id>/warbands/import/`: a warband's code, or one of my workshop's warbands."""

    own = "warband_id"
    warband_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)


class ListImportSerializer(CampaignImportSerializer):
    """`POST campaigns/<id>/warband-templates/import/`: a list's code, or one of my workshop's lists."""

    own = "list_id"
    list_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
