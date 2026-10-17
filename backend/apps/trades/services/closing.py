"""What every finished trade does, however it finished (decision 8, BUG-69).

Completed, declined, cancelled or expired, by a player, a cleared notification or `manage.py expire_trades`: the
trade's notifications are resolved in the same transaction, and both players get a `trade_closed` user event
after commit carrying the trade as it ended.
"""

from apps.notifications.models import Notification
from apps.notifications.utils import resolve_notifications_for_reference
from apps.realtime.services import send_user_notification
from apps.trades.models import TradeRequest
from apps.trades.serializers import serialize_trade_request


def close_out(trade: TradeRequest) -> None:
    """Resolve the finished trade's notifications and queue `trade_closed` for both players (the trade is read
    through `selectors.trade_requests()`, so its payload needs no query)."""
    resolve_notifications_for_reference(Notification.TYPE_TRADE_REQUEST, str(trade.id))
    payload = serialize_trade_request(trade)
    for user_id in (trade.from_user_id, trade.to_user_id):
        send_user_notification(user_id, "trade_closed", payload)
