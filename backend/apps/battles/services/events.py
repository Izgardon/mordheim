"""The battle's timeline and the notifications its players get.

Events are append-only (a voided one stays, marked); a write returns the events it added and broadcasts them after
its transaction (services/broadcast.py). User notifications go through `notify_user`, sent after commit in the
background like every realtime message.
"""

from apps.realtime.services import send_user_notification

from ..models import Battle, BattleEvent
from ..serializers import serialize_event


def append_event(battle: Battle, event_type: str, actor_user=None, payload: dict | None = None) -> dict:
    """Add an event to the battle's timeline and return it serialised."""
    event = BattleEvent.objects.create(
        battle=battle, actor_user=actor_user, type=event_type, payload_json=payload or {}
    )
    return serialize_event(event)


def notify_user(user_id: int, event: str, payload: dict) -> None:
    send_user_notification(user_id, event, payload)


def notify_canceled(battle: Battle, user_ids) -> None:
    """Tell each player the battle was cancelled, wherever he is: off the battle page, its events don't reach him,
    and his Rejoin and invite would stay until a reload."""
    payload = {"battle_id": battle.id, "campaign_id": battle.campaign_id, "status": Battle.STATUS_CANCELED}
    for user_id in user_ids:
        notify_user(user_id, "battle_canceled", payload)


def notify_result_updated(battle: Battle, user_ids) -> None:
    """Tell each player a reported result changed (approved, declined, withdrawn or cancelled)."""
    payload = {"battle_id": battle.id, "campaign_id": battle.campaign_id, "status": battle.status}
    for user_id in user_ids:
        notify_user(user_id, "battle_result_updated", payload)
