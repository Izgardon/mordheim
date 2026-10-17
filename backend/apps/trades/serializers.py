"""Trade payloads: the body of every trade response, trade-channel event, user event and trade notification."""

from typing import Any

from apps.realtime.services import get_trade_channel_name
from apps.warbands.services.sheet import warband_summaries

from .models import TradeRequest
from .services.timing import is_due


def _display_name(user: Any) -> str:
    """The player's first name, or their username when they have none."""
    return str(user.first_name).strip() or str(user.get_username())


def serialize_trade_request(trade: TradeRequest) -> dict[str, Any]:
    """A trade as every client sees it (read through `selectors.trade_requests()`, so both players and both
    warbands are already loaded). An open trade past its deadline shows as expired: reads never write, and
    `manage.py expire_trades` or the next write marks it (decision 8)."""
    return {
        "id": str(trade.id),
        "campaign_id": trade.campaign_id,
        "status": TradeRequest.STATUS_EXPIRED if is_due(trade) else trade.status,  # ran out, not yet marked
        "created_at": trade.created_at.isoformat(),
        "responded_at": trade.responded_at.isoformat() if trade.responded_at else None,
        "expires_at": trade.expires_at.isoformat(),
        "from_offer": trade.from_offer or {},
        "to_offer": trade.to_offer or {},
        "from_accepted": trade.from_accepted,
        "to_accepted": trade.to_accepted,
        "offer_version": trade.offer_version,
        "from_user": {"id": trade.from_user_id, "label": _display_name(trade.from_user)},
        "to_user": {"id": trade.to_user_id, "label": _display_name(trade.to_user)},
        "from_warband": {"id": trade.from_warband_id, "name": trade.from_warband.name},
        "to_warband": {"id": trade.to_warband_id, "name": trade.to_warband.name},
        "channel": get_trade_channel_name(trade.id),
    }


def serialize_completed_trade(trade: TradeRequest) -> dict[str, Any]:
    """A completed trade's payload with both warbands' summaries, so neither player re-reads its own."""
    summaries = warband_summaries([trade.from_warband_id, trade.to_warband_id])
    return {
        **serialize_trade_request(trade),
        "from_summary": summaries[trade.from_warband_id],
        "to_summary": summaries[trade.to_warband_id],
    }
