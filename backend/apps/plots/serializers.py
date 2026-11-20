"""The plots' catalogue rows: a list row, the detail with its scoring lines and its ladder, and the write.

A write sends the plot's own fields and, where it sends a list (`scoring`, `achievements`), that whole list; a list
it leaves out stays as it is. Its setting is not written: a campaign's own entry is never given one (it counts as
Mordheim's and is in play wherever it was made, apps/campaigns/in_play.py).
"""

from typing import Any

from rest_framework import serializers

from .models import Plot, PlotAchievement, PlotScoringLine
from .wording import scored

SMALLINT = 32_767
PLOT_FIELDS = (
    "id",
    "name",
    "slug",
    "summary",
    "who_text",
    "variant_of",
    "no_alliance_with",
    "campaign_id",
    "setting_id",  # its setting, as every catalogue list names it (grading phase 1)
)


class PlotScoringLineSerializer(serializers.ModelSerializer):
    shown = serializers.SerializerMethodField()  # its number as the plot prints it: the pages word none of it

    def get_shown(self, obj: PlotScoringLine) -> str:
        return scored(obj.points, obj.dice)

    class Meta:
        model = PlotScoringLine
        fields = ("id", "points", "dice", "text", "shown")


class PlotAchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlotAchievement
        fields = ("id", "points", "name", "text")


class PlotSerializer(serializers.ModelSerializer):
    setting_id = serializers.IntegerField(source="campaign_type_id", read_only=True)

    class Meta:
        model = Plot
        fields = PLOT_FIELDS


class PlotDetailSerializer(serializers.ModelSerializer):
    setting_id = serializers.IntegerField(source="campaign_type_id", read_only=True)
    scoring = PlotScoringLineSerializer(many=True, read_only=True, source="scoring_lines")
    achievements = PlotAchievementSerializer(many=True, read_only=True)

    class Meta:
        model = Plot
        fields = (*PLOT_FIELDS, "scoring", "achievements")


class ScoringLineInputSerializer(serializers.Serializer):
    """One scoring line: a flat number of points (negative where it takes them away), or a die whose sign is part of
    the string ("-D3"), and what earns it."""

    points = serializers.IntegerField(required=False, allow_null=True, min_value=-SMALLINT, max_value=SMALLINT)
    dice = serializers.CharField(required=False, allow_blank=True, max_length=12, default="")
    text = serializers.CharField(required=False, allow_blank=True, max_length=4000, default="")

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        return {"points": None, "dice": "", "text": "", **attrs}  # in a PATCH too, where DRF skips defaults


class AchievementInputSerializer(serializers.Serializer):
    """One rung: the campaign point total that unlocks it, its name and what it gives."""

    points = serializers.IntegerField(min_value=-SMALLINT, max_value=SMALLINT)
    name = serializers.CharField(required=False, allow_blank=True, max_length=160, default="")
    text = serializers.CharField(required=False, allow_blank=True, max_length=4000, default="")

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        return {"name": "", "text": "", **attrs}


class PlotWriteSerializer(serializers.ModelSerializer):
    """A campaign's own plot, created or edited: its name, who may follow it as prose, its scoring and its ladder."""

    scoring = ScoringLineInputSerializer(many=True, required=False)
    achievements = AchievementInputSerializer(many=True, required=False)

    class Meta:
        model = Plot
        validators: list = []  # a taken name is the name rule's 400 name_taken (CAT-TWEAK-02), backed by the constraint
        fields = ("name", "who_text", "scoring", "achievements")
