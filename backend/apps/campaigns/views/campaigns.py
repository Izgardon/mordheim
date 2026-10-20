"""The campaigns list, creating and joining one, and one campaign: read, settings, delete and its join code."""

from rest_framework import permissions, status
from rest_framework.response import Response

from ..selectors import campaign_for_user, campaigns_for_user
from ..serializers import CampaignCreateSerializer, CampaignSerializer, CampaignUpdateSerializer, JoinCampaignSerializer
from ..services.campaigns import create_campaign, regenerate_join_code
from ..services.joining import join_campaign
from ..services.settings import rule_for, update_campaign
from .base import AnswersRefusals, CampaignScopedView


class CampaignListCreateView(AnswersRefusals):
    """GET: the caller's campaigns. POST: a new campaign, with the caller as its owner (BUG-76: all or nothing)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(CampaignSerializer(campaigns_for_user(request.user).order_by("name"), many=True).data)

    def post(self, request):
        serializer = CampaignCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = create_campaign(request.user, serializer.validated_data)
        return Response(CampaignSerializer(campaign_for_user(campaign.id, request.user)).data, status=201)


class JoinCampaignView(AnswersRefusals):
    """POST: join the campaign with this code, as a player (BUG-49: checked and inserted under its lock)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = JoinCampaignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = join_campaign(request.user, serializer.validated_data["join_code"])
        return Response(CampaignSerializer(campaign_for_user(campaign.id, request.user)).data, status=201)


class CampaignDetailView(CampaignScopedView):
    """GET: the campaign with the caller's permissions. PATCH: the start flag (owners and admins)
    or the settings (the owner). DELETE: the owner deletes it."""

    rules = {"GET": "view", "PATCH": "view", "DELETE": "delete"}  # PATCH: the rule depends on the fields sent

    def get(self, request, campaign_id):
        campaign = campaign_for_user(campaign_id, request.user)
        if not campaign:
            return Response({"detail": "Not found"}, status=404)
        data = CampaignSerializer(campaign).data
        # Pages read the caller's permissions from here instead of each fetching /permissions/me/.
        data["permissions"] = self.access.codes
        return Response(data)

    def delete(self, request, campaign_id):
        self.access.campaign.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, campaign_id):
        self.check_rule(rule_for(request.data))  # admins may start and unstart only (BUG-13)
        serializer = CampaignUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        update_campaign(self.access.campaign, serializer.validated_data)
        refreshed = campaign_for_user(campaign_id, request.user)
        if not refreshed:
            return Response({"detail": "Not found"}, status=404)
        return Response(CampaignSerializer(refreshed).data)


class CampaignJoinCodeView(CampaignScopedView):
    """POST: owners and admins give the campaign a new join code (decision 1, CAMP-NEW-01). Answers the campaign."""

    rules = {"POST": "regenerate_join_code"}

    def post(self, request, campaign_id):
        regenerate_join_code(campaign_id)
        return Response(CampaignSerializer(campaign_for_user(campaign_id, request.user)).data)
