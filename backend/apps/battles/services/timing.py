"""A battle's activity and its two timers (decisions 1 and 2, BUG-10, BATL-NEW-02).

`Battle.last_activity_at` moves with every battle write, so pages can say "idle N days". Only two phases have a
deadline, `Battle.closes_at`, counted from when they begin so the deadline shown never moves: an invitation is
answered within 72 hours of the battle's creation, and postbattle closes 72 hours after End battle. No other
automatic action.
"""

from datetime import datetime, timedelta

from django.utils import timezone

from ..models import Battle

INVITE_WINDOW = timedelta(hours=72)
POSTBATTLE_WINDOW = timedelta(hours=72)
TIMED_STATUSES = (Battle.STATUS_INVITING, Battle.STATUS_POSTBATTLE)


def invite_deadline(now: datetime | None = None) -> datetime:
    return (now or timezone.now()) + INVITE_WINDOW


def postbattle_deadline(now: datetime | None = None) -> datetime:
    return (now or timezone.now()) + POSTBATTLE_WINDOW


def is_overdue(battle: Battle, now: datetime | None = None) -> bool:
    """An invitation or a postbattle past its deadline. Reading a battle only reports this; nothing is written."""
    return (
        battle.status in TIMED_STATUSES and battle.closes_at is not None and battle.closes_at <= (now or timezone.now())
    )


def record_activity(battle: Battle) -> None:
    """A write only its player sees (notes, a draft) still counts as activity; the battle is locked."""
    battle.last_activity_at = timezone.now()
    Battle.objects.filter(id=battle.id).update(last_activity_at=battle.last_activity_at)
