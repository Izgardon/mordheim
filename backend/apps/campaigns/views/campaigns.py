"""The campaigns list, creating and joining one, and one campaign: read, settings, delete, its join code, and
archiving and restoring it (decision 5)."""

from rest_framework import permissions, status
from rest_framework.response import Response

from apps.realtime.services import send_campaign_updated, sender_socket_id

from ..selectors import campaign_detail_for_user, campaign_for_user, campaigns_for_user
from ..serializers.campaigns import (
    CampaignCreateSerializer,
    CampaignSerializer,
    CampaignUpdateSerializer,
    JoinCampaignSerializer,
)
from ..services import archive
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


def detail_payload(view: CampaignScopedView, campaign_id: int) -> dict:
    """The campaign as its detail answers it to the caller, with his permissions, capabilities and unread chat."""
    campaign = campaign_detail_for_user(campaign_id, view.request.user)
    data = CampaignSerializer(campaign).data
    # Pages read the caller's permissions from here instead of each fetching /permissions/me/, and gate their
    # controls on the capabilities (design 0.29): what the server lets him do, from the same read
    data["permissions"] = view.access.codes
    data["capabilities"] = view.capabilities()
    data["chat_unread"] = getattr(campaign, "chat_unread", 0)  # never his own messages (CAMP-TWEAK-09)
    return data


def updated(view: CampaignScopedView, campaign_id: int) -> Response:
    """Answer the caller with the campaign's detail and send the other members `campaign.updated` (CAMP-NEW-07)."""
    data = detail_payload(view, campaign_id)
    send_campaign_updated(campaign_id, data, sender_socket_id(view.request))
    return Response(data)


class CampaignDetailView(CampaignScopedView):
    """GET: the campaign with the caller's permissions and capabilities. PATCH: the start flag (owners and admins)
    or the settings (the owner). DELETE: the owner deletes his archived campaign for good, sending its `name`
    (decision 5, CAMP-TWEAK-04)."""

    rules = {"GET": "view", "PATCH": "view", "DELETE": "delete"}  # PATCH: the rule depends on the fields sent
    allow_archived = frozenset({"DELETE"})

    def get(self, request, campaign_id):
        return Response(detail_payload(self, campaign_id))

    def delete(self, request, campaign_id):
        name = request.data.get("name") if isinstance(request.data, dict) else None
        archive.delete_permanently(self.access.campaign, name, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, campaign_id):
        self.check_rule(rule_for(request.data))  # admins may start and unstart only (BUG-13)
        serializer = CampaignUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        update_campaign(self.access.campaign, serializer.validated_data)
        data = CampaignSerializer(campaign_for_user(campaign_id, request.user)).data
        send_campaign_updated(campaign_id, data, sender_socket_id(request))  # a start, a toggle, settings
        return Response(data)


class CampaignJoinCodeView(CampaignScopedView):
    """POST: owners and admins give the campaign a new join code (decision 1, CAMP-NEW-01). Answers the campaign."""

    rules = {"POST": "regenerate_join_code"}

    def post(self, request, campaign_id):
        regenerate_join_code(campaign_id)
        data = CampaignSerializer(campaign_for_user(campaign_id, request.user)).data
        send_campaign_updated(campaign_id, data, sender_socket_id(request))  # the new code, on every screen
        return Response(data)


class CampaignArchiveView(CampaignScopedView):
    """POST: the owner archives the campaign: its open battles and trades close and it becomes read-only for
    everyone (decision 5, CAMP-NEW-04). Answers the campaign as its detail does."""

    rules = {"POST": "archive"}

    def post(self, request, campaign_id):
        self.access.campaign.archived_at = archive.archive(campaign_id, request.user).archived_at
        return updated(self, campaign_id)


class CampaignRestoreView(CampaignScopedView):
    """POST: the owner restores his archived campaign; it can change again (decision 5)."""

    rules = {"POST": "restore"}
    allow_archived = frozenset({"POST"})

    def post(self, request, campaign_id):
        archive.restore(campaign_id)
        self.access.campaign.archived_at = None
        return updated(self, campaign_id)
