import re
import uuid
from functools import lru_cache
from typing import Any

from django.conf import settings

from apps.core.dispatch import dispatch_after_commit

try:
    import pusher  # type: ignore[import-untyped]
except ImportError:  # pragma: no cover - optional dependency
    pusher = None


def get_campaign_chat_channel_name(campaign_id: int) -> str:
    return f"private-campaign-{campaign_id}-chat"


def get_campaign_events_channel_name(campaign_id: int) -> str:
    return f"private-campaign-{campaign_id}-events"


def get_user_channel_name(user_id: int) -> str:
    return f"private-user-{user_id}-notifications"


def get_trade_channel_name(trade_id: uuid.UUID | str) -> str:
    return f"private-trade-{trade_id}"


def get_battle_channel_name(battle_id: int) -> str:
    return f"private-battle-{battle_id}"


def _pusher_configured() -> bool:
    return bool(
        pusher and settings.PUSHER_APP_ID and settings.PUSHER_KEY and settings.PUSHER_SECRET and settings.PUSHER_CLUSTER
    )


@lru_cache(maxsize=1)
def get_pusher_client():
    if not _pusher_configured():
        return None
    if settings.PUSHER_HOST:
        return pusher.Pusher(
            app_id=settings.PUSHER_APP_ID,
            key=settings.PUSHER_KEY,
            secret=settings.PUSHER_SECRET,
            host=settings.PUSHER_HOST,
            port=settings.PUSHER_PORT,
            ssl=settings.PUSHER_USE_TLS,
            timeout=settings.PUSHER_TIMEOUT_SECONDS,
        )
    return pusher.Pusher(
        app_id=settings.PUSHER_APP_ID,
        key=settings.PUSHER_KEY,
        secret=settings.PUSHER_SECRET,
        cluster=settings.PUSHER_CLUSTER,
        ssl=True,
        timeout=settings.PUSHER_TIMEOUT_SECONDS,
    )


# Pusher's socket id format; Pusher rejects anything else, which would lose the event in the background
_SOCKET_ID = re.compile(r"\A\d+\.\d+\Z")


def sender_socket_id(request: Any) -> str | None:
    """The `X-Pusher-Socket-Id` a client sends with a write, so the events the write causes skip its own socket
    (it has the answer already, ECON-PERF-02). Missing or malformed: None, and everyone gets the event."""
    socket_id = str(request.headers.get("X-Pusher-Socket-Id", "")).strip()
    return socket_id if _SOCKET_ID.match(socket_id) else None


def _trigger(channel_name: str, event: str, data: dict, socket_id: str | None = None) -> bool:
    """Queue a Pusher event to send after commit, to every subscriber but `socket_id`. Returns False when Pusher
    isn't configured."""
    client = get_pusher_client()
    if client is None:
        return False
    excluded = {"socket_id": socket_id} if socket_id else {}
    dispatch_after_commit(client.trigger, channel_name, event, data, **excluded)
    return True


def send_user_notification(user_id: int, event: str, payload: dict) -> bool:
    return _trigger(get_user_channel_name(user_id), "notification", {"type": event, "payload": payload})


def send_trade_event(
    trade_request_id: uuid.UUID | str, event: str, payload: dict, socket_id: str | None = None
) -> bool:
    data = {"type": event, "payload": payload}
    return _trigger(get_trade_channel_name(trade_request_id), "trade.event", data, socket_id)


def send_battle_event(battle_id: int, event: str, payload: dict, socket_id: str | None = None, **fields: Any) -> bool:
    """`battle.event` with {type, payload, **fields} (state_version and snapshots, PERF-34), to every subscriber
    but `socket_id` (BUG-75)."""
    data = {"type": event, "payload": payload, **fields}
    return _trigger(get_battle_channel_name(battle_id), "battle.event", data, socket_id)


def send_campaign_chat_message(campaign_id: int, message) -> bool:
    payload = {
        "id": message.id,
        "campaign_id": message.campaign_id,
        "user_id": message.user_id,
        "username": message.username,
        "body": message.body,
        "created_at": message.created_at.isoformat(),
        "removed_at": None,
        "removed_by": None,
    }
    return _trigger(get_campaign_chat_channel_name(campaign_id), "chat.message", payload)


# fields of the campaign payload that depend on who reads it: never on the shared events channel
VIEWER_FIELDS = frozenset({"role", "permissions", "capabilities", "chat_unread"})


def send_campaign_updated(campaign_id: int, campaign: dict, socket_id: str | None = None) -> bool:
    """`campaign.updated` on the campaign's events channel: the campaign as its detail answers it, without the
    reader's own fields, so every member's page updates in place (CAMP-NEW-07, IMP-73). The writer's own socket
    (`socket_id`) is skipped: it has the answer."""
    payload = {key: value for key, value in campaign.items() if key not in VIEWER_FIELDS}
    return _trigger(get_campaign_events_channel_name(campaign_id), "campaign.updated", payload, socket_id)


def send_campaign_chat_removed(campaign_id: int, message_id: int, removed_at: str) -> bool:
    """`chat.removed`: an owner or admin removed the message; every member shows it as "removed by admin"
    (decision 8)."""
    payload = {"id": message_id, "campaign_id": campaign_id, "removed_at": removed_at, "removed_by": "admin"}
    return _trigger(get_campaign_chat_channel_name(campaign_id), "chat.removed", payload)
