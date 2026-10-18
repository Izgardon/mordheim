"""Loading a trade for one of its two players: the check every trade view starts with."""

from typing import Any
from uuid import UUID

from django.db.models import Exists, OuterRef, Q, QuerySet
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied

from apps.campaigns.models import CampaignMembership

from .models import TradeRequest
from .services.errors import TradeError
from .services.timing import OPEN_STATUSES

LISTED_STATUSES = {status for status, _label in TradeRequest.STATUS_CHOICES}


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
    a player who has left the campaign 404, as for its other endpoints (SEC-08). Only the owner of a side's
    warband acts for that side (decision 10; `WARBAND_RULES["trade"]`), whoever else may edit the warband.

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
    side = "from" if user.id == trade.from_user_id else "to"
    if user.id not in allowed or getattr(trade, f"{side}_warband").user_id != user.id:
        raise NotFound("Not found") if hidden else PermissionDenied("Forbidden")
    if not is_member(trade, side):
        raise NotFound("Not found")
    return trade


def require_member(user: Any, campaign_id: int) -> None:
    """The campaign-level trade endpoints are for its members only: 404 for anyone else."""
    if not CampaignMembership.objects.filter(campaign_id=campaign_id, user_id=user.id).exists():
        raise NotFound("Not found")


def _shown_as(status: str) -> Q:
    """Trades whose payload shows `status`: an open trade past its deadline reads as expired before
    `manage.py expire_trades` (or a write) marks it so (decision 8)."""
    if status == TradeRequest.STATUS_EXPIRED:
        return Q(status=status) | Q(status__in=OPEN_STATUSES, expires_at__lte=timezone.now())
    if status in OPEN_STATUSES:
        return Q(status=status, expires_at__gt=timezone.now())
    return Q(status=status)


def player_trades(user: Any, campaign_id: int, status: str | None = None) -> QuerySet[TradeRequest]:
    """The campaign's trades the user sent or received (BUG-116), optionally of one status as shown (TradeError
    400 for an unknown one); unanswered first ("-responded_at" puts NULLs first on Postgres), then newest."""
    if status and status not in LISTED_STATUSES:
        raise TradeError("Invalid status")
    rows = trade_requests().filter(Q(from_user=user) | Q(to_user=user), campaign_id=campaign_id)
    if status:
        rows = rows.filter(_shown_as(status))
    return rows.order_by("-responded_at", "-created_at")


def due_trades() -> QuerySet[TradeRequest]:
    """Open trades past their deadline, oldest deadline first: what `manage.py expire_trades` closes."""
    return trade_requests().filter(status__in=OPEN_STATUSES, expires_at__lte=timezone.now()).order_by("expires_at")
