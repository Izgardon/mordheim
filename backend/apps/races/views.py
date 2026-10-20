from rest_framework.request import Request
from rest_framework.response import Response

from apps.core.catalogue.kinds import RACES
from apps.core.catalogue.views import CatalogueEntryView, CatalogueListView


class RaceListView(CatalogueListView):
    kind = RACES


class RaceDetailView(CatalogueEntryView):
    kind = RACES  # no detail read; an edit may send the whole race (PUT)

    def put(self, request: Request, race_id: int) -> Response:
        return self.edit(partial=False)

    def patch(self, request: Request, race_id: int) -> Response:
        return self.edit(partial=True)

    def delete(self, request: Request, race_id: int) -> Response:
        return self.destroy()
