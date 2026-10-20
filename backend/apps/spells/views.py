from apps.core.catalogue.kinds import SPELLS
from apps.core.catalogue.views import CatalogueDetailView, CatalogueListView


class SpellListView(CatalogueListView):
    kind = SPELLS


class SpellDetailView(CatalogueDetailView):
    kind = SPELLS
