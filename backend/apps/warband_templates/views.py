"""Warband templates through the generic catalogue views (apps/core/catalogue): read only until the template editor
(the templates plan, phase 4). `GET warband-templates/` lists the book's or a campaign's (`?campaign_id=`, each
template and type saying whether it is in play there); `GET warband-templates/<id>/` is one whole template."""

from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from apps.core.catalogue.kinds import WARBAND_TEMPLATES
from apps.core.catalogue.views import CatalogueCollectionView, CatalogueEntryView

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
