"""Beasts in the warband (the bestiary rewrite step 4): the bodies of a recruit, a purchase's `recruit`, and back to item.

The fields named `source` are built in get_fields(), because `source` is also a Field attribute.
"""

from typing import Any

from rest_framework import serializers

UNIT_TYPES = ("hero", "henchmen_group", "hireling")
MAX_BEASTS = 100  # as a purchase's quantity


class RecruitNewSerializer(serializers.Serializer):
    """A new group: its name (the beast's by default) and race (none by default)."""

    name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    race_id = serializers.IntegerField(required=False, allow_null=True)


class RecruitTargetSerializer(serializers.Serializer):
    """Where recruited creatures go: `{"new": {...}}`, or `{"group_id": id}`, a group recruited from the same beast."""

    new = RecruitNewSerializer(required=False)
    group_id = serializers.IntegerField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if ("new" in attrs) == ("group_id" in attrs):
            raise serializers.ValidationError("Send new or group_id.")
        return attrs


class RecruitSourceSerializer(serializers.Serializer):
    """Where the copies are taken from: a unit on the roster (`type` its kind, `id`) or the stash (only the copies of
    `cost` when it is sent), and the creature's Animal item."""

    type = serializers.ChoiceField(choices=("stash", *UNIT_TYPES))
    id = serializers.IntegerField(required=False, allow_null=True)
    item_id = serializers.IntegerField()
    cost = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs["type"] == "stash":
            attrs.pop("id", None)
        elif attrs.get("id") is None:
            raise serializers.ValidationError({"id": ["A unit's id is required."]})
        return attrs


class BeastRecruitSerializer(serializers.Serializer):
    """POST beasts/recruit/."""

    def get_fields(self) -> dict[str, serializers.Field]:
        return {
            "source": RecruitSourceSerializer(),
            "quantity": serializers.IntegerField(required=False, default=1, min_value=1, max_value=MAX_BEASTS),
            "target": RecruitTargetSerializer(),
        }


class BackToItemSerializer(serializers.Serializer):
    """POST henchmen-groups/<id>/back-to-item/: the living members who go back (`member_ids`), or how many (`count`,
    the newest first)."""

    member_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, min_length=1, max_length=MAX_BEASTS
    )
    count = serializers.IntegerField(required=False, min_value=1, max_value=MAX_BEASTS)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if ("member_ids" in attrs) == ("count" in attrs):
            raise serializers.ValidationError("Send member_ids or count.")
        return attrs
