"""POST warbands/<id>/location-visits/: the warband's own player sends heroes to one of the campaign's locations
(William, 23 Nov 2026; services/location_visits.py). The Locations page must be switched on."""

from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from apps.campaigns.services.locations import visitable
from apps.warbands.services.location_visits import VisitRefused, visit_location
from apps.warbands.units.errors import RosterError, validation_error

from .base import WarbandScopedView


class LocationVisitSerializer(serializers.Serializer):
    location_id = serializers.IntegerField()
    hero_ids = serializers.ListField(child=serializers.IntegerField(), min_length=1, max_length=50)


class WarbandLocationVisitView(WarbandScopedView):
    """The heroes' trading actions spent where the location takes them, one log line, and the warnings (too few or
    too many heroes, an action already spent); nothing else is applied."""

    def post(self, request: Request, warband_id: int) -> Response:
        body = LocationVisitSerializer(data=request.data)
        if not body.is_valid():
            raise validation_error(body.errors)
        settings = getattr(self.warband.campaign, "settings", None)
        location = visitable(self.warband.campaign_id, body.validated_data["location_id"])
        if location is None or not (settings and settings.enable_locations):
            raise NotFound("Not found")
        try:
            answer = visit_location(self.warband, location, body.validated_data["hero_ids"])
        except VisitRefused as refusal:
            raise RosterError(str(refusal), "invalid", {"hero_ids": [str(refusal)]}) from None
        return Response(answer, status=status.HTTP_201_CREATED)
