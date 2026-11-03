from django.db import transaction
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import DEFAULT_RESOURCE_NAME, CampaignSettings
from apps.campaigns.permissions import get_writable_membership, parse_campaign_id
from apps.warbands.access import check_backstory_change
from apps.warbands.models import LedgerAction, Warband, WarbandResource
from apps.warbands.serializers import (
    WarbandCreateSerializer,
    WarbandSerializer,
    WarbandSummarySerializer,
    WarbandUpdateSerializer,
)
from apps.warbands.services import ledger
from apps.warbands.services.types import load_types, picked_types

from .base import WarbandScopedView


class WarbandListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        campaign_id = parse_campaign_id(request.query_params.get("campaign_id"))  # garbage is a 400 (BUG-152)
        warbands = Warband.objects.filter(user=request.user).select_related("campaign", "campaign__settings")

        if campaign_id is not None:
            warbands = warbands.filter(campaign_id=campaign_id)

        rows = list(warbands.order_by("created_at"))
        load_types(rows)  # their types, for all of them in one query
        return Response(WarbandSerializer(rows, many=True).data)

    def post(self, request):
        serializer = WarbandCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign_id = serializer.validated_data.get("campaign_id")

        if not get_writable_membership(request.user, campaign_id):
            return Response({"detail": "Not found"}, status=404)

        if Warband.objects.filter(campaign_id=campaign_id, user=request.user).exists():
            return Response({"detail": "Warband already exists"}, status=400)

        counts_as = picked_types(campaign_id, serializer.validated_data) or []  # 400 for a type it may not pick
        with transaction.atomic():
            # locked: a rename of the default resource renames this warband's too, before or after (one at a time)
            settings = CampaignSettings.objects.select_for_update().filter(campaign_id=campaign_id).first()
            warband = serializer.save(user=request.user)
            warband.counts_as.set(counts_as)
            # the one everyone starts with (William, 3 Nov 2026), named as the campaign names it
            name = settings.default_resource_name if settings else DEFAULT_RESOURCE_NAME
            WarbandResource.objects.create(warband=warband, name=name, amount=0, is_default=True)
            starting_gold = settings.starting_gold if settings else 500
            ledger.record(warband, LedgerAction.STARTING_GOLD, abs(starting_gold), "Starting Gold")
        return Response(WarbandSerializer(warband).data, status=status.HTTP_201_CREATED)


class WarbandDetailView(WarbandScopedView):
    rules = {**WarbandScopedView.rules, "DELETE": "delete"}  # only the warband's owner may delete it

    def get(self, request: Request, warband_id: int) -> Response:
        return Response(WarbandSerializer(self.warband).data)

    def patch(self, request: Request, warband_id: int) -> Response:
        serializer = WarbandUpdateSerializer(self.warband, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        counts_as = picked_types(self.warband.campaign_id, serializer.validated_data)  # a new type, what it counts as
        check_backstory_change(request.user, self.warband, self.membership, serializer.validated_data)
        with transaction.atomic():
            serializer.save()
            if counts_as is not None:
                self.warband.counts_as.set(counts_as)
        return Response(WarbandSerializer(self.warband).data)

    def delete(self, request: Request, warband_id: int) -> Response:
        self.warband.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WarbandSummaryView(WarbandScopedView):
    def get(self, request: Request, warband_id: int) -> Response:
        return Response(WarbandSummarySerializer(self.warband).data)
