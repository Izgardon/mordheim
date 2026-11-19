"""The preset's rules as the campaign's own: copied in order, and never twice.

A rule whose title the campaign already holds is left alone (`POST warbands/<id>/rules/from-template/` does the
same for a warband), so changing preset, or adding its rules again after editing one, copies only what is missing.
"""

from django.db.models import Max

from apps.campaigns.models import Campaign, CampaignChart, CampaignChartRow, CampaignRule

from ..models import CampaignPreset, CampaignPresetRule


def _titles_held(campaign_id: int) -> set[str]:
    return {
        title.strip().lower()
        for title in CampaignRule.objects.filter(campaign_id=campaign_id).values_list("title", flat=True)
    }


def missing_rules(campaign_id: int, preset: CampaignPreset | None) -> list[CampaignPresetRule]:
    """The preset's rules the campaign holds none of by title, in the preset's order (two queries)."""
    if preset is None:
        return []
    held = _titles_held(campaign_id)
    return [rule for rule in preset.rules.all() if rule.title.strip().lower() not in held]


def copy_rules(campaign: Campaign, preset: CampaignPreset | None) -> int:
    """Copy the preset's missing rules onto the campaign's, after the rules it has, in the preset's order (one
    INSERT), each with its own table where the preset's rule had one. How many were copied."""
    rules = missing_rules(campaign.pk, preset)
    if not rules:
        return 0
    last = CampaignRule.objects.filter(campaign=campaign).aggregate(last=Max("order"))["last"]
    start = 0 if last is None else last + 1
    written = CampaignRule.objects.bulk_create(
        CampaignRule(
            campaign=campaign,
            kind=rule.kind,
            title=rule.title,
            body=rule.text,
            umbrella=rule.umbrella,
            order=start + place,
        )
        for place, rule in enumerate(rules)
    )
    _copy_tables(campaign, rules, written)
    return len(rules)


def _copy_tables(campaign: Campaign, rules: list[CampaignPresetRule], written: list[CampaignRule]) -> None:
    """Each copied rule's own table, where the preset's rule had one: one INSERT for the charts and one for every
    result between them."""
    pairs = [(copy, table) for copy, rule in zip(written, rules, strict=True) for table in rule.charts.all()[:1]]
    if not pairs:
        return
    charts = CampaignChart.objects.bulk_create(
        CampaignChart(
            campaign=campaign,
            rule=copy,
            title=table.title,
            description=table.description,
            dice=table.dice,
            note=table.note,
        )
        for copy, table in pairs
    )
    CampaignChartRow.objects.bulk_create(
        CampaignChartRow(chart=chart, result=row.result, name=row.name, text=row.text, order=index)
        for chart, (_copy, table) in zip(charts, pairs, strict=True)
        for index, row in enumerate(table.rows.all())
    )
