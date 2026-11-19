"""A campaign's charts: the dice tables a player looks up (William, 19 Nov 2026).

A chart is read and written whole, with its results, because its rows mean nothing apart from it: a POST or a PUT
sends the chart and every row it should now hold, and the rows it holds are written afresh in the order sent.
"""

from rest_framework import serializers

from ..models import CHART_DICE, MAX_CHART_ROW_TEXT, CampaignChart, CampaignChartRow

MAX_ROWS = 100  # D100 is the longest table a book holds


def table_payload(table: CampaignChart | None) -> dict | None:
    """A table owned by a rule or a result, as the pages read it: the same shape a rule's own table has."""
    if table is None:
        return None
    return {
        "dice": table.dice,
        "description": table.description,
        "note": table.note,
        "rows": [{"id": row.id, "result": row.result, "name": row.name, "text": row.text} for row in table.rows.all()],
    }


class CampaignChartRowSerializer(serializers.ModelSerializer):
    """One result: what was rolled, its short name, what it does, and its own table where the book hangs one off
    this result alone (Border Town Burning's Curious bloom). The table is read with the chart and never sent."""

    result = serializers.CharField(max_length=20, trim_whitespace=True)
    name = serializers.CharField(max_length=160, allow_blank=True, required=False, trim_whitespace=True)
    text = serializers.CharField(max_length=MAX_CHART_ROW_TEXT, allow_blank=True, required=False, trim_whitespace=True)

    class Meta:
        model = CampaignChartRow
        fields = ("id", "result", "name", "text", "chart")
        read_only_fields = ("chart",)

    def to_representation(self, instance):
        """The result with its own table, from the rows already read (no query)."""
        data = super().to_representation(instance)
        data["chart"] = table_payload(next(iter(instance.charts.all()), None))
        return data


class CampaignChartSerializer(serializers.ModelSerializer):
    """A chart with its results, in their order. Its place changes only through PUT campaign-charts/order/."""

    campaign_id = serializers.IntegerField(read_only=True)
    title = serializers.CharField(max_length=160, trim_whitespace=True)
    description = serializers.CharField(max_length=2000, allow_blank=True, required=False, trim_whitespace=True)
    dice = serializers.ChoiceField(choices=CHART_DICE, allow_blank=True, required=False)
    note = serializers.CharField(max_length=2000, allow_blank=True, required=False, trim_whitespace=True)
    umbrella = serializers.CharField(max_length=120, allow_blank=True, required=False, trim_whitespace=True)
    rows = CampaignChartRowSerializer(many=True, required=False)

    class Meta:
        model = CampaignChart
        fields = ("id", "campaign_id", "title", "description", "dice", "note", "umbrella", "order", "rows")
        read_only_fields = ("order",)

    def validate_rows(self, value: list[dict]) -> list[dict]:
        if len(value) > MAX_ROWS:
            raise serializers.ValidationError(f"A chart holds at most {MAX_ROWS} results.")
        return value


class CampaignChartOrderSerializer(serializers.Serializer):
    """PUT campaign-charts/order/: every chart's id, in its new order."""

    ids = serializers.ListField(child=serializers.IntegerField(), max_length=500)
