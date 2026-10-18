"""A warband's log, resources and trade ledger."""

from django.db.models import Prefetch
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.logs.utils import log_warband_event
from apps.warbands.models import WarbandLog, WarbandResource, WarbandTrade
from apps.warbands.serializers import (
    WarbandLogCreateSerializer,
    WarbandLogSerializer,
    WarbandResourceCreateSerializer,
    WarbandResourceSaleSerializer,
    WarbandResourceSerializer,
    WarbandResourceUpdateSerializer,
    WarbandSummarySerializer,
    WarbandTradeCreateSerializer,
    WarbandTradeSerializer,
)
from apps.warbands.services import ledger
from apps.warbands.services.resources import ResourceShortage, change_resource, sell_resource

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
        serializer = WarbandResourceUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resource = change_resource(self.warband, resource_id, **serializer.validated_data)
        if not resource:
            return Response(NOT_FOUND, status=404)
        return Response(WarbandResourceSerializer(resource).data)

    def delete(self, request: Request, warband_id: int, resource_id: int) -> Response:
        resource = WarbandResource.objects.filter(id=resource_id, warband=self.warband).first()
        if not resource:
            return Response(NOT_FOUND, status=404)

        resource.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WarbandResourceSaleView(WarbandScopedView):
    """POST resources/<id>/sell/ {quantity, price}: the resource change and its "Sell" ledger row together."""

    def post(self, request: Request, warband_id: int, resource_id: int) -> Response:
        serializer = WarbandResourceSaleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            sale = sell_resource(self.warband, resource_id, **serializer.validated_data)
        except ResourceShortage as shortage:
            return Response({"detail": str(shortage), "code": "not_enough_resource"}, status=400)
        if sale is None:
            return Response(NOT_FOUND, status=404)
        resource, trade = sale
        body = {
            "resource": WarbandResourceSerializer(resource).data,
            "trade": WarbandTradeSerializer(trade).data,
            "summary": WarbandSummarySerializer(self.warband).data,
        }
        return Response(body)


class WarbandTradeListCreateView(WarbandScopedView):
    def get(self, request: Request, warband_id: int) -> Response:
        children = Prefetch("children", queryset=WarbandTrade.objects.select_related("created_by"))
        trades = (
            WarbandTrade.objects.filter(warband=self.warband, parent__isnull=True)
            .select_related("created_by")
            .prefetch_related(children)
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

        entry = serializer.validated_data
        trade = ledger.record(
            self.warband,
            entry["action"],
            entry["amount"],
            entry["description"],
            notes=entry.get("notes", ""),
            parent=parent,
            created_by=request.user,  # decision 6: who entered it
        )
        return Response(WarbandTradeSerializer(trade).data, status=status.HTTP_201_CREATED)
