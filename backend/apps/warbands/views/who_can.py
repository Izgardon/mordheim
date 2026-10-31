"""What a warband can usually buy, hire and learn, and the warband groups who-can lists name (the items rebuild)."""

from rest_framework import permissions
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.warbands.models import WarbandGroup
from apps.warbands.services.offers import who_can

from .base import WarbandScopedView


class WarbandWhoCanView(WarbandScopedView):
    """GET warbands/<id>/who-can/: each item's price row for this warband with `can_buy` and the reason, each hired
    sword's and dramatis persona's `can_hire` and reason, and the special skills its types may learn; any member reads
    it, as the warband (services/offers.py: a fixed number of queries)."""

    def get(self, request: Request, warband_id: int) -> Response:
        return Response(who_can(self.warband))


class WarbandGroupListView(APIView):
    """GET warband-groups/: the races and sides a who-can list may name (one query; any signed-in user)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request) -> Response:
        rows = WarbandGroup.objects.order_by("sort_order", "name").values("id", "slug", "name", "kind")
        return Response(list(rows))
