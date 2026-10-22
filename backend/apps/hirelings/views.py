"""The hireling catalogue's routes: each kind's list and detail are the catalogue's generic views (revert, restore
and usage come from apps/core/catalogue/routes.py)."""

from apps.core.catalogue.kinds import DRAMATIS_PERSONAE, HIRED_SWORDS
from apps.core.catalogue.views import CatalogueDetailView, CatalogueListView


class HiredSwordListView(CatalogueListView):
    kind = HIRED_SWORDS


class HiredSwordDetailView(CatalogueDetailView):
    kind = HIRED_SWORDS


class DramatisPersonaListView(CatalogueListView):
    kind = DRAMATIS_PERSONAE


class DramatisPersonaDetailView(CatalogueDetailView):
    kind = DRAMATIS_PERSONAE
