"""A warband's log, resources and trade ledger."""

from typing import Any

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.logs.utils import log_warband_event
from apps.warbands.models import WarbandResource
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
from apps.warbands.services.ledger_manual import NotEditable, edit_row, enter_row
from apps.warbands.services.ledger_reads import action_filter, log_features, log_rows, treasury_top_rows
from apps.warbands.services.pagination import newest_first, paginate, requested_page
from apps.warbands.services.resources import ResourceShortage, change_resource, sell_resource

from .base import WarbandScopedView

NOT_FOUND = {"detail": "Not found"}
NOT_EDITABLE = {
    "detail": "Only rows entered by hand can be edited. Correct this one with an adjustment.",
    "code": "not_editable",
}


class WarbandLogListView(WarbandScopedView):
    """GET logs/[?feature=][&limit=&cursor=]: the whole log, or cursor pages (services/pagination.py) whose first
    page also lists the log's features."""

    def get(self, request: Request, warband_id: int) -> Response:
        logs = log_rows(self.warband, request.query_params.get("feature"))
        page = requested_page(request.query_params)
        if page is None:
            return Response(WarbandLogSerializer(newest_first(logs), many=True).data)
        shown = paginate(logs, page)
        body: dict[str, Any] = {"results": WarbandLogSerializer(shown.rows, many=True).data}
        body["next_cursor"] = shown.next_cursor
        if page.after is None:
            body["features"] = log_features(self.warband)
        return Response(body)

    def post(self, request: Request, warband_id: int) -> Response:
        serializer = WarbandLogCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = serializer.validated_data
        log_entry = log_warband_event(self.warband.id, entry["feature"], entry["entry_type"], entry["payload"])
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
    """GET trades/[?action=Buy,Sell][&limit=&cursor=]: top-level rows with their nested rows, whole or in cursor
    pages (services/pagination.py)."""

    def get(self, request: Request, warband_id: int) -> Response:
        actions = action_filter(request.query_params.getlist("action"))
        trades = treasury_top_rows(self.warband, actions)
        page = requested_page(request.query_params)
        if page is None:
            return Response(WarbandTradeSerializer(newest_first(trades), many=True).data)
        shown = paginate(trades, page)
        return Response(
            {"results": WarbandTradeSerializer(shown.rows, many=True).data, "next_cursor": shown.next_cursor}
        )

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
