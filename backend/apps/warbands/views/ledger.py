"""A warband's log, resources and trade ledger."""

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.logs.utils import log_warband_event
from apps.warbands.models import WarbandLog, WarbandResource, WarbandTrade
from apps.warbands.serializers import (
    WarbandLogCreateSerializer,
    WarbandLogSerializer,
    WarbandResourceCreateSerializer,
    WarbandResourceSerializer,
    WarbandResourceUpdateSerializer,
    WarbandTradeCreateSerializer,
    WarbandTradeSerializer,
)
from apps.warbands.utils.trades import TradeHelper

from .base import WarbandScopedView

NOT_FOUND = {"detail": "Not found"}


class WarbandLogListView(WarbandScopedView):
    def get(self, request: Request, warband_id: int) -> Response:
        logs = WarbandLog.objects.filter(warband=self.warband)
        feature = request.query_params.get("feature")
        if feature:
            logs = logs.filter(feature__iexact=feature.strip())
        return Response(WarbandLogSerializer(logs.order_by("-created_at"), many=True).data)

    def post(self, request: Request, warband_id: int) -> Response:
        serializer = WarbandLogCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        feature = serializer.validated_data.get("feature") or "trade"
        entry_type = serializer.validated_data.get("entry_type") or "summary"
        payload = serializer.validated_data.get("payload") or {}

        if not payload:
            return Response({"detail": "Payload is required"}, status=400)

        log_entry = log_warband_event(self.warband.id, feature, entry_type, payload)
        return Response(WarbandLogSerializer(log_entry).data, status=status.HTTP_201_CREATED)


class WarbandResourceListCreateView(WarbandScopedView):
    def get(self, request: Request, warband_id: int) -> Response:
        resources = WarbandResource.objects.filter(warband=self.warband).order_by("name")
        return Response(WarbandResourceSerializer(resources, many=True).data)

    def post(self, request: Request, warband_id: int) -> Response:
        serializer = WarbandResourceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        name = serializer.validated_data["name"]
        if WarbandResource.objects.filter(warband=self.warband, name__iexact=name).exists():
            return Response({"detail": "Resource already exists"}, status=400)
        resource = WarbandResource.objects.create(warband=self.warband, name=name, amount=0)
        return Response(WarbandResourceSerializer(resource).data, status=status.HTTP_201_CREATED)


class WarbandResourceDetailView(WarbandScopedView):
    def patch(self, request: Request, warband_id: int, resource_id: int) -> Response:
        resource = WarbandResource.objects.filter(id=resource_id, warband=self.warband).first()
        if not resource:
            return Response(NOT_FOUND, status=404)

        serializer = WarbandResourceUpdateSerializer(resource, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(WarbandResourceSerializer(resource).data)

    def delete(self, request: Request, warband_id: int, resource_id: int) -> Response:
        resource = WarbandResource.objects.filter(id=resource_id, warband=self.warband).first()
        if not resource:
            return Response(NOT_FOUND, status=404)

        resource.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WarbandTradeListCreateView(WarbandScopedView):
    def get(self, request: Request, warband_id: int) -> Response:
        trades = (
            WarbandTrade.objects.filter(warband=self.warband, parent__isnull=True)
            .prefetch_related("children")
            .order_by("-created_at")
        )
        return Response(WarbandTradeSerializer(trades, many=True).data)

    def post(self, request: Request, warband_id: int) -> Response:
        serializer = WarbandTradeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        parent_id = serializer.validated_data.get("parent_id")
        parent = None
        if parent_id:
            parent = WarbandTrade.objects.filter(id=parent_id, warband=self.warband).first()

        trade = TradeHelper.create_trade(
            warband=self.warband,
            action=serializer.validated_data["action"],
            description=serializer.validated_data["description"],
            price=serializer.validated_data.get("price", 0),
            notes=serializer.validated_data.get("notes", ""),
            parent=parent,
        )
        return Response(WarbandTradeSerializer(trade).data, status=status.HTTP_201_CREATED)
