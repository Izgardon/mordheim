"""Reading the presets in a fixed number of queries, whatever they hold."""

from django.db.models import Count, Q, QuerySet

from apps.campaigns.models import Campaign

from .models import CampaignPreset


def preset_rows() -> QuerySet[CampaignPreset]:
    """Every preset with its chart, the settings it guides towards, and how many rules and standalone charts it
    holds: two queries. The counts are what the dialog says a change would copy in, so a table belonging to a rule
    or to one result is not counted -- it rides with its owner."""
    standalone = Q(charts__rule__isnull=True) & Q(charts__row__isnull=True)
    return (
        CampaignPreset.objects.select_related("exploration_chart")
        .prefetch_related("settings")
        .annotate(
            rule_count=Count("rules", distinct=True),
            chart_count=Count("charts", filter=standalone, distinct=True),
        )
        .order_by("sort_order", "name")  # a count annotation drops Meta.ordering
    )


def chart_names(presets: list[CampaignPreset]) -> dict[int, str]:
    """The name of each chart the presets dictate, from the rows already read (no query)."""
    return {
        preset.exploration_chart_id: preset.exploration_chart.name
        for preset in presets
        if preset.exploration_chart_id is not None and preset.exploration_chart is not None
    }


def preset_of(campaign: Campaign) -> CampaignPreset | None:
    """The campaign's preset with its settings, its rules and each one's own table, and its charts with their
    results (eight queries), or None for one that picked none."""
    if campaign.preset_id is None:
        return None
    return preset_rows().prefetch_related("rules__charts__rows", "charts__rows").filter(pk=campaign.preset_id).first()
