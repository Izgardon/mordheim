"""The campaign's charts (William, 19 Nov 2026): every member reads them; its owner and admins
(`manage_campaign_rules`, the same right as the campaign's rules) add, edit, reorder and delete them."""

from rest_framework import status
from rest_framework.response import Response

from ..serializers.charts import CampaignChartOrderSerializer, CampaignChartSerializer
from ..services import campaign_charts
from .base import CampaignScopedView

WRITE = "manage_campaign_rules"


class CampaignChartsView(CampaignScopedView):
    """GET: the charts with their results, in their order. POST: add one, last."""

    rules = {"GET": "view", "POST": WRITE}

    def get(self, request, campaign_id):
        return Response(CampaignChartSerializer(campaign_charts.campaign_charts(campaign_id), many=True).data)

    def post(self, request, campaign_id):
        serializer = CampaignChartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        chart = campaign_charts.create_chart(campaign_id, serializer.validated_data)
        return Response(CampaignChartSerializer(chart).data, status=status.HTTP_201_CREATED)


class CampaignChartDetailView(CampaignScopedView):
    """PATCH: the chart, and its results when they are sent. DELETE: remove it with them."""

    rules = {"PATCH": WRITE, "DELETE": WRITE}

    def patch(self, request, campaign_id, chart_id):
        chart = campaign_charts.campaign_charts(campaign_id).filter(id=chart_id).first()
        if not chart:
            return Response({"detail": "Not found"}, status=404)
        serializer = CampaignChartSerializer(chart, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        saved = campaign_charts.update_chart(chart, dict(serializer.validated_data))
        return Response(CampaignChartSerializer(saved).data)

    def delete(self, request, campaign_id, chart_id):
        if not campaign_charts.campaign_charts(campaign_id).filter(id=chart_id).delete()[0]:
            return Response({"detail": "Not found"}, status=404)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignChartOrderView(CampaignScopedView):
    """PUT {ids}: every chart's id in its new order; the answer is the list as it now stands."""

    rules = {"PUT": WRITE}

    def put(self, request, campaign_id):
        serializer = CampaignChartOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        charts = campaign_charts.reorder(campaign_id, serializer.validated_data["ids"])
        return Response(CampaignChartSerializer(charts, many=True).data)
