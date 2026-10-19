"""Reported results: a battle played away from the app, reported by one player and approved by the others (BUG-46).

It ends when every other player approves it, recording wins and losses (none for "No winner") and each warband's
battle log, and is cancelled when one declines or the submitter withdraws it.
"""

from dataclasses import dataclass
from datetime import date, datetime, time

from django.utils import timezone
from django.utils.dateparse import parse_date

from apps.logs.utils import log_warband_event
from apps.notifications.models import Notification
from apps.notifications.utils import resolve_notification, resolve_notifications_for_reference
from apps.warbands.models import Warband

from ..models import Battle, BattleEvent, BattleParticipant
from ..serializers import display_name
from .errors import Refused, field_error
from .events import append_event, notify_result_updated, notify_user
from .lifecycle import battle_result_log, record_wins_and_losses, reset_trading_actions
from .setup import players_warbands, scenario_name


@dataclass
class ReportedResult:
    user_ids: list[int]
    warbands: dict[int, Warband]
    scenario: str
    battle_date: date
    raw_battle_date: str
    winner_ids: list[int]


def _user_ids(raw_ids, creator_id: int) -> list[int]:
    if not isinstance(raw_ids, list):
        raise Refused("participant_user_ids must be a list")
    user_ids: list[int] = []
    for entry in raw_ids:
        try:
            user_ids.append(int(entry))
        except (TypeError, ValueError):
            raise Refused("participant_user_ids must be integers") from None
    user_ids = sorted(set(user_ids + [creator_id]))
    if len(user_ids) < 2:
        raise Refused("At least two participants are required")
    return user_ids


def parse_battle_date(raw, *, field: str = "battle_date") -> date:
    """A played battle's date, "YYYY-MM-DD", today or earlier (a reported result's, or an edited record's)."""
    if not isinstance(raw, str):
        raise Refused(f"{field} is required")
    battle_date = parse_date(raw.strip())
    if battle_date is None:
        raise Refused(f"{field} must be a valid date")
    if battle_date > timezone.localdate():  # BATL-TEST-18
        raise field_error(field, f"{field} can't be in the future", "Pick today or an earlier date.")
    return battle_date


def start_of(day: date) -> datetime:
    """The battle's end as a reported result stores its date: midnight, local time."""
    return timezone.make_aware(datetime.combine(day, time.min), timezone.get_current_timezone())


def _winner_ids(raw, warbands: dict[int, Warband]) -> list[int]:
    if not isinstance(raw, list):
        raise Refused("winner_warband_ids must be a list")
    winner_ids: list[int] = []
    for entry in raw:
        try:
            winner_ids.append(int(entry))
        except (TypeError, ValueError):
            raise Refused("winner_warband_ids must be integers") from None
    winner_ids = list(dict.fromkeys(winner_ids))
    if not set(winner_ids).issubset({warband.id for warband in warbands.values()}):
        raise Refused("winner_warband_ids must belong to selected participants")
    return winner_ids


def reported_result(data, campaign_id: int, creator) -> ReportedResult:
    """What `report-result/` asks for, checked in the order its refusals have always come in ([] is "No winner")."""
    user_ids = _user_ids(data.get("participant_user_ids"), creator.id)
    warbands = players_warbands(campaign_id, user_ids)
    scenario = scenario_name(data.get("scenario"))
    battle_date = parse_battle_date(data.get("battle_date"))
    winner_ids = _winner_ids(data.get("winner_warband_ids"), warbands)
    raw_battle_date = data.get("battle_date").strip()
    return ReportedResult(user_ids, warbands, scenario, battle_date, raw_battle_date, winner_ids)


def _request_approval(battle: Battle, creator, result: ReportedResult, user_id: int) -> None:
    names = {warband.id: warband.name for warband in result.warbands.values()}
    payload = {
        "battle_id": battle.id,
        "campaign_id": battle.campaign_id,
        "status": battle.status,
        "scenario": battle.scenario,
        "battle_date": result.raw_battle_date,
        "winner_warband_ids": result.winner_ids,
        "winner_warband_names": [names[winner_id] for winner_id in result.winner_ids if winner_id in names],
        "created_by_user_id": creator.id,
        "created_by_user_label": display_name(creator),
    }
    notification, _ = Notification.objects.update_or_create(
        user_id=user_id,
        notification_type=Notification.TYPE_BATTLE_RESULT_REQUEST,
        reference_id=str(battle.id),
        defaults={"campaign_id": battle.campaign_id, "payload": payload, "is_resolved": False, "resolved_at": None},
    )
    notify_user(user_id, "battle_result_request", {**payload, "notification_id": notification.id})


def create_reported_result(campaign_id: int, creator, result: ReportedResult) -> tuple[Battle, list[dict]]:
    """The reported result (the submitter has approved it) and a request to approve it for every other player."""
    ended_at = start_of(result.battle_date)
    battle = Battle.objects.create(
        campaign_id=campaign_id,
        created_by_user=creator,
        flow_type=Battle.FLOW_TYPE_REPORTED_RESULT,
        status=Battle.STATUS_REPORTED_RESULT_PENDING,
        scenario=result.scenario,
        ended_at=ended_at,
        winner_warband_ids_json=result.winner_ids,
        state_version=1,
    )
    payload = {
        "mode": "reported_result",
        "participant_user_ids": result.user_ids,
        "winner_warband_ids": result.winner_ids,
        "scenario": result.scenario,
        "battle_date": result.raw_battle_date,
    }
    events = [append_event(battle, BattleEvent.TYPE_BATTLE_CREATED, actor_user=creator, payload=payload)]
    now = timezone.now()
    approved, pending = (
        BattleParticipant.STATUS_REPORTED_RESULT_APPROVED,
        BattleParticipant.STATUS_REPORTED_RESULT_PENDING,
    )
    BattleParticipant.objects.bulk_create(
        BattleParticipant(
            battle=battle,
            user_id=user_id,
            warband=result.warbands[user_id],
            invited_by_user=creator,
            status=approved if user_id == creator.id else pending,
            invited_at=now,
            responded_at=now if user_id == creator.id else None,
            confirmed_at=now if user_id == creator.id else None,
        )
        for user_id in result.user_ids
    )
    for user_id in result.user_ids:
        if user_id != creator.id:
            _request_approval(battle, creator, result, user_id)
    return battle, events


def everyone_approved(battle_id: int) -> bool:
    participants = BattleParticipant.objects.filter(battle_id=battle_id)
    return (
        participants.exists()
        and not participants.exclude(status=BattleParticipant.STATUS_REPORTED_RESULT_APPROVED).exists()
    )


def commit_reported_result(battle: Battle) -> None:
    participants = list(
        BattleParticipant.objects.select_related("warband")
        .filter(battle_id=battle.id)
        .exclude(status=BattleParticipant.STATUS_REPORTED_RESULT_DECLINED)
        .order_by("id")
    )
    record_wins_and_losses(battle)  # none when nobody won (decision 8)
    for participant in participants:
        log_warband_event(participant.warband_id, "battle", "complete", battle_result_log(battle, participant))


def _player_ids(battle: Battle) -> list[int]:
    return list(BattleParticipant.objects.filter(battle_id=battle.id).values_list("user_id", flat=True))


def approve(battle: Battle, participant: BattleParticipant) -> None:
    """The participant approves; the last approval ends the battle (wins, losses, logs, trading actions)."""
    now = timezone.now()
    if participant.status != BattleParticipant.STATUS_REPORTED_RESULT_APPROVED:
        participant.status = BattleParticipant.STATUS_REPORTED_RESULT_APPROVED
        participant.responded_at = now
        participant.confirmed_at = now
        participant.save(update_fields=["status", "responded_at", "confirmed_at", "updated_at"])
    resolve_notification(participant.user_id, Notification.TYPE_BATTLE_RESULT_REQUEST, str(battle.id))
    if everyone_approved(battle.id):
        commit_reported_result(battle)
        battle.status = Battle.STATUS_ENDED
        battle.ended_at = battle.ended_at or now
        battle.save(update_fields=["status", "ended_at", "updated_at"])
        reset_trading_actions(battle, only_if_most_recent=True)
    notify_result_updated(battle, _player_ids(battle))


def decline(battle: Battle, participant: BattleParticipant) -> None:
    """The participant declines: the reported result is cancelled for everyone."""
    now = timezone.now()
    participant.status = BattleParticipant.STATUS_REPORTED_RESULT_DECLINED
    participant.responded_at = now
    participant.save(update_fields=["status", "responded_at", "updated_at"])
    battle.status = Battle.STATUS_CANCELED
    battle.ended_at = battle.ended_at or now
    battle.save(update_fields=["status", "ended_at", "updated_at"])
    resolve_notifications_for_reference(Notification.TYPE_BATTLE_RESULT_REQUEST, str(battle.id))
    notify_result_updated(battle, _player_ids(battle))
