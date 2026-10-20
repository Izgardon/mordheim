"""What removing a member does to his open battles (decision 1, the brief's "What close means"), through pass 3's
battle services.

- Inviting, prebattle, a reported result waiting for approval, and an active battle nobody has applied a postbattle
  in: cancelled for everyone, as Settings > Active Battles cancels it (`cancel_battle`, mode "member_removed").
- Postbattle, and an active battle someone has already applied his postbattle in (decision 4: it can't be cancelled
  any more): only the removed player is skipped, as Close postbattle skips whoever hasn't finished (his results
  aren't applied; single-use items he used are used up). Still fighting, he finishes first, undecided, which ends
  the fight if he was the last one in it. The battle ends as normal when the others finish (`end_battle`).

Each battle is locked first and settled if it is past its deadline, as every battle write does. The caller raises
its state_version and broadcasts the events after commit.
"""

from collections.abc import Iterable

from apps.battles.models import Battle, BattleParticipant
from apps.battles.services.closing import skip_postbattle
from apps.battles.services.expiry import settle_during_write
from apps.battles.services.finishing import finish_player
from apps.battles.services.lifecycle import cancel_battle, end_if_everyone_finished
from apps.battles.services.locks import locked

OPEN_STATUSES = (
    Battle.STATUS_INVITING,
    Battle.STATUS_REPORTED_RESULT_PENDING,
    Battle.STATUS_PREBATTLE,
    Battle.STATUS_ACTIVE,
    Battle.STATUS_POSTBATTLE,
)
CANCELLED = "cancelled"
SKIPPED = "skipped"
REMOVAL_MODE = "member_removed"
DONE = (*BattleParticipant.LEFT_STATUSES, BattleParticipant.STATUS_CONFIRMED_POSTBATTLE)


def open_participations(campaign_id: int, user_id: int):
    """The member's places in the campaign's open battles that removal changes (not left, not finished)."""
    return (
        BattleParticipant.objects.filter(
            user_id=user_id, battle__campaign_id=campaign_id, battle__status__in=OPEN_STATUSES
        )
        .exclude(status__in=DONE)
        .select_related("battle")
        .order_by("battle_id")
    )


def outcome(battle: Battle, participants: Iterable[BattleParticipant]) -> str:
    """Whether removal cancels the battle or only skips the removed player in it."""
    applied = any(entry.status == BattleParticipant.STATUS_CONFIRMED_POSTBATTLE for entry in participants)
    if battle.status == Battle.STATUS_POSTBATTLE or (battle.status == Battle.STATUS_ACTIVE and applied):
        return SKIPPED
    return CANCELLED


def close_for_removal(battle: Battle, user_id: int, actor) -> list[dict]:
    """Cancel the (locked) battle or skip the removed player in it; returns the events (none when there was
    nothing left to do, e.g. its deadline settled it first)."""
    settle_during_write(battle)
    if battle.status not in OPEN_STATUSES:
        return []
    participants = list(locked(BattleParticipant.objects.filter(battle_id=battle.id).order_by("id")))
    mine = next((entry for entry in participants if entry.user_id == user_id), None)
    if mine is None or mine.status in DONE:
        return []
    if outcome(battle, participants) == CANCELLED:
        return [cancel_battle(battle, actor_user=actor, mode=REMOVAL_MODE)]
    events: list[dict] = []
    if mine.status == BattleParticipant.STATUS_IN_BATTLE:
        events += finish_player(battle, mine, BattleParticipant.DECLARED_UNDECIDED, actor).events
    events.append(skip_postbattle(battle, mine, actor_user=actor, closed_by=actor))
    end_if_everyone_finished(battle, actor, events)
    return events
