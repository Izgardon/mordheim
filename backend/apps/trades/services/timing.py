"""How long a trade stays open (decision 8, BUG-69, ECON-UX-01).

A request waits 10 minutes for an answer. Once accepted, the session stays open 10 minutes after each action by
either player (an offer, a lock or an unlock), but never longer than 60 minutes after it was accepted. The
deadline in force is the request's `expires_at`, which every trade payload carries so the client can count down.
"""

from datetime import datetime, timedelta

from django.utils import timezone

from apps.trades.models import TradeRequest

ANSWER_WINDOW = timedelta(minutes=10)  # a pending request, from when it was sent
IDLE_WINDOW = timedelta(minutes=10)  # an open session, from its last action
SESSION_LIMIT = timedelta(minutes=60)  # an open session, from when it was accepted

OPEN_STATUSES = (TradeRequest.STATUS_PENDING, TradeRequest.STATUS_ACCEPTED)


def answer_deadline() -> datetime:
    """When a request sent now runs out unless it is answered."""
    return timezone.now() + ANSWER_WINDOW


def extend(trade: TradeRequest) -> None:
    """Keep an accepted trade open 10 minutes from now, but no later than 60 minutes after it was accepted
    (`responded_at`, which accepting sets; the caller saves `expires_at`)."""
    accepted_at = trade.responded_at or trade.created_at
    trade.expires_at = min(timezone.now() + IDLE_WINDOW, accepted_at + SESSION_LIMIT)


def is_due(trade: TradeRequest) -> bool:
    """An open trade past its deadline. Finished trades never expire."""
    return trade.status in OPEN_STATUSES and trade.expires_at <= timezone.now()
