from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.permissions import get_membership
from apps.warbands.services.sheet import warband_sheet

from .mixins import WarbandObjectMixin


class WarbandSheetView(WarbandObjectMixin, APIView):
    """GET the whole warband sheet in one request (PERF-24); viewable by campaign members, like the warband."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, warband_id):
        warband, error_response = self.get_warband_or_404(warband_id)
        if error_response:
            return error_response

        # CanViewWarband's check, keeping the membership for the capability flags
        membership = get_membership(request.user, warband.campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        return Response(warband_sheet(warband, request.user, membership))
