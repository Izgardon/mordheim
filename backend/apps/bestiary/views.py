from apps.core.catalogue.kinds import BESTIARY
from apps.core.catalogue.views import CatalogueDetailView, CatalogueListView


class BestiaryEntryListView(CatalogueListView):
    kind = BESTIARY


class BestiaryEntryDetailView(CatalogueDetailView):
    kind = BESTIARY
