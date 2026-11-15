"""The exploration charts' catalogue rows: a list row, and the detail with its places."""

from typing import Any

from rest_framework import serializers

from .models import ExplorationChart, ExplorationPlace

CHART_FIELDS = (
    "id",
    "name",
    "slug",
    "summary",
    "campaign_id",
    "campaign_type_id",
    "dice_per_hero",
    "dice_for_win",
    "max_dice",
    "max_chosen",
    "income",
    "income_note",
)


class ExplorationPlaceSerializer(serializers.ModelSerializer):
    # what the chart calls the multiple ("Doubles"); typed Any because Field.label is a string on the base class
    label: Any = serializers.ReadOnlyField()

    class Meta:
        model = ExplorationPlace
        fields = ("id", "count", "face", "label", "name", "rules")


class ExplorationChartSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExplorationChart
        fields = CHART_FIELDS


class ExplorationChartDetailSerializer(serializers.ModelSerializer):
    places = ExplorationPlaceSerializer(many=True, read_only=True)

    class Meta:
        model = ExplorationChart
        fields = (*CHART_FIELDS, "places")
