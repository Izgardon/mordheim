"""Campaign chat: pages of messages newest first, posting one (sent to the chat channel after commit), and an owner
or admin removing one (decision 8: a soft delete; the message stays listed as "removed by admin")."""

from typing import Any

from django.db.models import QuerySet
from django.utils import timezone

from apps.realtime.services import send_campaign_chat_message, send_campaign_chat_removed
from apps.users.names import display_name

from ..errors import Refused, field_error
from ..models import CampaignMessage

PAGE_SIZE = 50
MAX_LENGTH = 2000


def page(campaign_id: int, before: Any = None) -> QuerySet[CampaignMessage]:
    """Up to 50 messages, newest first, older than message `before` when it is a number (else the latest)."""
    rows = CampaignMessage.objects.filter(campaign_id=campaign_id).select_related("user")
    if before:
        try:
            rows = rows.filter(id__lt=int(before))
        except (ValueError, TypeError):
            pass
    return rows.order_by("-id")[:PAGE_SIZE]  # the order pages are cut in, on Index(campaign, -id) (PERF-45)


def post(campaign_id: int, user: Any, raw_body: Any) -> CampaignMessage:
    """Store the message under the author's display name and send it to the campaign's chat channel."""
    if not isinstance(raw_body, str):  # BUG-129: a list or object used to be stored as its Python repr
        raise field_error("body", "Message body must be text.")
    body = raw_body.strip()
    if not body:
        raise Refused("Message body is required.")
    if len(body) > MAX_LENGTH:
        raise Refused("Message is too long.")
    message = CampaignMessage.objects.create(
        campaign_id=campaign_id,
        user=user,
        username=display_name(user),  # SEC-13: never the email
        body=body,
    )
    send_campaign_chat_message(campaign_id, message)
    return message


def remove(campaign_id: int, message_id: int, by: Any) -> None:
    """Remove the message for everyone (a second remove changes nothing); `chat.removed` goes out after commit."""
    rows = CampaignMessage.objects.filter(id=message_id, campaign_id=campaign_id)
    if not rows.exists():
        raise Refused("Not found", status=404)
    now = timezone.now()
    if rows.filter(removed_at__isnull=True).update(removed_at=now, removed_by=by):
        send_campaign_chat_removed(campaign_id, message_id, now.isoformat())
