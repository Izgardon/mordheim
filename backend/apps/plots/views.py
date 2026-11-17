"""The plots' routes: the catalogue's (apps/core/catalogue/views.py) and the campaign's own list of them.

`GET campaigns/<id>/plots/` is the plots the campaign plays with, each whole: its scoring lines and its ladder, and
whether its setting is in play (a plot out of play is listed and still played with; restrictions warn, they never
block). `PUT` replaces the list (`edit_settings`, the owner, as every other campaign setting).
"""

from typing import Any

from django.db import transaction
from django.http.response import HttpResponseBase
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from apps.campaigns.views.base import CampaignScopedView
from apps.core.catalogue.kinds import PLOTS
from apps.core.catalogue.rows import PlotDetailRowSerializer
from apps.core.catalogue.scope import refuse_unknown
from apps.core.catalogue.views import CatalogueCollectionView, CatalogueEntryView
from apps.realtime.services import sender_socket_id

from .models import Plot
from .selectors import campaign_plots
from .writes import set_campaign_plots


class PlotListView(CatalogueCollectionView):
    kind = PLOTS
    rules = {"GET": "view", "POST": "edit_catalogue"}

    def get(self, request: Request) -> HttpResponseBase:
        return self.list(request)

    def post(self, request: Request) -> Response:
        return self.create(request)


class PlotDetailView(CatalogueEntryView):
    kind = PLOTS
    rules = {"GET": "view", "PATCH": "edit_catalogue", "DELETE": "delete_catalogue"}

    def get(self, request: Request, **kwargs: Any) -> Response:
        return self.read()

    def patch(self, request: Request, **kwargs: Any) -> Response:
        return self.edit(partial=True)

    def delete(self, request: Request, **kwargs: Any) -> Response:
        return self.destroy()


class CampaignPlotsInput(serializers.Serializer):
    plot_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=True)


class CampaignPlotsView(CampaignScopedView):
    """GET: the plots the campaign plays with. PUT: the list it plays with becomes the ids sent."""

    rules = {"GET": "view", "PUT": "edit_settings"}

    def get(self, request: Request, campaign_id: int) -> Response:
        return Response(self.body(campaign_id))

    def put(self, request: Request, campaign_id: int) -> Response:
        payload = CampaignPlotsInput(data=request.data)
        payload.is_valid(raise_exception=True)
        sent = payload.validated_data["plot_ids"]
        with transaction.atomic():
            # the book's plots and the campaign's own, each as the campaign's current entry for it (SEC-07)
            current = refuse_unknown(Plot.objects.all(), sent, campaign_id)
            set_campaign_plots(campaign_id, [current[pk] for pk in sent], sender_socket_id(request))
        return Response(self.body(campaign_id))

    def body(self, campaign_id: int) -> list[dict[str, Any]]:
        rows = campaign_plots(campaign_id)
        return [dict(PlotDetailRowSerializer(plot).data) for plot in rows]
