"""The plots a campaign plays with, read in a fixed number of queries whatever the plots hold.

The campaign's own `CampaignPlot` rows are its whole list. They are written once, when Plots (campaign points) is
switched on: the campaign is given the plots of the settings it has in play, which is William's guide ("Only on
campaign selection do we just guide to a certain list of plots"). From then on the list is the rows, so no reader
anywhere reasons about an empty list meaning something else — the mistake the exploration chart's null made.

A row that names a book plot the campaign has since made its house version of reads as that version, as every other
catalogue id does (apps/core/catalogue/current.py).
"""

from django.db.models import QuerySet

from apps.campaigns.in_play import in_play, with_in_play
from apps.core.catalogue import current, merge

from .models import CampaignPlot, Plot, PlotAchievement


def plot_rows() -> QuerySet[Plot]:
    """Plots with their scoring lines and their ladders (two more queries)."""
    return Plot.objects.prefetch_related("scoring_lines", "achievements")


def picked_plot_ids(campaign_id: int) -> list[int]:
    """The plot ids the campaign holds, as they were picked (one query)."""
    return list(CampaignPlot.objects.filter(campaign_id=campaign_id).values_list("plot_id", flat=True))


def default_plot_ids(campaign_id: int) -> list[int]:
    """The plots a campaign is given when Plots is switched on: those of the settings it has in play, as the
    campaign's catalogue shows them (its own entries and versions in place of the book's)."""
    from apps.core.catalogue.kinds import PLOTS  # the registry imports this app's serializers

    rows = merge.campaign_list(PLOTS, Plot.objects.all(), campaign_id).filter(in_play(campaign_id))
    return list(rows.order_by("name", "id").values_list("id", flat=True))


def plays_with(campaign_id: int) -> set[int]:
    """The ids the campaign's plots are known by now: each pick as the campaign's current entry for it (its version
    of a book plot, else the plot itself). What a warband may follow (two queries)."""
    picked = picked_plot_ids(campaign_id)
    if not picked:
        return set()
    found = current.current_rows(Plot.objects.all(), picked, campaign_id)
    return {plot.pk for plot in found.values()}


def warband_plot(plot_id: int | None) -> dict[str, object] | None:
    """The plot a warband follows, as its page reads it: its name, and its ladder's points for the track (two
    queries; none when it follows none). Its lines are in the rules its plot wrote
    (warbands/services/plot_rules.py)."""
    if plot_id is None:
        return None
    row = Plot.objects.filter(pk=plot_id).values("id", "name").first()
    if row is None:
        return None
    rungs = PlotAchievement.objects.filter(plot_id=plot_id).order_by("points", "id")
    return {**row, "rungs": list(dict.fromkeys(rungs.values_list("points", flat=True)))}


def campaign_plots(campaign_id: int) -> list[Plot]:
    """The plots the campaign plays with, by name, each with its lines and whether it is in play (four queries: the
    ids it picked, the plots, their scoring lines and their ladders)."""
    picked = picked_plot_ids(campaign_id)
    if not picked:
        return []
    rows = with_in_play(plot_rows(), campaign_id)
    found = current.current_rows(rows, picked, campaign_id)
    unique = {plot.pk: plot for plot in found.values()}
    return sorted(unique.values(), key=lambda plot: (plot.name.lower(), plot.pk))
