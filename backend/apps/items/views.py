from apps.core.catalogue.kinds import ITEM_RULES, ITEMS
from apps.core.catalogue.views import CatalogueDetailView, CatalogueListView


class ItemListView(CatalogueListView):
    kind = ITEMS


class ItemDetailView(CatalogueDetailView):
    kind = ITEMS


class ItemRuleListView(CatalogueListView):
    kind = ITEM_RULES
