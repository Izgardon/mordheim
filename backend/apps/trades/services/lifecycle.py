"""The trade's state changes, each on a trade the caller has locked (BUG-08).

Every function takes a trade loaded with `get_trade_for_participant(..., lock=True)` inside the caller's
transaction and saves only the fields it changes, so two players acting at once can't erase each other's lock or
offer. A refused action raises TradeError, which rolls its transaction back. Accepting starts the session's clock
and every applied offer, lock or unlock extends it; every way a trade ends goes through `closing.close_out`
(decision 8).
"""

from collections.abc import Iterable
from typing import Any
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from apps.trades.models import TradeRequest
from apps.trades.selectors import trade_requests

from .closing import close_out
from .completion import complete_trade
from .errors import TradeError
from .offers import TradeWarning, build_offer
from .timing import OPEN_STATUSES, extend, is_due
from .traders import SPENT_FIELDS, restore_spent_traders, spend_trader

NOT_ACTIVE = "Trade is not active"


def side_of(trade: TradeRequest, user: Any) -> str:
    return "from" if user.id == trade.from_user_id else "to"


def _finish(trade: TradeRequest, status: str) -> None:
    """End an open trade: unlock both sides, give back the traders it spent, close it out."""
    restore_spent_traders(trade)
    trade.from_accepted = trade.to_accepted = False
    trade.status = status
    trade.responded_at = timezone.now()
    trade.save(update_fields=["status", "responded_at", "from_accepted", "to_accepted", *SPENT_FIELDS])
    close_out(trade)


def expire(trade: TradeRequest) -> None:
    _finish(trade, TradeRequest.STATUS_EXPIRED)


def expire_due_trades(trade_ids: Iterable[UUID]) -> list[TradeRequest]:
    """Expire those of the trades that are still past due, each in its own transaction under its row lock, and
    return them. A trade a player is writing to right now is skipped: that write expires or extends it."""
    expired = []
    for trade_id in trade_ids:
        with transaction.atomic():
            rows = trade_requests().select_for_update(of=("self",), skip_locked=True)
            trade = rows.filter(id=trade_id).first()
            if trade is not None and is_due(trade):
                expire(trade)
                expired.append(trade)
    return expired


def answer_request(trade: TradeRequest, accept: bool) -> None:
    """The recipient accepts (the trade opens for offers, with 10 minutes on its clock) or declines a pending
    request."""
    if trade.status != TradeRequest.STATUS_PENDING:
        raise TradeError("Trade request is no longer pending")
    trade.status = TradeRequest.STATUS_ACCEPTED if accept else TradeRequest.STATUS_DECLINED
    trade.responded_at = timezone.now()
    if accept:
        extend(trade)
    trade.save(update_fields=["status", "responded_at", "expires_at"])
    if not accept:
        close_out(trade)


def close(trade: TradeRequest, side: str) -> None:
    """Either player ends a pending or open trade: the sender cancels it, the recipient declines it (BUG-115)."""
    if trade.status not in OPEN_STATUSES:
        raise TradeError("Trade request is no longer active")
    _finish(trade, TradeRequest.STATUS_CANCELLED if side == "from" else TradeRequest.STATUS_DECLINED)


def update_offer(trade: TradeRequest, side: str, payload: Any) -> list[TradeWarning]:
    """Replace the side's offer and return its warnings. Any offer unlocks both sides and gives back the traders
    they spent."""
    if trade.status != TradeRequest.STATUS_ACCEPTED:
        raise TradeError(NOT_ACTIVE)
    restore_spent_traders(trade)  # first, so a trader this trade spent can be offered again
    offer, warnings = build_offer(payload, getattr(trade, f"{side}_warband_id"))
    setattr(trade, f"{side}_offer", offer)
    trade.from_accepted = trade.to_accepted = False
    trade.offer_version += 1  # under the row lock, so no two offers get the same version
    extend(trade)
    changed = [f"{side}_offer", "from_accepted", "to_accepted", "offer_version", "expires_at", *SPENT_FIELDS]
    trade.save(update_fields=changed)
    return warnings


def _shown_offer_version(data: Any) -> int | None:
    """The `offer_version` a lock was sent with: None when absent; TradeError (400) when not a whole number."""
    shown = data.get("offer_version") if isinstance(data, dict) else None
    if shown is None:
        return None
    if isinstance(shown, bool) or not str(shown).strip().isdigit():
        raise TradeError("offer_version must be a whole number.", code="invalid")
    return int(shown)


def check_offer_version(trade: TradeRequest, data: Any) -> None:
    """A lock may name the offer version its player was shown (`data["offer_version"]`); another version is a
    409 (BUG-35), a malformed one a 400. A lock without one (clients from before pass 2) locks the offers as they
    stand, as it always did."""
    shown = _shown_offer_version(data)
    if shown is not None and shown != trade.offer_version:
        detail = "The offers changed since you last saw them. Check them and accept again."
        raise TradeError(detail, status=409, code="offer_changed", offer_version=trade.offer_version)


def lock_side(trade: TradeRequest, side: str) -> list[TradeWarning]:
    """The side accepts the offers as they stand, spending its trader once (a second lock changes nothing), and
    gets the warnings: a trader who already traded this round still locks (decision 9)."""
    if trade.status != TradeRequest.STATUS_ACCEPTED:
        raise TradeError(NOT_ACTIVE)
    if getattr(trade, f"{side}_accepted"):
        return []
    warnings = spend_trader(trade, side)
    setattr(trade, f"{side}_accepted", True)
    extend(trade)
    trade.save(update_fields=[f"{side}_accepted", f"{side}_trader_spent", "expires_at"])
    return warnings


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
    close_out(trade)
    return None


def unlock_side(trade: TradeRequest, side: str) -> None:
    """The side takes its acceptance back and gets back the trader its lock spent."""
    if trade.status != TradeRequest.STATUS_ACCEPTED:
        raise TradeError(NOT_ACTIVE)
    restore_spent_traders(trade, (side,))
    setattr(trade, f"{side}_accepted", False)
    extend(trade)
    trade.save(update_fields=[f"{side}_accepted", f"{side}_trader_spent", "expires_at"])
