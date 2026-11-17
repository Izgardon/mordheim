"""Plots and a campaign's list of them, written in the catalogue's one transaction.

A plot's write replaces each list it sends (`scoring`, `achievements`) and leaves out the lists it doesn't. The
campaign's list of plots is replaced whole (`set_campaign_plots`): the rows are the whole list, so an empty list is
an empty list.
"""

from collections.abc import Iterable, Mapping
from typing import Any

from apps.core.catalogue.cache import bump

from .models import CampaignPlot, Plot, PlotAchievement, PlotScoringLine
from .selectors import default_plot_ids, picked_plot_ids

LISTS = ("scoring", "achievements")


def _write_lists(plot: Plot, data: Mapping[str, Any], *, replace: bool) -> None:
    """Each list `data` holds becomes the plot's (one INSERT each); the scoring lines keep the order they were sent."""
    if "scoring" in data:
        if replace:
            PlotScoringLine.objects.filter(plot=plot).delete()
        PlotScoringLine.objects.bulk_create(
            [
                PlotScoringLine(plot=plot, position=position, **line)
                for position, line in enumerate(data["scoring"], start=1)
            ]
        )
    if "achievements" in data:
        if replace:
            PlotAchievement.objects.filter(plot=plot).delete()
        PlotAchievement.objects.bulk_create([PlotAchievement(plot=plot, **rung) for rung in data["achievements"]])


def _fields(data: Mapping[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in data.items() if key not in LISTS}


def create_plot(campaign_id: int, data: Mapping[str, Any]) -> Plot:
    plot = Plot.objects.create(campaign_id=campaign_id, **_fields(data))
    _write_lists(plot, data, replace=False)
    return plot


def update_plot(plot: Plot, data: Mapping[str, Any]) -> None:
    fields = _fields(data)
    for field, value in fields.items():
        setattr(plot, field, value)
    if fields:
        plot.save(update_fields=list(fields))
    _write_lists(plot, data, replace=True)


def set_campaign_plots(campaign_id: int, plot_ids: Iterable[int], socket_id: str | None = None) -> list[int]:
    """The campaign's plots become `plot_ids` (already the campaign's current entries); the ids it now holds. Picking
    bumps the campaign's catalogue version, so a cached plots list is retired and the other members' open pages read
    the campaign's plots again (`catalogue.changed`)."""
    wanted = list(dict.fromkeys(plot_ids))
    held = set(CampaignPlot.objects.filter(campaign_id=campaign_id).values_list("plot_id", flat=True))
    if set(wanted) == held:
        return wanted
    CampaignPlot.objects.filter(campaign_id=campaign_id).exclude(plot_id__in=wanted).delete()
    CampaignPlot.objects.bulk_create(
        [CampaignPlot(campaign_id=campaign_id, plot_id=pk) for pk in wanted if pk not in held]
    )
    bump(campaign_id, "plots", socket_id=socket_id)
    return wanted


def give_default_plots(campaign_id: int, socket_id: str | None = None) -> list[int]:
    """The campaign is given its default plots unless it already holds a list of its own: what it holds after.

    Called when Plots (campaign points) is switched on (apps/campaigns/services/settings.py). Writing the default
    once is what keeps it a default: every reader afterwards reads the rows, and a campaign that unticks them all
    holds none rather than falling back to this."""
    held = picked_plot_ids(campaign_id)
    if held:
        return held
    return set_campaign_plots(campaign_id, default_plot_ids(campaign_id), socket_id)
