"""How battles, participants and events are answered: the snapshot every battle response carries.

A snapshot is `{"battle": ..., "participants": [...]}`; reads and writes add the events they return. The participant
shape depends on the page asking (`?view=`): `active` is the lightest, `full` has everything.
"""

from django.db.models import Prefetch, prefetch_related_objects

from apps.realtime.services import get_battle_channel_name

from .models import Battle, BattleEvent, BattleParticipant
from .services.timing import is_overdue

PARTICIPANT_VIEWS = ("full", "prebattle", "active", "postbattle")


def display_name(user) -> str:
    first_name = getattr(user, "first_name", None)
    if first_name and str(first_name).strip():
        return str(first_name).strip()
    return str(user.get_username())


def _iso(value):
    return value.isoformat() if value else None


def serialize_battle(battle: Battle) -> dict:
    return {
        "id": battle.id,
        "campaign_id": battle.campaign_id,
        "created_by_user_id": battle.created_by_user_id,
        "flow_type": battle.flow_type,
        "status": battle.status,
        "scenario": battle.scenario,
        "scenario_link": battle.scenario_link,
        "winner_warband_ids_json": battle.winner_warband_ids_json or [],
        "created_at": battle.created_at.isoformat(),
        "updated_at": battle.updated_at.isoformat(),
        "started_at": _iso(battle.started_at),
        "ended_at": _iso(battle.ended_at),
        "post_processed_at": _iso(battle.post_processed_at),
        "channel": get_battle_channel_name(battle.id),
        "state_version": battle.state_version,
        "last_activity_at": battle.last_activity_at.isoformat(),
        "closes_at": _iso(battle.closes_at),
        "overdue": is_overdue(battle),
    }


def _timeline(participant: BattleParticipant) -> dict:
    return {
        "invited_by_user_id": participant.invited_by_user_id,
        "invited_at": _iso(participant.invited_at),
        "responded_at": _iso(participant.responded_at),
        "joined_at": _iso(participant.joined_at),
        "ready_at": _iso(participant.ready_at),
        "canceled_at": _iso(participant.canceled_at),
        "battle_joined_at": _iso(participant.battle_joined_at),
        "finished_at": _iso(participant.finished_at),
        "confirmed_at": _iso(participant.confirmed_at),
        "skipped_postbattle": participant.skipped_postbattle,
    }


def serialize_participant(participant: BattleParticipant, participant_view: str = "full") -> dict:
    payload = {
        "id": participant.id,
        "battle_id": participant.battle_id,
        "status": participant.status,
        "connection_state": participant.connection_state,
        "last_event_id": participant.last_event_id,
        "last_seen_at": _iso(participant.last_seen_at),
        "selected_unit_keys_json": participant.selected_unit_keys_json or [],
        "unit_information_json": participant.unit_information_json or {},
        "custom_units_json": participant.custom_units_json or [],
        "battle_notes": participant.battle_notes or "",
        "user": {"id": participant.user_id, "label": display_name(participant.user)},
        "warband": {"id": participant.warband_id, "name": participant.warband.name},
    }
    if participant_view == "active":
        return payload
    if participant_view in {"full", "prebattle", "postbattle"}:
        payload.update(_timeline(participant))
    if participant_view in {"full", "prebattle"}:
        payload["declared_rating"] = participant.declared_rating
    if participant_view in {"full", "postbattle"}:
        payload["postbattle_json"] = participant.postbattle_json or {}
    return payload


def serialize_event(event: BattleEvent) -> dict:
    return {
        "id": event.id,
        "battle_id": event.battle_id,
        "type": event.type,
        "actor_user_id": event.actor_user_id,
        "payload_json": event.payload_json or {},
        "created_at": event.created_at.isoformat(),
        "voided_at": _iso(event.voided_at),
    }


def snapshot_participants():
    """Every participant as a snapshot shows them: with the user and warband it reads, without the roster."""
    return BattleParticipant.objects.select_related("user", "warband").defer("roster_json").order_by("id")


def participants_prefetch() -> Prefetch:
    """Prefetch everything serialize_participant reads, so snapshots cost no extra queries."""
    return Prefetch("participants", queryset=snapshot_participants())


def snapshot(battle: Battle, participants, participant_view: str = "full") -> dict:
    return {
        "battle": serialize_battle(battle),
        "participants": [serialize_participant(participant, participant_view) for participant in participants],
    }


def snapshot_from_battle(battle: Battle, participant_view: str = "full") -> dict:
    """Snapshot a battle loaded with participants_prefetch()."""
    return snapshot(battle, battle.participants.all(), participant_view)


def battle_snapshot(battle_id: int, participant_view: str = "full") -> dict:
    battle = Battle.objects.filter(id=battle_id).prefetch_related(participants_prefetch()).first()
    if battle is None:
        return {"battle": None, "participants": []}
    return snapshot_from_battle(battle, participant_view)


def battle_state_payload(battle: Battle, since_event_id: int, participant_view: str = "full") -> dict:
    """State for an already-loaded battle: participants and new events, without re-reading the battle."""
    prefetch_related_objects([battle], participants_prefetch())
    payload = snapshot_from_battle(battle, participant_view)
    events = BattleEvent.objects.filter(battle_id=battle.id, id__gt=since_event_id).order_by("id")
    payload["events"] = [serialize_event(event) for event in events]
    return payload
