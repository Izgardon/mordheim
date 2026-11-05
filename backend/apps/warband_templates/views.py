"""Warband templates through the generic catalogue views (apps/core/catalogue). `GET warband-templates/` lists the
book's or a campaign's (`?campaign_id=`, each template and type saying whether it is in play there); `POST` makes one
of the campaign's own, blank or as a copy (the templates plan, phase 4: services/making.py), answering what the editor
reads; `GET warband-templates/<id>/` is one whole template, and `DELETE` deletes a campaign's own (archived while a
warband uses it), removes a book template for the campaign, or refuses a house version (Revert it). The editor's
routes are editor_views.py.

Raising and hiring (phase 2): `GET warbands/<id>/template/` is the warband's template with its variant applied, what
it has of each fighter and whether list prices are open; `GET campaigns/<id>/warband-types/<type>/template/` the
template a warband of the type would be raised from, in outline (`?variant=` for a type that presets none)."""

from typing import Any

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.campaigns.views.base import CampaignScopedView
from apps.core.catalogue import names
from apps.core.catalogue.kinds import WARBAND_TEMPLATES
from apps.core.catalogue.views import CatalogueCollectionView, CatalogueEntryView
from apps.core.catalogue.writes import catalogue_write
from apps.warbands.views.base import WarbandScopedView

from .editor_serializers import CreateTemplateSerializer
from .models import DEFAULT_STARTING_GOLD
from .services.editor import editor_payload
from .services.making import make_template
from .services.payload import raise_outline, warband_template

READ_ONLY = {"GET": "view"}


class WarbandTemplateListView(CatalogueCollectionView):
    kind = WARBAND_TEMPLATES
    rules = {"GET": "view", "POST": "edit_catalogue"}

    def get(self, request: Request) -> Any:
        return self.list(request)

    def post(self, request: Request) -> Response:
        campaign_id = self.campaign_id
        assert campaign_id is not None  # load_scope found it
        sent = CreateTemplateSerializer(data=request.data, context={"campaign_id": campaign_id})
        sent.is_valid(raise_exception=True)
        data = sent.validated_data
        names.check_create(self.kind, campaign_id, data["name"])
        with catalogue_write(self.kind, campaign_id, data["name"], socket_id=self.socket_id()):
            template = make_template(campaign_id, data["name"], data["type_ids"], data.get("source"), request.user)
        body = editor_payload(template.pk, campaign_id, self.access.settings)
        return Response(body, status=status.HTTP_201_CREATED)


class WarbandTemplateDetailView(CatalogueEntryView):
    kind = WARBAND_TEMPLATES
    rules = {"GET": "view", "DELETE": "delete_catalogue"}

    def get(self, request: Request, **kwargs: Any) -> Response:
        return self.read()

    def delete(self, request: Request, **kwargs: Any) -> Response:
        return self.destroy()


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
