"""The trade's state changes, each on a trade the caller has locked (BUG-08).

Every function takes a trade loaded with `get_trade_for_participant(..., lock=True)` inside the caller's
transaction and saves only the fields it changes, so two players acting at once can't erase each other's lock or
offer. A refused action raises TradeError, which rolls its transaction back.
"""

from typing import Any

from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from apps.trades.models import TradeRequest

from .completion import complete_trade
from .errors import TradeError
from .offers import build_offer
from .traders import SPENT_FIELDS, restore_spent_traders, spend_trader

OPEN_STATUSES = (TradeRequest.STATUS_PENDING, TradeRequest.STATUS_ACCEPTED)
NOT_ACTIVE = "Trade is not active"


def side_of(trade: TradeRequest, user: Any) -> str:
    return "from" if user.id == trade.from_user_id else "to"


def is_due(trade: TradeRequest) -> bool:
    """An open trade past its expiry. Finished trades never expire."""
    return trade.status in OPEN_STATUSES and trade.expires_at <= timezone.now()


def _finish(trade: TradeRequest, status: str) -> None:
    """End an open trade: unlock both sides, give back the traders it spent."""
    restore_spent_traders(trade)
    trade.from_accepted = trade.to_accepted = False
    trade.status = status
    trade.responded_at = timezone.now()
    trade.save(update_fields=["status", "responded_at", "from_accepted", "to_accepted", *SPENT_FIELDS])


def expire(trade: TradeRequest) -> None:
    _finish(trade, TradeRequest.STATUS_EXPIRED)


def expire_due(trades: QuerySet[TradeRequest]) -> None:
    """Expire the open trades in `trades` that are past due, under their locks."""
    with transaction.atomic():
        for trade in trades.select_for_update(of=("self",)):
            if is_due(trade):
                expire(trade)


def answer_request(trade: TradeRequest, accept: bool) -> None:
    """The recipient accepts (the trade opens for offers) or declines a pending request."""
    if trade.status != TradeRequest.STATUS_PENDING:
        raise TradeError("Trade request is no longer pending")
    trade.status = TradeRequest.STATUS_ACCEPTED if accept else TradeRequest.STATUS_DECLINED
    trade.responded_at = timezone.now()
    trade.save(update_fields=["status", "responded_at"])


def close(trade: TradeRequest) -> None:
    """Either player ends a pending or open trade."""
    if trade.status not in OPEN_STATUSES:
        raise TradeError("Trade request is no longer active")
    _finish(trade, TradeRequest.STATUS_DECLINED)


def update_offer(trade: TradeRequest, side: str, payload: Any) -> None:
    """Replace the side's offer. Any offer unlocks both sides and gives back the traders they spent."""
    if trade.status != TradeRequest.STATUS_ACCEPTED:
        raise TradeError(NOT_ACTIVE)
    restore_spent_traders(trade)  # first, so a trader this trade spent can be offered again
    setattr(trade, f"{side}_offer", build_offer(payload, getattr(trade, f"{side}_warband_id")))
    trade.from_accepted = trade.to_accepted = False
    trade.offer_version += 1  # under the row lock, so no two offers get the same version
    trade.save(update_fields=[f"{side}_offer", "from_accepted", "to_accepted", "offer_version", *SPENT_FIELDS])


def check_offer_version(trade: TradeRequest, shown: int | None) -> None:
    """A lock may name the offer version its player was shown; another version is a 409 (BUG-35). A lock
    without one (clients from before pass 2) locks the offers as they stand, as it always did."""
    if shown is not None and shown != trade.offer_version:
        detail = "The offers changed since you last saw them. Check them and accept again."
        raise TradeError(detail, status=409, code="offer_changed", offer_version=trade.offer_version)


def lock_side(trade: TradeRequest, side: str) -> None:
    """The side accepts the offers as they stand, spending its trader once (a second lock changes nothing)."""
    if trade.status != TradeRequest.STATUS_ACCEPTED:
        raise TradeError(NOT_ACTIVE)
    if getattr(trade, f"{side}_accepted"):
        return
    spend_trader(trade, side)
    setattr(trade, f"{side}_accepted", True)
    trade.save(update_fields=[f"{side}_accepted", f"{side}_trader_spent"])


def both_locked(trade: TradeRequest) -> bool:
    return trade.from_accepted and trade.to_accepted


def complete_or_reopen(trade: TradeRequest) -> TradeError | None:
    """Complete a trade both sides have locked, in the lock's transaction (BUG-41). When it can't complete,
    both sides are unlocked and their traders given back, and the reason is returned."""
    try:
        complete_trade(trade)
    except TradeError as failure:
        restore_spent_traders(trade)
        trade.from_accepted = trade.to_accepted = False
        trade.save(update_fields=["from_accepted", "to_accepted", *SPENT_FIELDS])
        return failure
    return None


def unlock_side(trade: TradeRequest, side: str) -> None:
    """The side takes its acceptance back and gets back the trader its lock spent."""
    if trade.status != TradeRequest.STATUS_ACCEPTED:
        raise TradeError(NOT_ACTIVE)
    restore_spent_traders(trade, (side,))
    setattr(trade, f"{side}_accepted", False)
    trade.save(update_fields=[f"{side}_accepted", f"{side}_trader_spent"])
