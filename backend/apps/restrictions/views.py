from rest_framework.request import Request
from rest_framework.response import Response

from apps.core.catalogue.kinds import RESTRICTIONS
from apps.core.catalogue.views import CatalogueCollectionView


class RestrictionListView(CatalogueCollectionView):
    """The restrictions list. Read-only: the seeders write the book's rows (SEC-06 removed the POST, which let anyone
    signed in add a row every campaign listed)."""

    kind = RESTRICTIONS

    def get(self, request: Request) -> Response:
        return self.list(request)
