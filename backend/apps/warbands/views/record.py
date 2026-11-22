"""A warband's last battles for its header's Record window."""

from rest_framework.request import Request
from rest_framework.response import Response

from apps.warbands.services.battle_record import warband_record

from .base import WarbandScopedView


class WarbandRecordView(WarbandScopedView):
    """GET warbands/<id>/record/: its last ten ended battles, newest first, each with its number, the other warbands
    and its result (services/battle_record.py: two queries); any member reads it, as the warband."""

    def get(self, request: Request, warband_id: int) -> Response:
        return Response(warband_record(self.warband))
