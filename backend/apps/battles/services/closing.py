"""Skipping postbattle and closing it for everyone (decision 3, BUG-09, BATL-TWEAK-02).

A skipped player's results aren't applied, but the single-use items he used are used up (BUG-72). Close postbattle
skips everyone who hasn't finished and ends the battle, which records the wins and losses; it is the way out of a
postbattle, since cancelling refuses one.
"""

from django.utils import timezone

from ..models import Battle, BattleEvent, BattleParticipant
from ..validation.postbattle import empty_draft
from .events import append_event
from .lifecycle import end_battle
from .postbattle.items import consume_single_use_items


def skip_postbattle(battle: Battle, participant: BattleParticipant, *, actor_user, closed_by=None) -> dict:
    """Mark the participant's postbattle skipped and return its event: nothing applied, the items used in battle
    used up, the draft cleared. `closed_by` is whoever closed postbattle for him."""
    consume_single_use_items(battle, participant)
    participant.postbattle_json = empty_draft()
    participant.status = BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
    participant.skipped_postbattle = True
    participant.confirmed_at = timezone.now()
    participant.save(update_fields=["postbattle_json", "status", "skipped_postbattle", "confirmed_at", "updated_at"])
    payload: dict = {"participant_user_id": participant.user_id, "skipped_postbattle": True}
    if closed_by is not None:
        payload["closed_by_user_id"] = closed_by.id
    return append_event(
        battle, BattleEvent.TYPE_PARTICIPANT_CONFIRMED_POSTBATTLE, actor_user=actor_user, payload=payload
    )


def close_postbattle(battle: Battle, *, actor_user, mode: str) -> list[dict]:
    """Skip every participant still in postbattle and end the battle (wins and losses recorded); the battle is
    locked. `actor_user` is None when the deadline closed it (mode "expired"). Returns the events."""
    unfinished = BattleParticipant.objects.select_for_update().filter(
        battle_id=battle.id, status=BattleParticipant.STATUS_FINISHED_BATTLE
    )
    events = [skip_postbattle(battle, entry, actor_user=actor_user, closed_by=actor_user) for entry in unfinished]
    closed_by_user_id = actor_user.id if actor_user else None
    end_battle(battle, actor_user, events, closed_by_user_id=closed_by_user_id, mode=mode)
    return events
