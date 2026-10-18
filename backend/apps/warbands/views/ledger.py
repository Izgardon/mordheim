"""A warband's log, resources and trade ledger."""

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.logs.utils import log_warband_event
from apps.warbands.models import WarbandLog, WarbandResource
from apps.warbands.serializers import (
    WarbandLogCreateSerializer,
    WarbandLogSerializer,
    WarbandResourceCreateSerializer,
    WarbandResourceSaleSerializer,
    WarbandResourceSerializer,
    WarbandResourceUpdateSerializer,
    WarbandSummarySerializer,
    WarbandTradeCreateSerializer,
    WarbandTradeEditSerializer,
    WarbandTradeSerializer,
)
from apps.warbands.services.ledger_manual import NotEditable, edit_row, enter_row, treasury_rows
from apps.warbands.services.resources import ResourceShortage, change_resource, sell_resource

from .base import WarbandScopedView

NOT_FOUND = {"detail": "Not found"}
NOT_EDITABLE = {
    "detail": "Only rows entered by hand can be edited. Correct this one with an adjustment.",
    "code": "not_editable",
}


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
        trades = treasury_rows(self.warband).filter(parent__isnull=True).order_by("-created_at")
        return Response(WarbandTradeSerializer(trades, many=True).data)

    def post(self, request: Request, warband_id: int) -> Response:
        serializer = WarbandTradeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        trade = enter_row(self.warband, request.user, serializer.validated_data)  # records who entered it
        return Response(WarbandTradeSerializer(trade).data, status=status.HTTP_201_CREATED)


class WarbandTradeDetailView(WarbandScopedView):
    """PATCH trades/<id>/: a hand-entered row's description and notes. History is append-only (decision 5):
    amounts change through adjustments, and no row is deleted."""

    def patch(self, request: Request, warband_id: int, trade_id: int) -> Response:
        serializer = WarbandTradeEditSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            trade = edit_row(self.warband, trade_id, serializer.validated_data)
        except NotEditable:
            return Response(NOT_EDITABLE, status=400)
        if trade is None:
            return Response(NOT_FOUND, status=404)
        return Response(WarbandTradeSerializer(trade).data)
