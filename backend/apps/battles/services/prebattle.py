"""Before and around the fight: joining each phase, getting ready, leaving before the start, and the start.

Joining moves a player into the battle's current phase (accepting an invitation opens prebattle once everyone left
has accepted). The start needs everyone still in ready, and stores each roster as it stands (BUG-73, PERF-38).
"""

from dataclasses import dataclass, field

from django.utils import timezone

from ..models import Battle, BattleEvent, BattleParticipant
from .errors import Refused
from .events import append_event
from .invites import open_prebattle, settle_after_leaving
from .lifecycle import everyone_accepted, everyone_ready
from .rosters import battle_rosters_payload


@dataclass
class Joined:
    changed: bool = False
    opened: bool = False  # the last acceptance opened prebattle for everyone
    events: list[dict] = field(default_factory=list)


def _accept(battle: Battle, participant: BattleParticipant, now, joined: Joined) -> None:
    if participant.status == BattleParticipant.STATUS_INVITED:
        participant.status = BattleParticipant.STATUS_ACCEPTED
        participant.responded_at = now
        participant.save(update_fields=["status", "responded_at", "updated_at"])
        joined.changed = True
    if everyone_accepted(battle.id):
        open_prebattle(battle)
        joined.changed = joined.opened = True


def _join_fight(battle: Battle, participant: BattleParticipant, now, actor_user, joined: Joined) -> None:
    finished = (BattleParticipant.STATUS_FINISHED_BATTLE, BattleParticipant.STATUS_CONFIRMED_POSTBATTLE)
    if participant.status in finished or participant.status == BattleParticipant.STATUS_IN_BATTLE:
        return
    participant.status = BattleParticipant.STATUS_IN_BATTLE
    participant.battle_joined_at = participant.battle_joined_at or now
    participant.save(update_fields=["status", "battle_joined_at", "updated_at"])
    payload = {"participant_user_id": actor_user.id, "participant_status": participant.status}
    joined.events.append(
        append_event(battle, BattleEvent.TYPE_PARTICIPANT_JOINED_BATTLE, actor_user=actor_user, payload=payload)
    )


def join(battle: Battle, participant: BattleParticipant, actor_user) -> Joined:
    """Move the participant into the battle's current phase (`join/`); nothing changes when he is already there."""
    now, joined = timezone.now(), Joined()
    if battle.status == Battle.STATUS_INVITING:
        _accept(battle, participant, now, joined)
    elif battle.status == Battle.STATUS_PREBATTLE:
        if participant.status != BattleParticipant.STATUS_READY:
            participant.status = BattleParticipant.STATUS_JOINED_PREBATTLE
            participant.joined_at = participant.joined_at or now
            participant.save(update_fields=["status", "joined_at", "updated_at"])
            joined.changed = True
    elif battle.status == Battle.STATUS_ACTIVE:
        _join_fight(battle, participant, now, actor_user, joined)
    elif participant.status != BattleParticipant.STATUS_CONFIRMED_POSTBATTLE:
        participant.status = BattleParticipant.STATUS_FINISHED_BATTLE
        participant.finished_at = participant.finished_at or now
        participant.save(update_fields=["status", "finished_at", "updated_at"])
        joined.changed = True
    return joined


def set_ready(participant: BattleParticipant, ready: bool) -> bool:
    """Ready or not in prebattle; whether anything changed."""
    now = timezone.now()
    if ready and participant.status != BattleParticipant.STATUS_READY:
        participant.status = BattleParticipant.STATUS_READY
        participant.joined_at = participant.joined_at or now
        participant.ready_at = now
        participant.responded_at = now
        participant.save(update_fields=["status", "joined_at", "ready_at", "responded_at", "updated_at"])
        return True
    if not ready and participant.status == BattleParticipant.STATUS_READY:
        participant.status = (
            BattleParticipant.STATUS_JOINED_PREBATTLE if participant.joined_at else BattleParticipant.STATUS_ACCEPTED
        )
        participant.responded_at = now
        participant.save(update_fields=["status", "responded_at", "updated_at"])
        return True
    return False


def leave(battle: Battle, participant: BattleParticipant, actor_user) -> list[dict] | None:
    """The participant leaves before the battle starts (`cancel/`); None when he already had. Returns the events:
    the battle's cancel when fewer than two players are left (BUG-45: the cancelled row no longer counts)."""
    if participant.status == BattleParticipant.STATUS_CANCELED_PREBATTLE:
        return None
    now = timezone.now()
    participant.status = BattleParticipant.STATUS_CANCELED_PREBATTLE
    participant.canceled_at = now
    participant.responded_at = now
    participant.save(update_fields=["status", "canceled_at", "responded_at", "updated_at"])
    return settle_after_leaving(battle, actor_user=actor_user, mode="participants_left")


def start(battle: Battle, actor_user) -> list[dict]:
    """Start the battle once everyone still in is ready; each participant keeps his roster as it stands."""
    if not everyone_ready(battle.id):
        raise Refused("All participants must be ready before starting")
    now = timezone.now()
    battle.status = Battle.STATUS_ACTIVE
    battle.started_at = battle.started_at or now
    battle.save(update_fields=["status", "started_at", "updated_at"])
    rosters = battle_rosters_payload(battle.id)  # live now; the battle keeps this snapshot (BUG-73)
    participants = list(BattleParticipant.objects.select_for_update().filter(battle_id=battle.id))
    for entry in participants:
        if entry.status not in BattleParticipant.LEFT_STATUSES:  # a declined or cancelled row stays out
            entry.status = BattleParticipant.STATUS_IN_BATTLE
            entry.battle_joined_at = entry.battle_joined_at or now
        entry.roster_json = rosters.get(str(entry.user_id), {})
        entry.save(update_fields=["status", "battle_joined_at", "roster_json", "updated_at"])
    playing = [entry.user_id for entry in participants if entry.status == BattleParticipant.STATUS_IN_BATTLE]
    payload = {"participant_user_ids": playing}
    return [append_event(battle, BattleEvent.TYPE_BATTLE_STARTED, actor_user=actor_user, payload=payload)]
