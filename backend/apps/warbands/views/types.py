"""The warband types a campaign can pick, and adding one of its own (grading phase 1)."""

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from apps.campaigns.views.base import CampaignScopedView
from apps.warbands.serializers.types import CustomWarbandTypeSerializer, WarbandTypeSerializer
from apps.warbands.services.types import add_custom_type, type_list


class CampaignWarbandTypesView(CampaignScopedView):
    """GET campaigns/<id>/warband-types/: the book's types and the campaign's own, each with its setting, its groups
    and whether it is in play (three queries). POST: any member adds a type of the campaign's own, which every player
    there can pick (an archived campaign refuses it)."""

    rules = {"GET": "view", "POST": "view"}

    def get(self, request: Request, campaign_id: int) -> Response:
        return Response(WarbandTypeSerializer(type_list(campaign_id), many=True).data)

    def post(self, request: Request, campaign_id: int) -> Response:
        body = CustomWarbandTypeSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        added = add_custom_type(campaign_id, request.user, body.validated_data["name"], body.validated_data["link_url"])
        row = type_list(campaign_id).get(pk=added.pk)
        return Response(WarbandTypeSerializer(row).data, status=status.HTTP_201_CREATED)
