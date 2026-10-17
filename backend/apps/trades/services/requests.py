"""Starting a trade: at most one open request between the same two warbands (BUG-114)."""

from datetime import timedelta
from typing import Any

from django.db.models import Q
from django.utils import timezone

from apps.trades.models import TradeRequest
from apps.warbands.models import Warband

from .errors import TradeError
from .lifecycle import OPEN_STATUSES

REQUEST_LIFETIME = timedelta(minutes=5)  # from the request, never extended (decision 8 may change this)


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
        expires_at=timezone.now() + REQUEST_LIFETIME,
    )
