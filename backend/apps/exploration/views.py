"""The exploration charts' routes: the catalogue's (apps/core/catalogue/views.py) and the campaign's own chart.

`GET campaigns/<id>/exploration/` is the whole chart the campaign explores by — its income table, its dice rule and
its places with their rules text — in one request, answered from the catalogue's list cache while neither catalogue
has changed, so the Explore tab is one cached round trip. The post-game broadcast carries the places' names and ids
only; their rules text comes from here (its 10 KB budget: services/postbattle/suggested.py).
"""

from typing import Any

from django.http.response import HttpResponseBase
from rest_framework.request import Request
from rest_framework.response import Response

from apps.campaigns.views.base import CampaignScopedView
from apps.core.catalogue import cache
from apps.core.catalogue.kinds import EXPLORATION_CHARTS
from apps.core.catalogue.views import CatalogueCollectionView, CatalogueEntryView

from .chart import read_chart
from .models import ExplorationChart
from .payload import chart_payload
from .selectors import chart_row, picked_chart_id


class ExplorationChartListView(CatalogueCollectionView):
    kind = EXPLORATION_CHARTS
    rules = {"GET": "view"}

    def get(self, request: Request) -> HttpResponseBase:
        return self.list(request)


class ExplorationChartDetailView(CatalogueEntryView):
    kind = EXPLORATION_CHARTS
    rules = {"GET": "view", "DELETE": "delete_catalogue"}

    def get(self, request: Request, **kwargs: Any) -> Response:
        return self.read()

    def delete(self, request: Request, **kwargs: Any) -> Response:
        return self.destroy()


class CampaignExplorationView(CampaignScopedView):
    """GET: the chart the campaign explores by, whole."""

    rules = {"GET": "view"}

    def get(self, request: Request, campaign_id: int) -> HttpResponseBase:
        settings = self.access.settings
        version = settings.catalogue_version if settings else None
        key = cache.list_key(EXPLORATION_CHARTS.key, campaign_id, version, request)
        hit = cache.cached_response(key) if key else None
        if hit is not None:
            return hit
        response = Response(self.body(campaign_id, settings))
        if key:
            response.add_post_render_callback(cache.remembered(key))
        return response

    def body(self, campaign_id: int, settings: Any) -> dict[str, Any]:
        picked = settings.exploration_chart_id if settings is not None else picked_chart_id(campaign_id)
        row = chart_row(campaign_id, picked, in_play=True)
        if row is None:
            return chart_payload(read_chart(ExplorationChart(name=""), ()))
        chart = read_chart(row, row.places.all())
        in_play: bool = getattr(row, "in_play", True)  # annotated by the selector (apps/campaigns/in_play.py)
        return chart_payload(chart, in_play=in_play, setting_id=row.campaign_type_id)
