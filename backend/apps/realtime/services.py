import uuid
from functools import lru_cache

from django.conf import settings
from django.utils import timezone

try:
    import pusher
except ImportError:  # pragma: no cover - optional dependency
    pusher = None

def get_campaign_channel_name(campaign_id: int) -> str:
    return f"private-campaign-{campaign_id}-pings"


def get_user_channel_name(user_id: int) -> str:
    return f"private-user-{user_id}-notifications"


def get_trade_channel_name(trade_id: uuid.UUID | str) -> str:
    return f"private-trade-{trade_id}"


def _pusher_configured() -> bool:
    return bool(
        pusher
        and settings.PUSHER_APP_ID
        and settings.PUSHER_KEY
        and settings.PUSHER_SECRET
        and settings.PUSHER_CLUSTER
    )


@lru_cache(maxsize=1)
def get_pusher_client():
    if not _pusher_configured():
        return None
    return pusher.Pusher(
        app_id=settings.PUSHER_APP_ID,
        key=settings.PUSHER_KEY,
        secret=settings.PUSHER_SECRET,
        cluster=settings.PUSHER_CLUSTER,
        ssl=True,
    )


def build_ping_payload(campaign_id: int, user, payload: object | None):
    return {
        "type": "ping",
        "from": {"id": user.id, "label": user.get_username()},
        "campaign_id": campaign_id,
        "payload": payload,
        "timestamp": timezone.now().isoformat(),
    }


def serialize_trade_request(trade_request):
    def _display_name(user):
        first_name = getattr(user, "first_name", None)
        if first_name and str(first_name).strip():
            return str(first_name).strip()
        return user.get_username()

    return {
        "id": str(trade_request.id),
        "campaign_id": trade_request.campaign_id,
        "status": trade_request.status,
        "created_at": trade_request.created_at.isoformat(),
        "responded_at": trade_request.responded_at.isoformat() if trade_request.responded_at else None,
        "expires_at": trade_request.expires_at.isoformat(),
        "from_offer": trade_request.from_offer or {},
        "to_offer": trade_request.to_offer or {},
        "from_accepted": bool(trade_request.from_accepted),
        "to_accepted": bool(trade_request.to_accepted),
        "from_user": {
            "id": trade_request.from_user_id,
            "label": _display_name(trade_request.from_user),
        },
        "to_user": {
            "id": trade_request.to_user_id,
            "label": _display_name(trade_request.to_user),
        },
        "from_warband": {
            "id": trade_request.from_warband_id,
            "name": trade_request.from_warband.name,
        },
        "to_warband": {
            "id": trade_request.to_warband_id,
            "name": trade_request.to_warband.name,
        },
        "channel": get_trade_channel_name(trade_request.id),
    }


def send_user_notification(user_id: int, event: str, payload: dict) -> bool:
    client = get_pusher_client()
    channel_name = get_user_channel_name(user_id)
    data = {"type": event, "payload": payload}

    if client:
        client.trigger(channel_name, "notification", data)
        return True
    return False


def send_trade_event(trade_request_id: uuid.UUID | str, event: str, payload: dict) -> bool:
    client = get_pusher_client()
    channel_name = get_trade_channel_name(trade_request_id)
    data = {"type": event, "payload": payload}

    if client:
        client.trigger(channel_name, "trade.event", data)
        return True
    return False


def send_campaign_ping(campaign_id: int, user, payload: object | None = None) -> bool:
    data = build_ping_payload(campaign_id, user, payload)

    client = get_pusher_client()
    if client:
        channel_name = get_campaign_channel_name(campaign_id)
        client.trigger(channel_name, "ping", data)
        return True
    return False
