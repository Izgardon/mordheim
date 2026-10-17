"""Starting a trade: at most one open request between the same two warbands (BUG-114)."""

from typing import Any

from django.db.models import Q
from django.utils import timezone

from apps.campaigns.models import CampaignMembership
from apps.notifications.models import Notification
from apps.notifications.utils import create_notification
from apps.trades.models import TradeRequest
from apps.trades.serializers import serialize_trade_request
from apps.warbands.models import Warband

from .errors import TradeError
from .timing import OPEN_STATUSES, answer_deadline


def open_trade_between(first_warband_id: int, second_warband_id: int) -> TradeRequest | None:
    """The two warbands' pending or open trade, either way round, that hasn't run out."""
    pair = Q(from_warband_id=first_warband_id, to_warband_id=second_warband_id) | Q(
        from_warband_id=second_warband_id, to_warband_id=first_warband_id
    )
    live = TradeRequest.objects.filter(pair, status__in=OPEN_STATUSES, expires_at__gt=timezone.now())
    return live.only("id").first()


def start_trade(campaign_id: int, sender: Any, recipient: Any) -> TradeRequest:
    """A new pending request from the sender's warband to the recipient's, in the caller's transaction.

    TradeError: 400 when either player has no warband in the campaign; 409 `trade_already_open` (with the open
    trade's `trade_id`) when the two warbands already have one. Both warbands are locked first (lowest id first),
    so two requests sent at once can't both pass that check.
    """
    locked = Warband.objects.select_for_update().filter(campaign_id=campaign_id, user_id__in=[sender.id, recipient.id])
    warbands = {warband.user_id: warband for warband in locked.order_by("id")}
    from_warband, to_warband = warbands.get(sender.id), warbands.get(recipient.id)
    if from_warband is None or to_warband is None:
        raise TradeError("Both players need a warband to trade")
    existing = open_trade_between(from_warband.id, to_warband.id)
    if existing is not None:
        raise TradeError(
            "You already have a trade open with this player.",
            status=409,
            code="trade_already_open",
            trade_id=str(existing.id),
        )
    return TradeRequest.objects.create(
        campaign_id=campaign_id,
        from_user=sender,
        to_user=recipient,
        from_warband=from_warband,
        to_warband=to_warband,
        expires_at=answer_deadline(),  # 10 minutes to answer (decision 8)
    )


def _recipient(campaign_id: int, sender: Any, target_user_id: Any) -> Any:
    """The player a request is for: TradeError 400 when the id is missing, not a whole number or the sender's own;
    404 when that player isn't in the campaign."""
    if not target_user_id:
        raise TradeError("target_user_id is required")
    try:
        target_user_id = int(target_user_id)
    except (TypeError, ValueError):
        raise TradeError("Invalid target_user_id") from None
    if target_user_id == sender.id:
        raise TradeError("Cannot trade with yourself")
    membership = CampaignMembership.objects.select_related("user").filter(
        campaign_id=campaign_id, user_id=target_user_id
    )
    found = membership.first()
    if found is None:
        raise TradeError("Player not found", status=404)
    return found.user


def request_trade(campaign_id: int, sender: Any, target_user_id: Any) -> tuple[TradeRequest, Notification]:
    """A new pending request from the sender to the player `target_user_id` names, and the recipient's
    notification carrying its payload, in the caller's transaction; TradeError when it can't be sent."""
    trade = start_trade(campaign_id, sender, _recipient(campaign_id, sender, target_user_id))
    notification = create_notification(
        user_id=trade.to_user_id,
        notification_type=Notification.TYPE_TRADE_REQUEST,
        reference_id=str(trade.id),
        campaign_id=campaign_id,
        payload=serialize_trade_request(trade),
    )
    return trade, notification
