"""Who hears of a bounty write, after commit: every member through `bounty.changed`, and the two parties of a claim
through their own notification channels.

- A claim: the poster gets a `bounty_claim` notification (in his bell until it is answered) and the event.
- The claimant takes it back: the poster's notification is resolved and he gets `bounty_claim_withdrawn`.
- The poster answers (pays, declines), the bounty is paid to another claim or withdrawn: each claim's notification is
  resolved and its claimant gets `bounty_claim_answered` with the claim's new status and the bounty.
- A payment changes both warbands' gold: `warband.changed` for each, so their open pages read it again.
"""

from typing import Any

from django.utils import timezone

from apps.notifications.models import Notification
from apps.notifications.utils import create_notification
from apps.realtime.services import (
    send_bounty_changed,
    send_user_notification,
    send_warband_changed,
    sender_socket_id,
)

from ..models import Bounty, BountyClaim
from ..payloads import bounty_payload, claim_notice
from ..selectors import bounty_claims


def announce(request: Any, bounty: Bounty) -> dict[str, Any]:
    """The bounty's payload as it stands (its claims read again), sent to every member but the writer's socket."""
    payload = bounty_payload(bounty, bounty_claims(bounty))
    send_bounty_changed(bounty.campaign_id, payload, sender_socket_id(request))
    return payload


def claim_made(bounty: Bounty, claim: BountyClaim) -> None:
    notice = claim_notice(bounty, claim)
    notification = create_notification(
        user_id=bounty.posted_by_user_id,
        notification_type=Notification.TYPE_BOUNTY_CLAIM,
        reference_id=str(claim.id),
        campaign_id=bounty.campaign_id,
        payload=notice,
    )
    send_user_notification(bounty.posted_by_user_id, "bounty_claim", {**notice, "notification_id": notification.id})


def _resolve(claims: list[BountyClaim]) -> None:
    refs = [str(claim.id) for claim in claims]
    if refs:
        Notification.objects.filter(
            notification_type=Notification.TYPE_BOUNTY_CLAIM, reference_id__in=refs, is_resolved=False
        ).update(is_resolved=True, resolved_at=timezone.now())


def claim_withdrawn(bounty: Bounty, claim: BountyClaim) -> None:
    _resolve([claim])
    body = {"claim_id": claim.id, "bounty_id": bounty.id, "campaign_id": bounty.campaign_id}
    send_user_notification(bounty.posted_by_user_id, "bounty_claim_withdrawn", body)


def claims_answered(claims: list[BountyClaim], payload: dict[str, Any]) -> None:
    """Each claim's poster notification resolved, and its claimant told how it ended (with the bounty)."""
    _resolve(claims)
    for claim in claims:
        body = {"claim_id": claim.id, "status": claim.status, "bounty": payload}
        send_user_notification(claim.claimant_user_id, "bounty_claim_answered", body)


def gold_moved(request: Any, bounty: Bounty, claim: BountyClaim) -> None:
    socket_id = sender_socket_id(request)
    for warband_id in (bounty.posted_by_warband_id, claim.claimant_warband_id):
        send_warband_changed(bounty.campaign_id, warband_id, socket_id)
