"""Campaign chat: any member reads it a page at a time and posts to it (posts are throttled); owners and admins
remove a message (decision 8); each member's read mark (CAMP-TWEAK-09)."""

from rest_framework import status
from rest_framework.response import Response

from apps.core.throttling import CAMPAIGN_CHAT_THROTTLE_CLASSES, MethodScopedThrottleMixin

from ..serializers.content import CampaignMessageSerializer
from ..services import chat
from .base import CampaignScopedView


class CampaignMessagesView(MethodScopedThrottleMixin, CampaignScopedView):
    """GET: 50 messages, newest first (`?before=<id>` for older ones). POST: a message of up to 2,000 characters."""

    rules = {"GET": "view", "POST": "view"}
    throttle_classes = CAMPAIGN_CHAT_THROTTLE_CLASSES

    def get(self, request, campaign_id):
        messages = chat.page(campaign_id, request.query_params.get("before"))
        return Response(CampaignMessageSerializer(messages, many=True).data)

    def post(self, request, campaign_id):
        message = chat.post(campaign_id, request.user, request.data.get("body", ""))
        return Response(CampaignMessageSerializer(message).data, status=status.HTTP_201_CREATED)


class CampaignMessageDetailView(CampaignScopedView):
    """DELETE: an owner or admin removes the message; everyone sees "removed by admin" (decision 8, CAMP-NEW-06)."""

    rules = {"DELETE": "remove_posts"}

    def delete(self, request, campaign_id, message_id):
        chat.remove(campaign_id, message_id, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignChatReadView(CampaignScopedView):
    """POST: the caller has read the chat up to `last_read_id` (the newest message when absent). Answers his mark
    and what is still unread (CAMP-TWEAK-09). His own read mark, so an archived campaign takes it too."""

    rules = {"POST": "view"}
    allow_archived = frozenset({"POST"})

    def post(self, request, campaign_id):
        raw = request.data.get("last_read_id") if isinstance(request.data, dict) else None
        return Response(chat.mark_read(self.access.membership, raw))
