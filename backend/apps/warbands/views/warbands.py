from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import CampaignSettings
from apps.campaigns.permissions import get_writable_membership, parse_campaign_id
from apps.restrictions.serializers import RestrictionSerializer
from apps.warbands.access import check_backstory_change
from apps.warbands.models import LedgerAction, Warband, WarbandResource
from apps.warbands.restrictions import get_effective_restrictions_for_warband
from apps.warbands.serializers import (
    WarbandCreateSerializer,
    WarbandSerializer,
    WarbandSummarySerializer,
    WarbandUpdateSerializer,
)
from apps.warbands.services import ledger
from apps.warbands.services.roster_stats import roster_stats

from .base import WarbandScopedView


class WarbandListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        campaign_id = parse_campaign_id(request.query_params.get("campaign_id"))  # garbage is a 400 (BUG-152)
        warbands = (
            Warband.objects.filter(user=request.user)
            .select_related("campaign", "campaign__settings")
            .prefetch_related("campaign__settings__item_settings")
        )

        if campaign_id is not None:
            warbands = warbands.filter(campaign_id=campaign_id)

        serializer = WarbandSerializer(warbands.order_by("created_at"), many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = WarbandCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign_id = serializer.validated_data.get("campaign_id")

        if not get_writable_membership(request.user, campaign_id):
            return Response({"detail": "Not found"}, status=404)

        if Warband.objects.filter(campaign_id=campaign_id, user=request.user).exists():
            return Response({"detail": "Warband already exists"}, status=400)

        serializer.validated_data.pop("restriction_ids", [])
        warband = serializer.save(user=request.user)
        WarbandResource.objects.get_or_create(warband=warband, name="Treasure", defaults={"amount": 0})
        settings = CampaignSettings.objects.filter(campaign_id=campaign_id).first()
        starting_gold = settings.starting_gold if settings else 500
        ledger.record(warband, LedgerAction.STARTING_GOLD, abs(starting_gold), "Starting Gold")
        response_serializer = WarbandSerializer(warband)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class WarbandDetailView(WarbandScopedView):
    rules = {**WarbandScopedView.rules, "DELETE": "delete"}  # only the warband's owner may delete it

    def get(self, request: Request, warband_id: int) -> Response:
        return Response(WarbandSerializer(self.warband).data)

    def patch(self, request: Request, warband_id: int) -> Response:
        serializer = WarbandUpdateSerializer(self.warband, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.validated_data.pop("restriction_ids", None)
        check_backstory_change(request.user, self.warband, self.membership, serializer.validated_data)
        serializer.save()
        return Response(WarbandSerializer(self.warband).data)

    def delete(self, request: Request, warband_id: int) -> Response:
        self.warband.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WarbandSummaryView(WarbandScopedView):
    def get(self, request: Request, warband_id: int) -> Response:
        return Response(WarbandSummarySerializer(self.warband).data)


class WarbandRosterStatsView(WarbandScopedView):
    """GET: the stat line of each unit on the roster, for the campaign overview's expand (PERF-42; 3 queries)."""

    def get(self, request: Request, warband_id: int) -> Response:
        return Response(roster_stats(self.warband.id))


# Kept as it is until the frontend stops calling it: PUT changes nothing and answers like GET. (No docstring:
# DRF serves view docstrings as the OPTIONS description, and that stays as it was.)
class WarbandRestrictionsView(WarbandScopedView):
    def get(self, request: Request, warband_id: int) -> Response:
        return Response(RestrictionSerializer(get_effective_restrictions_for_warband(self.warband), many=True).data)

    def put(self, request: Request, warband_id: int) -> Response:
        return Response(RestrictionSerializer(get_effective_restrictions_for_warband(self.warband), many=True).data)
