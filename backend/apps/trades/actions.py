"""Running one trade write: the trade loaded for its player under its row lock, then the action, in one transaction.

Every write locks the trade row (select_for_update) and makes all its changes in that one transaction, so two
players acting at once can't erase each other's lock or offer (BUG-08).
"""

from collections.abc import Callable
from typing import Any

from django.db import transaction
from rest_framework.request import Request
from rest_framework.response import Response

from .models import TradeRequest
from .selectors import get_trade_for_participant, require_partner
from .services.errors import TradeError
from .services.lifecycle import expire, is_due, side_of

TradeAction = Callable[[TradeRequest, str], Response]


def run_trade_action(
    request: Request,
    campaign_id: int,
    request_id: Any,
    action: TradeAction,
    *,
    recipient_only: bool = False,
    needs_partner: bool = False,
) -> Response:
    """Run `action(trade, side)` on the locked trade. An open trade past due is expired instead (that is kept and
    answered 400); a TradeError rolls the action back and answers its status. With `needs_partner` the other
    player must still be in the campaign (409); backing out (unlock, decline, close) needs only the caller."""
    try:
        with transaction.atomic():
            trade = get_trade_for_participant(
                request.user, campaign_id, request_id, lock=True, recipient_only=recipient_only
            )
            if is_due(trade):
                expire(trade)
                return Response({"detail": "Trade request expired"}, status=400)
            if needs_partner:
                require_partner(trade, request.user)
            return action(trade, side_of(trade, request.user))
    except TradeError as refused:
        return Response(refused.body(), status=refused.status)
