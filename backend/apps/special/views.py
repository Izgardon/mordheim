from apps.core.catalogue.kinds import SPECIALS
from apps.core.catalogue.views import CatalogueDetailView, CatalogueListView


class SpecialListView(CatalogueListView):
    kind = SPECIALS


class SpecialDetailView(CatalogueDetailView):
    kind = SPECIALS
