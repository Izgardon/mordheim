"""Which chart a campaign explores by, read in a fixed number of queries whatever the chart holds.

A campaign picks one (`CampaignSettings.exploration_chart`); null is the book's Mordheim chart, a seeded row like
any other, so null is a default and never a special case below. A picked book chart the campaign has a house version
of reads as that version (apps/core/catalogue/current.py), as every other catalogue id does.
"""

from django.db.models import Prefetch, Q, QuerySet

from apps.campaigns.in_play import with_in_play
from apps.campaigns.models import CampaignSettings
from apps.core.catalogue import current

from .chart import Chart, empty_chart, read_chart
from .models import ExplorationChart, ExplorationPlace

BOOK_SLUG = "mordheim"  # the book's chart, which a campaign that picks none explores by


def chart_rows(campaign_id: int | None = None, *, in_play: bool = False) -> QuerySet[ExplorationChart]:
    """Charts with their places (one more query); with `in_play`, whether each is in play in the campaign."""
    places = ExplorationPlace.objects.order_by("count", "face", "id")
    rows = ExplorationChart.objects.prefetch_related(Prefetch("places", queryset=places))
    return with_in_play(rows, campaign_id) if in_play and campaign_id is not None else rows


def _book_chart(campaign_id: int | None, rows: QuerySet[ExplorationChart]) -> ExplorationChart | None:
    """The book's chart, or the campaign's version of it: one query (and one for its places)."""
    book = Q(campaign__isnull=True, slug=BOOK_SLUG)
    if campaign_id is None:
        only_book: ExplorationChart | None = rows.filter(book).first()
        return only_book
    version = Q(campaign_id=campaign_id, replaces__campaign__isnull=True, replaces__slug=BOOK_SLUG)
    found = list(rows.filter(book | version))
    return next((row for row in found if row.campaign_id == campaign_id), None) or next(
        (row for row in found if row.campaign_id is None), None
    )


def chart_row(campaign_id: int | None, chart_id: int | None, *, in_play: bool = False) -> ExplorationChart | None:
    """The chart row a campaign explores by: the one it picked (its current entry), else the book's."""
    rows = chart_rows(campaign_id, in_play=in_play)
    if chart_id is not None and campaign_id is not None:
        picked: ExplorationChart | None = current.current_rows(rows, [chart_id], campaign_id).get(chart_id)
        if picked is not None:
            return picked
    return _book_chart(campaign_id, rows)


def book_chart_id() -> int | None:
    """The seeded Mordheim chart, which a new campaign is given (`campaigns/services/campaigns.py`): a Django field
    can't default to a looked-up row. None until the catalogue is seeded, and null reads as this chart anyway."""
    found: int | None = (
        ExplorationChart.objects.filter(campaign__isnull=True, slug=BOOK_SLUG).values_list("id", flat=True).first()
    )
    return found


def picked_chart_id(campaign_id: int) -> int | None:
    return (
        CampaignSettings.objects.filter(campaign_id=campaign_id).values_list("exploration_chart_id", flat=True).first()
    )


def chart_for(campaign_id: int | None, chart_id: int | None = None) -> Chart:
    """The chart the campaign explores by, in two queries: the one its settings picked (`chart_id`, which the caller
    has read with its settings), else the book's. None: nothing picked, not "look it up"."""
    row = chart_row(campaign_id, chart_id)
    return empty_chart() if row is None else read_chart(row, row.places.all())


def chart_for_campaign(campaign_id: int) -> Chart:
    """`chart_for` for a caller holding no settings: one query more, for the chart the campaign picked."""
    return chart_for(campaign_id, picked_chart_id(campaign_id))
