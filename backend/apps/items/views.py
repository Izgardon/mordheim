from rest_framework.request import Request
from rest_framework.response import Response

from apps.core.catalogue.kinds import ITEM_PROPERTIES, ITEMS
from apps.core.catalogue.views import CatalogueDetailView, CatalogueEntryView, CatalogueListView


class ItemListView(CatalogueListView):
    kind = ITEMS


class ItemDetailView(CatalogueDetailView):
    kind = ITEMS


class ItemPropertyListView(CatalogueListView):
    kind = ITEM_PROPERTIES


class ItemPropertyDetailView(CatalogueEntryView):
    kind = ITEM_PROPERTIES  # read only: properties are added, never edited or deleted

    def get(self, request: Request, property_id: int) -> Response:
        return self.read()
