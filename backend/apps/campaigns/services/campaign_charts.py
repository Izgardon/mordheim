"""The campaign's charts, in their order: a new one goes last, and a reorder sends every chart's id in its new order.

A chart's results are written whole, as the request sent them: nothing matches a row sent to a row stored, so a
chart's rows are replaced in one go inside the same transaction. The order each row is sent in is its place.
"""

from typing import Any

from django.db import transaction
from django.db.models import Max, QuerySet

from ..errors import CampaignError
from ..models import CampaignChart, CampaignChartRow

ORDER_REFUSED = "Send every chart's id once, in its new order."


def campaign_charts(campaign_id: int) -> "QuerySet[CampaignChart]":
    """The campaign's charts with their results, in their order (two queries)."""
    return CampaignChart.objects.filter(campaign_id=campaign_id).prefetch_related("rows").order_by("order", "id")


def create_chart(campaign_id: int, validated: dict[str, Any]) -> CampaignChart:
    """The new chart with its results, after the campaign's others."""
    rows = validated.pop("rows", [])
    with transaction.atomic():
        last = CampaignChart.objects.filter(campaign_id=campaign_id).aggregate(last=Max("order"))["last"]
        chart = CampaignChart.objects.create(
            campaign_id=campaign_id, order=0 if last is None else last + 1, **validated
        )
        _write_rows(chart, rows)
    return chart


def update_chart(chart: CampaignChart, validated: dict[str, Any]) -> CampaignChart:
    """The chart as the request sent it; its results are replaced only when the request sent them."""
    rows = validated.pop("rows", None)
    with transaction.atomic():
        for field, value in validated.items():
            setattr(chart, field, value)
        chart.save(update_fields=[*validated, "updated_at"] if validated else ["updated_at"])
        if rows is not None:
            chart.rows.all().delete()
            _write_rows(chart, rows)
    return chart


def _write_rows(chart: CampaignChart, rows: list[dict[str, Any]]) -> None:
    CampaignChartRow.objects.bulk_create(
        CampaignChartRow(
            chart=chart,
            result=row["result"],
            name=row.get("name", ""),
            text=row.get("text", ""),
            order=place,
        )
        for place, row in enumerate(rows)
    )


def reorder(campaign_id: int, ids: list[int]) -> list[CampaignChart]:
    """Give each chart its place in `ids`, which names each of the campaign's charts once; them in that order."""
    with transaction.atomic():
        charts = list(CampaignChart.objects.filter(campaign_id=campaign_id).order_by("order", "id").select_for_update())
        if len(set(ids)) != len(ids) or set(ids) != {chart.id for chart in charts}:
            raise CampaignError(ORDER_REFUSED, code="campaign_charts_order", fields={"ids": [ORDER_REFUSED]})
        place = {chart_id: index for index, chart_id in enumerate(ids)}
        for chart in charts:
            chart.order = place[chart.id]
        CampaignChart.objects.bulk_update(charts, ["order"])
    return sorted(charts, key=lambda chart: chart.order)
