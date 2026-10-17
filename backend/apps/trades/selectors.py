"""Loading a trade for one of its two players: the check every trade view starts with."""

from typing import Any
from uuid import UUID

from django.db.models import QuerySet
from rest_framework.exceptions import NotFound, PermissionDenied

from .models import TradeRequest


def trade_requests() -> QuerySet[TradeRequest]:
    """Trade requests with what their payload shows (both players and both warbands)."""
    return TradeRequest.objects.select_related("from_user", "to_user", "from_warband", "to_warband")


def get_trade_for_participant(
    user: Any,
    campaign_id: int,
    request_id: UUID,
    *,
    lock: bool = False,
    recipient_only: bool = False,
    hidden: bool = False,
) -> TradeRequest:
    """The campaign's trade if `user` may act on it: an unknown trade is 404; anyone else 403 (404 if `hidden`).

    `recipient_only` admits only the player the request was sent to. With `lock`, the trade row (only) stays
    locked until the caller's transaction ends.
    """
    rows = trade_requests()
    if lock:
        rows = rows.select_for_update(of=("self",))
    trade = rows.filter(id=request_id, campaign_id=campaign_id).first()
    if trade is None:
        raise NotFound("Not found")
    allowed = (trade.to_user_id,) if recipient_only else (trade.from_user_id, trade.to_user_id)
    if user.id not in allowed:
        raise NotFound("Not found") if hidden else PermissionDenied("Forbidden")
    return trade
