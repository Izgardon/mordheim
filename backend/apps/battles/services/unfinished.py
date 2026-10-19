"""Your unfinished battle, with a way back to it (decision 1, BATL-NEW-01).

A battle is unfinished for a player while it is open (inviting to postbattle, normal flow) and he still has
something to do in it: answer the invitation, get ready, fight, or finish his postbattle (also the busy rule the
Start dialog warns with, services/setup.py). `viewer` says so for the reader of a battle, with the page where he
carries on; with decision 4 that follows his own status, as his postbattle opens when he finishes his battle while
others fight. The battle's `last_activity_at` is its idle time.
"""

from ..models import Battle, BattleParticipant

BUSY_BATTLE_STATUSES = (
    Battle.STATUS_INVITING,
    Battle.STATUS_PREBATTLE,
    Battle.STATUS_ACTIVE,
    Battle.STATUS_POSTBATTLE,
)
BUSY_PARTICIPANT_STATUSES = (
    BattleParticipant.STATUS_INVITED,
    BattleParticipant.STATUS_ACCEPTED,
    BattleParticipant.STATUS_JOINED_PREBATTLE,
    BattleParticipant.STATUS_READY,
    BattleParticipant.STATUS_IN_BATTLE,
    BattleParticipant.STATUS_FINISHED_BATTLE,
)
DONE_FIGHTING = (BattleParticipant.STATUS_FINISHED_BATTLE, BattleParticipant.STATUS_CONFIRMED_POSTBATTLE)


def page_for(battle: Battle, participant: BattleParticipant) -> str | None:
    """The battle page where the participant carries on (`prebattle` shows an invitation too), or None once the
    battle is over for him (or it is a reported result, answered on the overview)."""
    if battle.flow_type != Battle.FLOW_TYPE_NORMAL or participant.status in BattleParticipant.LEFT_STATUSES:
        return None
    if battle.status in (Battle.STATUS_INVITING, Battle.STATUS_PREBATTLE):
        return "prebattle"
    if battle.status == Battle.STATUS_ACTIVE:
        return "postbattle" if participant.status in DONE_FIGHTING else "active"
    return "postbattle" if battle.status == Battle.STATUS_POSTBATTLE else None


def is_unfinished(battle: Battle, participant: BattleParticipant) -> bool:
    return (
        battle.flow_type == Battle.FLOW_TYPE_NORMAL
        and battle.status in BUSY_BATTLE_STATUSES
        and participant.status in BUSY_PARTICIPANT_STATUSES
    )


def viewer(battle: Battle, participant: BattleParticipant | None) -> dict:
    """The reader's place in the battle: his status, whether it is unfinished for him and the page to open."""
    if participant is None:
        return {"participant_status": None, "unfinished": False, "page": None}
    return {
        "participant_status": participant.status,
        "unfinished": is_unfinished(battle, participant),
        "page": page_for(battle, participant),
    }


def viewer_in(battle: Battle, user_id: int) -> dict:
    """`viewer` for a battle loaded with its participants (no query)."""
    mine = next((entry for entry in battle.participants.all() if entry.user_id == user_id), None)
    return viewer(battle, mine)
