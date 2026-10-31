"""Warband types as the pages read them (grading phase 1): a row of the picker's list, the brief a warband carries
(its type and the types it counts as, each with its groups' names for the store's who-can-buy matching), and the
body that adds a campaign's own type."""

from typing import Any

from rest_framework import serializers

from apps.campaigns.serializers.grading import SettingBriefSerializer
from apps.warbands.models import WarbandType


class WarbandTypeBriefSerializer(serializers.ModelSerializer):
    setting = SettingBriefSerializer(source="campaign_type", read_only=True)
    groups = serializers.SerializerMethodField()

    def get_groups(self, warband_type: WarbandType) -> list[str]:
        """Its groups' names (`services/types.with_group_names`)."""
        names: list[str] | None = getattr(warband_type, "group_names", None)
        return list(names) if names is not None else [group.name for group in warband_type.groups.all()]

    class Meta:
        model = WarbandType
        fields = ("id", "name", "slug", "campaign_id", "setting", "source", "link_url", "groups")


class WarbandTypeSerializer(WarbandTypeBriefSerializer):
    """A row of the picker's list (services/types.type_list): the brief, its race, source code and the two sites'
    grades, and whether it is in play in the campaign."""

    in_play = serializers.SerializerMethodField()

    def get_in_play(self, warband_type: Any) -> bool | None:
        return getattr(warband_type, "in_play", None)

    class Meta:
        model = WarbandType
        fields = (
            *WarbandTypeBriefSerializer.Meta.fields,
            "race",
            "source_code",
            "broheim_grade",
            "mordheimer_grade",
            "in_play",
        )


class CustomWarbandTypeSerializer(serializers.Serializer):
    """POST campaigns/<id>/warband-types/: a type of the campaign's own."""

    name = serializers.CharField(max_length=120, trim_whitespace=True)
    link_url = serializers.URLField(max_length=500, required=False, allow_blank=True, default="")
