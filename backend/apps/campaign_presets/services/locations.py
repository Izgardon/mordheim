"""The preset's locations as the campaign's own: copied in its order, and never twice.

A location whose name the campaign already lists is left alone, as a rule is by its title (`rules.py`), so changing
preset, or taking a preset up again after editing a location, copies only what is missing. A missing location goes
last into the campaign's group of its group's name, which is made (after the campaign's others, with the preset's
description and restrictions) when the campaign lists none. Its own tables come with it, and its links point to the
campaign's tables of the titles the preset's pointed to; a table the campaign no longer holds is passed over.

Call it after the charts are copied (`swap.py`, campaign creation): the links find them by title.
"""

from collections.abc import Iterable

from django.db.models import Max, Prefetch

from apps.campaigns.models import (
    Campaign,
    CampaignChart,
    CampaignChartRow,
    CampaignLocation,
    CampaignLocationChart,
    CampaignLocationGroup,
)

from ..models import CampaignPreset, CampaignPresetLocation, CampaignPresetLocationChart, CampaignPresetLocationGroup
from .charts import copy_row_tables

PRESET_LOCATION_READS = ("tables__rows__charts__rows",)


def preset_locations(preset_ids: Iterable[int] | None = None) -> list[CampaignPresetLocation]:
    """Presets' locations with their group, own tables and links (five queries); every preset's when None."""
    links = CampaignPresetLocationChart.objects.select_related("chart").order_by("order", "id")
    rows = CampaignPresetLocation.objects.select_related("group").prefetch_related(
        *PRESET_LOCATION_READS, Prefetch("chart_links", queryset=links)
    )
    if preset_ids is not None:
        rows = rows.filter(group__preset_id__in=list(preset_ids))
    return list(rows.order_by("group__order", "group_id", "order", "id"))


def _listed_names(campaign_id: int) -> set[str]:
    rows = CampaignLocation.objects.filter(campaign_id=campaign_id, removed_at__isnull=True, group__removed_at=None)
    return {name.strip().casefold() for name in rows.values_list("name", flat=True)}


def missing_locations(campaign_id: int, preset: CampaignPreset | None) -> list[CampaignPresetLocation]:
    """The preset's locations the campaign lists none of by name, in the preset's order."""
    if preset is None:
        return []
    held = _listed_names(campaign_id)
    return [place for place in preset_locations([preset.pk]) if place.name.strip().casefold() not in held]


def _groups_for(campaign: Campaign, sources: list[CampaignPresetLocationGroup]) -> dict[int, CampaignLocationGroup]:
    """The campaign's group for each preset group, by name: its listed one, else one made last (one INSERT)."""
    listed = CampaignLocationGroup.objects.filter(campaign=campaign, removed_at__isnull=True)
    by_name = {group.name.strip().casefold(): group for group in listed}
    wanted = [group for group in sources if group.name.strip().casefold() not in by_name]
    last = CampaignLocationGroup.objects.filter(campaign=campaign).aggregate(last=Max("order"))["last"]
    start = 0 if last is None else last + 1
    made = CampaignLocationGroup.objects.bulk_create(
        CampaignLocationGroup(
            campaign=campaign,
            name=group.name,
            description=group.description,
            restrictions=group.restrictions,
            order=start + place,
        )
        for place, group in enumerate(wanted)
    )
    by_name |= {group.name.strip().casefold(): group for group in made}
    return {group.pk: by_name[group.name.strip().casefold()] for group in sources}


def copy_locations(campaign: Campaign, preset: CampaignPreset | None) -> int:
    """Copy the preset's missing locations into the campaign's groups, with their tables and links; how many."""
    places = missing_locations(campaign.pk, preset)
    if not places:
        return 0
    sources = list({place.group_id: place.group for place in places}.values())
    groups = _groups_for(campaign, sources)
    lasts = dict(
        CampaignLocation.objects.filter(group__in=list(groups.values()))
        .values("group")
        .annotate(last=Max("order"))
        .values_list("group", "last")
    )
    next_order = {group.pk: lasts.get(group.pk, -1) + 1 for group in groups.values()}
    written = []
    for place in places:
        group = groups[place.group_id]
        written.append(
            CampaignLocation(
                campaign=campaign,
                group=group,
                name=place.name,
                rules=place.rules,
                min_heroes=place.min_heroes,
                max_heroes=place.max_heroes,
                takes_trading_action=place.takes_trading_action,
                order=next_order[group.pk],
            )
        )
        next_order[group.pk] += 1
    CampaignLocation.objects.bulk_create(written)
    _copy_tables(campaign, places, written)
    _copy_links(campaign, places, written)
    return len(written)


def _copy_tables(campaign: Campaign, places: list[CampaignPresetLocation], written: list[CampaignLocation]) -> None:
    """Each copied location's own tables, their results and the results' tables."""
    pairs = [(copy, table) for copy, place in zip(written, places, strict=True) for table in place.tables.all()]
    if not pairs:
        return
    tables = CampaignChart.objects.bulk_create(
        CampaignChart(
            campaign=campaign,
            location=copy,
            title=table.title,
            description=table.description,
            dice=table.dice,
            note=table.note,
            order=place,
        )
        for place, (copy, table) in enumerate(pairs)
    )
    sources = [row for _, table in pairs for row in table.rows.all()]
    rows = CampaignChartRow.objects.bulk_create(
        CampaignChartRow(chart=chart, result=row.result, name=row.name, text=row.text, order=index)
        for chart, (_, table) in zip(tables, pairs, strict=True)
        for index, row in enumerate(table.rows.all())
    )
    copy_row_tables(campaign, sources, rows)


def _copy_links(campaign: Campaign, places: list[CampaignPresetLocation], written: list[CampaignLocation]) -> None:
    """Each copied location's links, to the campaign's tables of the titles its preset location pointed to."""
    looked_up = CampaignChart.objects.filter(
        campaign=campaign, rule__isnull=True, row__isnull=True, location__isnull=True
    ).only("id", "title")
    by_title = {chart.title.strip().casefold(): chart.pk for chart in looked_up}
    CampaignLocationChart.objects.bulk_create(
        CampaignLocationChart(location=copy, chart_id=by_title[title], order=index)
        for copy, place in zip(written, places, strict=True)
        for index, title in enumerate(link.chart.title.strip().casefold() for link in place.chart_links.all())
        if title in by_title
    )
