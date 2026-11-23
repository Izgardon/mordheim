"""A campaign's location groups and locations (William, 23 Nov 2026).

The list is read whole: every group with its locations, each location with its own tables and the campaign tables it
points to. A location is written whole too, as a chart is: the request sends its fields, its own tables (each with
its results, and a result's own sub-table where the book hangs one) and the ids of the campaign tables it points to,
and the tables and links it held are written afresh in the order sent.
"""

from typing import Any

from rest_framework import serializers

from ..models import (
    CHART_DICE,
    MAX_CHART_ROW_TEXT,
    MAX_LOCATION_RULES_TEXT,
    CampaignLocation,
    CampaignLocationGroup,
)
from ..services.location_words import heroes_text
from .charts import MAX_ROWS, CampaignChartSerializer

MAX_TABLES = 12  # a place with a dozen tables of its own is a page of its own
MAX_LINKS = 20
ALL = "all"


class HeroCountField(serializers.Field):
    """A number of heroes sent, or "all" (every hero the warband has), stored as null."""

    default_error_messages = {"invalid": 'Send a whole number of heroes from 1, or "all".'}

    def to_representation(self, value: int | None) -> int | str:
        return ALL if value is None else value

    def to_internal_value(self, data: Any) -> int | None:
        if isinstance(data, str) and data.strip().lower() == ALL:
            return None
        if isinstance(data, bool):
            self.fail("invalid")
        try:
            number = int(data)
        except (TypeError, ValueError):
            self.fail("invalid")
        if number < 1 or number > 99 or str(number) != str(data).strip():
            self.fail("invalid")
        return number


def _text(limit: int) -> serializers.CharField:
    return serializers.CharField(max_length=limit, allow_blank=True, required=False, default="", trim_whitespace=True)


class PlainRowSerializer(serializers.Serializer):
    """One result: what was rolled, its short name and what it does."""

    result = serializers.CharField(max_length=40, trim_whitespace=True)
    name = _text(160)
    text = _text(MAX_CHART_ROW_TEXT)


class SubTableSerializer(serializers.Serializer):
    """The table hanging off one result of a location's table: plain results, one level only."""

    dice = serializers.ChoiceField(choices=CHART_DICE, allow_blank=True, required=False, default="")
    description = _text(2000)
    note = _text(2000)
    rows = PlainRowSerializer(many=True)

    def validate_rows(self, value: list[dict]) -> list[dict]:
        if len(value) > MAX_ROWS:
            raise serializers.ValidationError(f"A table holds at most {MAX_ROWS} results.")
        return value


class TableRowSerializer(PlainRowSerializer):
    chart = SubTableSerializer(required=False, allow_null=True, default=None)


class LocationTableSerializer(serializers.Serializer):
    """One of a location's own tables, as a chart is written: its title, when it is rolled, dice, note and rows."""

    title = serializers.CharField(max_length=160, trim_whitespace=True)
    description = _text(2000)
    dice = serializers.ChoiceField(choices=CHART_DICE, allow_blank=True, required=False, default="")
    note = _text(2000)
    rows = TableRowSerializer(many=True)

    def validate_rows(self, value: list[dict]) -> list[dict]:
        if not value:
            raise serializers.ValidationError("A table needs at least one result.")
        if len(value) > MAX_ROWS:
            raise serializers.ValidationError(f"A table holds at most {MAX_ROWS} results.")
        return value


class CampaignLocationSerializer(serializers.ModelSerializer):
    """A location as the pages read it, from the rows the list prefetched (no query)."""

    group_id = serializers.IntegerField(read_only=True)
    min_heroes = serializers.SerializerMethodField()
    max_heroes = serializers.SerializerMethodField()
    heroes_text = serializers.SerializerMethodField()
    tables = serializers.SerializerMethodField()
    charts = serializers.SerializerMethodField()

    class Meta:
        model = CampaignLocation
        fields = (
            "id",
            "group_id",
            "name",
            "rules",
            "min_heroes",
            "max_heroes",
            "heroes_text",
            "takes_trading_action",
            "order",
            "tables",
            "charts",
        )

    def get_min_heroes(self, location: CampaignLocation) -> int | str:
        return ALL if location.min_heroes is None else location.min_heroes

    def get_max_heroes(self, location: CampaignLocation) -> int | str:
        return ALL if location.max_heroes is None else location.max_heroes

    def get_heroes_text(self, location: CampaignLocation) -> str:
        return heroes_text(location.min_heroes, location.max_heroes)

    def get_tables(self, location: CampaignLocation) -> list[dict]:
        return list(CampaignChartSerializer(location.tables.all(), many=True).data)

    def get_charts(self, location: CampaignLocation) -> list[dict]:
        return [{"id": link.chart_id, "title": link.chart.title} for link in location.chart_links.all()]


class CampaignLocationWriteSerializer(serializers.Serializer):
    """POST locations/ (every field) and PATCH locations/<id>/ (the fields sent; `tables` and `chart_ids`, when
    sent, replace what it held)."""

    group_id = serializers.IntegerField()
    name = serializers.CharField(max_length=160, trim_whitespace=True)
    rules = _text(MAX_LOCATION_RULES_TEXT)
    min_heroes = HeroCountField(required=False, default=1)
    max_heroes = HeroCountField(required=False, default=1)
    takes_trading_action = serializers.BooleanField(required=False, default=False)
    tables = LocationTableSerializer(many=True, required=False)
    chart_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, max_length=MAX_LINKS, allow_empty=True
    )

    def validate_tables(self, value: list[dict]) -> list[dict]:
        if len(value) > MAX_TABLES:
            raise serializers.ValidationError(f"A location holds at most {MAX_TABLES} tables.")
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        """Min is never above max, with "all" the largest; on a PATCH the counts it held count."""
        held: CampaignLocation | None = self.instance
        low = attrs["min_heroes"] if "min_heroes" in attrs else (held.min_heroes if held else 1)
        high = attrs["max_heroes"] if "max_heroes" in attrs else (held.max_heroes if held else 1)
        if high is not None and (low is None or low > high):
            raise serializers.ValidationError({"max_heroes": ["The most heroes can't be fewer than the least."]})
        return attrs


class CampaignLocationGroupSerializer(serializers.ModelSerializer):
    """A group with its listed locations, in their order (from the prefetch)."""

    campaign_id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(max_length=160, trim_whitespace=True)
    description = _text(4000)
    restrictions = _text(4000)
    locations = CampaignLocationSerializer(many=True, read_only=True)

    class Meta:
        model = CampaignLocationGroup
        fields = ("id", "campaign_id", "name", "description", "restrictions", "order", "locations")
        read_only_fields = ("order",)
