"""Warband templates through the generic catalogue views (apps/core/catalogue): read only until the template editor
(the templates plan, phase 4). `GET warband-templates/` lists the book's or a campaign's (`?campaign_id=`, each
template and type saying whether it is in play there); `GET warband-templates/<id>/` is one whole template.

Raising and hiring (phase 2): `GET warbands/<id>/template/` is the warband's template with its variant applied, what
it has of each fighter and whether list prices are open; `GET campaigns/<id>/warband-types/<type>/template/` the
template a warband of the type would be raised from, in outline (`?variant=` for a type that presets none)."""

from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from apps.campaigns.views.base import CampaignScopedView
from apps.core.catalogue.kinds import WARBAND_TEMPLATES
from apps.core.catalogue.views import CatalogueCollectionView, CatalogueEntryView
from apps.warbands.views.base import WarbandScopedView

from .models import DEFAULT_STARTING_GOLD
from .services.payload import raise_outline, warband_template

READ_ONLY = {"GET": "view"}


class WarbandTemplateListView(CatalogueCollectionView):
    kind = WARBAND_TEMPLATES
    rules = READ_ONLY

    def get(self, request: Request) -> Any:
        return self.list(request)


class WarbandTemplateDetailView(CatalogueEntryView):
    kind = WARBAND_TEMPLATES
    rules = READ_ONLY

    def get(self, request: Request, **kwargs: Any) -> Response:
        return self.read()


class WarbandTemplateForWarbandView(WarbandScopedView):
    """Any member of the campaign reads it, as he reads the warband."""

    def get(self, request: Request, warband_id: int) -> Response:
        return Response(warband_template(self.warband))


class WarbandTypeTemplateView(CampaignScopedView):
    rules = READ_ONLY

    def get(self, request: Request, campaign_id: int, warband_type_id: int) -> Response:
        variant = str(request.query_params.get("variant") or "")[:40]
        settings = self.access.settings
        gold = settings.starting_gold if settings is not None else DEFAULT_STARTING_GOLD
        return Response(raise_outline(campaign_id, warband_type_id, variant, gold))
