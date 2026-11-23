"""A location's own tables and the campaign tables it points to, written afresh as the request sent them.

Nothing matches a table sent to a table stored: a location's tables are replaced in one go (their results and the
sub-tables hanging off results go with them), in the order sent, inside the caller's transaction.
"""

from typing import Any

from ..errors import CampaignError
from ..models import CampaignChart, CampaignChartRow, CampaignLocation, CampaignLocationChart

UNKNOWN_CHART = "Point only to the campaign's own tables."


def write_tables(location: CampaignLocation, tables: list[dict[str, Any]]) -> None:
    """The location's own tables: one INSERT for the tables, one for their results, and two more only when a
    result carries a table of its own."""
    location.tables.all().delete()
    if not tables:
        return
    written = CampaignChart.objects.bulk_create(
        CampaignChart(
            campaign_id=location.campaign_id,
            location=location,
            title=table["title"],
            description=table.get("description", ""),
            dice=table.get("dice", ""),
            note=table.get("note", ""),
            order=place,
        )
        for place, table in enumerate(tables)
    )
    sources = [row for table in tables for row in table.get("rows", [])]
    rows = CampaignChartRow.objects.bulk_create(
        _row(chart, row, index)
        for chart, table in zip(written, tables, strict=True)
        for index, row in enumerate(table.get("rows", []))
    )
    pairs = [(row, source["chart"]) for row, source in zip(rows, sources, strict=True) if source.get("chart")]
    if not pairs:
        return
    subs = CampaignChart.objects.bulk_create(
        CampaignChart(
            campaign_id=location.campaign_id,
            row=row,
            title=row.name or row.result,
            description=sub.get("description", ""),
            dice=sub.get("dice", ""),
            note=sub.get("note", ""),
        )
        for row, sub in pairs
    )
    CampaignChartRow.objects.bulk_create(
        _row(chart, row, index)
        for chart, (_row_of, sub) in zip(subs, pairs, strict=True)
        for index, row in enumerate(sub.get("rows", []))
    )


def _row(chart: CampaignChart, row: dict[str, Any], place: int) -> CampaignChartRow:
    return CampaignChartRow(
        chart=chart, result=row["result"], name=row.get("name", ""), text=row.get("text", ""), order=place
    )


def write_links(location: CampaignLocation, chart_ids: list[int]) -> None:
    """The campaign tables the location points to, in the order sent (each once). A table that is another
    campaign's, or a rule's, a result's or a location's own, is refused: it is no table a player looks up."""
    wanted = list(dict.fromkeys(chart_ids))
    found = set(
        CampaignChart.objects.filter(
            id__in=wanted, campaign_id=location.campaign_id, rule__isnull=True, row__isnull=True, location__isnull=True
        ).values_list("id", flat=True)
    )
    if found != set(wanted):
        raise CampaignError(UNKNOWN_CHART, code="location_chart_unknown", fields={"chart_ids": [UNKNOWN_CHART]})
    location.chart_links.all().delete()
    CampaignLocationChart.objects.bulk_create(
        CampaignLocationChart(location=location, chart_id=chart_id, order=place)
        for place, chart_id in enumerate(wanted)
    )
