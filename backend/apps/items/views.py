from rest_framework.request import Request
from rest_framework.response import Response

from apps.core.catalogue.kinds import ITEM_RULES, ITEMS
from apps.core.catalogue.views import CatalogueDetailView, CatalogueEntryView, CatalogueListView


class ItemListView(CatalogueListView):
    kind = ITEMS


class ItemDetailView(CatalogueDetailView):
    kind = ITEMS


class ItemRuleListView(CatalogueListView):
    kind = ITEM_RULES


class ItemRuleDetailView(CatalogueEntryView):
    kind = ITEM_RULES  # read only: shared rules are added, never edited or deleted

    def get(self, request: Request, rule_id: int) -> Response:
        return self.read()
