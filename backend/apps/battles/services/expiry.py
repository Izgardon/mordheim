"""Settling battles past their deadline, without a scheduler (decision 2, BUG-10, BATL-NEW-02).

An invitation unanswered 72 hours after the battle was created counts as declined (with fewer than two players left
the battle is cancelled), and a postbattle still open 72 hours after the fight ended is closed as Close postbattle closes
it (whoever hasn't finished is skipped and the battle ends). Nothing runs on a timer: an overdue battle is settled
when the campaign's battle list or Settings > Active Battles is read (a few per request), or first thing in any
write to it. Reading a single battle only reports `overdue`.
"""

from collections.abc import Iterable

from django.db import transaction

from ..models import Battle, BattleParticipant
from ..serializers import battle_snapshot
from .broadcast import ALL, bump_state_version, publish
from .closing import close_postbattle
from .invites import decline_invitation
from .locks import locked
from .timing import is_overdue

EXPIRY_BATCH = 5  # overdue battles settled by one list read; the rest wait for the next


def expire_locked_battle(battle: Battle) -> list[dict]:
    """Settle an overdue battle the caller has locked; returns the events (none when it isn't overdue)."""
    if not is_overdue(battle):
        return []
    if battle.status == Battle.STATUS_POSTBATTLE:
        return close_postbattle(battle, actor_user=None, mode="expired")
    events: list[dict] = []
    unanswered = locked(BattleParticipant.objects.select_related("user"))
    for entry in unanswered.filter(battle_id=battle.id, status=BattleParticipant.STATUS_INVITED).order_by("id"):
        if battle.status != Battle.STATUS_INVITING:  # cancelled by the last decline
            break
        events += decline_invitation(battle, entry, actor_user=None, reason="expired")
    return events


def settle_during_write(battle: Battle) -> None:
    """First thing in a write to an overdue battle (locked): settle it, and queue its events for after commit.
    The write then answers from the battle's new state."""
    events = expire_locked_battle(battle)
    if events:
        publish_expired(battle, events, bump_state_version(battle))


def expire_overdue(battles: Iterable[Battle]) -> bool:
    """Settle up to EXPIRY_BATCH of these (already loaded) battles that are overdue, each in its own transaction,
    skipping one another request has locked. Returns whether any changed (the caller reads its list again)."""
    changed = False
    for battle_id in [battle.id for battle in battles if is_overdue(battle)][:EXPIRY_BATCH]:
        with transaction.atomic():
            battle = locked(Battle.objects.filter(id=battle_id), skip_locked=True).first()
            if battle is None:
                continue
            events = expire_locked_battle(battle)
            if not events:
                continue
            version = bump_state_version(battle)
        publish_expired(battle, events, version)
        changed = True
    return changed


def publish_expired(battle: Battle, events: list[dict], version: int) -> None:
    """Send what the deadline settled to every player (nobody's socket is skipped: no one asked for it)."""
    publish(
        battle_snapshot(battle.id),
        events,
        version=version,
        changed=ALL,
        reason="expired",
        actor_user_id=None,
        socket_id=None,
    )
