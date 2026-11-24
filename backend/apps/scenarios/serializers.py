"""The scenarios' catalogue rows and write, and the campaign's list of them.

A scenario reads whole in a list row as in its detail: its sections are what the Scenarios page opens to, and the
whole catalogue is 70 of them. A write sends its own fields and, where it sends `sections`, that whole list; a
section's tables are the item rules' `{columns, rows}`, placed in its text by `{{table:N}}`.
"""

from decimal import Decimal
from typing import Any

from rest_framework import serializers

from .models import PLAYERS, CampaignScenario, Scenario

SCENARIO_FIELDS = (
    "id",
    "name",
    "slug",
    "number",
    "source",
    "players",
    "summary",
    "intro",
    "sections",
    "campaign_id",
)
BOOK_FIELDS = ("name", "number", "source", "players", "summary", "intro", "sections")


class ScenarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Scenario
        fields = SCENARIO_FIELDS


class TableInputSerializer(serializers.Serializer):
    columns = serializers.ListField(child=serializers.CharField(allow_blank=True, max_length=200), max_length=20)
    rows = serializers.ListField(
        child=serializers.ListField(child=serializers.CharField(allow_blank=True, max_length=2000), max_length=20),
        max_length=200,
    )


class SectionInputSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=160)
    text = serializers.CharField(required=False, allow_blank=True, max_length=20000, default="")
    tables = TableInputSerializer(many=True, required=False, default=list)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        return {"text": "", "tables": [], **attrs}  # in a PATCH too, where DRF skips defaults


class ScenarioWriteSerializer(serializers.ModelSerializer):
    """A campaign's own scenario, created or edited."""

    players = serializers.ChoiceField(choices=PLAYERS, required=False)
    sections = SectionInputSerializer(many=True, required=False)

    class Meta:
        model = Scenario
        validators: list = []  # a taken name is the name rule's 400 name_taken, backed by the constraint
        fields = ("name", "number", "source", "players", "summary", "intro", "sections")


class CampaignScenarioSerializer(serializers.ModelSerializer):
    """A row of the campaign's list: its id, its weight and its scenario whole."""

    scenario = ScenarioSerializer(read_only=True)
    weight = serializers.DecimalField(max_digits=6, decimal_places=2, coerce_to_string=False)

    class Meta:
        model = CampaignScenario
        fields = ("id", "weight", "scenario")


class WeightInput(serializers.Serializer):
    weight = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=Decimal(0), max_value=Decimal(9999))


class AddScenarioInput(serializers.Serializer):
    scenario_id = serializers.IntegerField(min_value=1)
    weight = serializers.DecimalField(
        max_digits=6, decimal_places=2, min_value=Decimal(0), max_value=Decimal(9999), required=False
    )


class DrawInput(serializers.Serializer):
    players = serializers.IntegerField(min_value=2, max_value=64)
