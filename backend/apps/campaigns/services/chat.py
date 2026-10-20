"""Campaign chat: pages of messages newest first, posting one (sent to the chat channel after commit), and an owner
or admin removing one (decision 8: a soft delete; the message stays listed as "removed by admin"), and each
member's read mark (CAMP-TWEAK-09): it lives on his membership, so it follows him between devices."""

from typing import Any

from django.db.models import Max, QuerySet, Value
from django.db.models.functions import Greatest
from django.utils import timezone

from apps.realtime.services import send_campaign_chat_message, send_campaign_chat_removed
from apps.users.names import display_name

from ..errors import Refused, field_error
from ..models import CampaignMembership, CampaignMessage

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


def mark_read(membership: CampaignMembership, raw: Any = None) -> dict[str, int]:
    """Move the member's read mark up to message `raw` (the newest when absent): never back, so his devices can't
    undo each other, and never past the newest message. Returns the mark and how many messages are still unread."""
    newest = CampaignMessage.objects.filter(campaign_id=membership.campaign_id).aggregate(newest=Max("id"))["newest"]
    target = min(_message_id(raw, newest or 0), newest or 0)
    CampaignMembership.objects.filter(id=membership.id).update(
        chat_last_read_id=Greatest("chat_last_read_id", Value(target))
    )
    mark = max(membership.chat_last_read_id, target)
    return {"chat_last_read_id": mark, "chat_unread": unread(membership.campaign_id, membership.user_id, mark).count()}


def unread(campaign_id: int, user_id: int, after: int) -> QuerySet[CampaignMessage]:
    """The messages after `after` that aren't his and weren't removed: his own never count (CAMP-TWEAK-09)."""
    rows = CampaignMessage.objects.filter(campaign_id=campaign_id, id__gt=after, removed_at=None)
    return rows.exclude(user_id=user_id)


def _message_id(raw: Any, default: int) -> int:
    if raw is None:
        return default
    if isinstance(raw, bool) or not str(raw).strip().isdigit():
        raise field_error("last_read_id", "last_read_id must be a message id.")
    return int(raw)
