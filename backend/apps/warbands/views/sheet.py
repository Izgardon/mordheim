from rest_framework.request import Request
from rest_framework.response import Response

from apps.warbands.services.sheet import warband_sheet

from .base import WarbandScopedView


class WarbandSheetView(WarbandScopedView):
    """GET the whole warband sheet in one request (PERF-24); viewable by campaign members, like the warband."""

    def get(self, request: Request, warband_id: int) -> Response:
        return Response(warband_sheet(self.warband, self.capabilities()))
