"""The preset's charts as the campaign's own: copied in order, and never twice.

A chart whose title the campaign already holds is left alone, as a rule is (`rules.py`), so changing preset, or
adding the preset's content again after editing a chart, copies only what is missing.
"""

from django.db.models import Max

from apps.campaigns.models import Campaign, CampaignChart, CampaignChartRow

from ..models import CampaignPreset, CampaignPresetChart


def missing_charts(campaign_id: int, preset: CampaignPreset | None) -> list[CampaignPresetChart]:
    """The preset's standalone charts the campaign holds none of by title, in the preset's order (two queries)."""
    if preset is None:
        return []
    held = {
        title.strip().lower()
        for title in CampaignChart.objects.filter(campaign_id=campaign_id).values_list("title", flat=True)
    }
    # a chart belonging to a rule rides with that rule, never on its own (rules.py)
    return [chart for chart in preset.charts.all() if chart.rule_id is None and chart.title.strip().lower() not in held]


def copy_charts(campaign: Campaign, preset: CampaignPreset | None) -> int:
    """Copy the preset's missing charts onto the campaign's, after the charts it has, with their results. How many
    were copied; one INSERT for the charts and one for every result between them."""
    charts = missing_charts(campaign.pk, preset)
    if not charts:
        return 0
    last = CampaignChart.objects.filter(campaign=campaign).aggregate(last=Max("order"))["last"]
    start = 0 if last is None else last + 1
    written = CampaignChart.objects.bulk_create(
        CampaignChart(
            campaign=campaign,
            title=chart.title,
            description=chart.description,
            dice=chart.dice,
            note=chart.note,
            umbrella=chart.umbrella,
            order=start + place,
        )
        for place, chart in enumerate(charts)
    )
    CampaignChartRow.objects.bulk_create(
        CampaignChartRow(chart=copy, result=row.result, name=row.name, text=row.text, order=index)
        for copy, chart in zip(written, charts, strict=True)
        for index, row in enumerate(chart.rows.all())
    )
    return len(charts)
