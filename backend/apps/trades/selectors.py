"""Loading a trade for one of its two players: the check every trade view starts with."""

from typing import Any
from uuid import UUID

from django.db.models import Exists, OuterRef, QuerySet
from rest_framework.exceptions import NotFound, PermissionDenied

from apps.campaigns.models import CampaignMembership

from .models import TradeRequest
from .services.errors import TradeError


def trade_requests() -> QuerySet[TradeRequest]:
    """Trade requests with what their payload shows (both players and both warbands)."""
    return TradeRequest.objects.select_related("from_user", "to_user", "from_warband", "to_warband")


def _is_member(user_field: str) -> Exists:
    return Exists(CampaignMembership.objects.filter(campaign_id=OuterRef("campaign_id"), user_id=OuterRef(user_field)))


def with_memberships(rows: QuerySet[TradeRequest]) -> QuerySet[TradeRequest]:
    """`rows` annotated with `from_is_member` / `to_is_member`: whether each player is still in the trade's
    campaign (SEC-08), read in the same query."""
    return rows.annotate(from_is_member=_is_member("from_user_id"), to_is_member=_is_member("to_user_id"))


def is_member(trade: TradeRequest, side: str) -> bool:
    """Whether the side's player is still in the campaign (`trade` read through `with_memberships`)."""
    return bool(getattr(trade, f"{side}_is_member"))


def require_partner(trade: TradeRequest, user: Any) -> None:
    """Offers, locks and accepting need the other player still in the campaign: 409 otherwise (SEC-08)."""
    partner = "to" if user.id == trade.from_user_id else "from"
    if not is_member(trade, partner):
        raise TradeError("The other player is no longer in this campaign.", status=409, code="trade_partner_left")


def get_trade_for_participant(
    user: Any,
    campaign_id: int,
    request_id: UUID,
    *,
    lock: bool = False,
    recipient_only: bool = False,
    hidden: bool = False,
) -> TradeRequest:
    """The campaign's trade if `user` may act on it: an unknown trade is 404; anyone else 403 (404 if `hidden`);
    a player who has left the campaign 404, as for its other endpoints (SEC-08).

    `recipient_only` admits only the player the request was sent to. With `lock`, the trade row (only) stays
    locked until the caller's transaction ends.
    """
    rows = with_memberships(trade_requests())
    if lock:
        rows = rows.select_for_update(of=("self",))
    trade = rows.filter(id=request_id, campaign_id=campaign_id).first()
    if trade is None:
        raise NotFound("Not found")
    allowed = (trade.to_user_id,) if recipient_only else (trade.from_user_id, trade.to_user_id)
    if user.id not in allowed:
        raise NotFound("Not found") if hidden else PermissionDenied("Forbidden")
    if not is_member(trade, "from" if user.id == trade.from_user_id else "to"):
        raise NotFound("Not found")
    return trade
