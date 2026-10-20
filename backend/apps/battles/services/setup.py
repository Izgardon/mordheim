"""Setting a battle up: create it and invite the players, then join, ready, leave and start.

Busy players (already in an unfinished battle) are warned about, never refused (decision 1, BATL-TWEAK-01). Any
participant still in starts once everyone is ready (decision 4); `start/` stores each roster as it stands (BUG-73).
"""

import logging
from dataclasses import dataclass

from django.utils import timezone

from apps.campaigns.models import CampaignMembership
from apps.notifications.models import Notification
from apps.users.names import display_name
from apps.warbands.models import Warband

from ..models import Battle, BattleEvent, BattleParticipant
from .errors import Refused
from .events import append_event, notify_user
from .timing import invite_deadline
from .unfinished import BUSY_BATTLE_STATUSES, BUSY_PARTICIPANT_STATUSES, page_for

logger = logging.getLogger(__name__)


def busy_participations(campaign_id: int, user_ids):
    """The players' places in the campaign's unfinished battles (decision 1: they warn, never refuse)."""
    return BattleParticipant.objects.filter(
        user_id__in=user_ids,
        battle__campaign_id=campaign_id,
        battle__flow_type=Battle.FLOW_TYPE_NORMAL,
        battle__status__in=BUSY_BATTLE_STATUSES,
        status__in=BUSY_PARTICIPANT_STATUSES,
    )


def busy_player_warnings(campaign_id: int, user_ids: list[int], creator_id: int) -> list[dict]:
    """One warning per player already in an unfinished battle of the campaign (the most recent one): decision 1
    warns and allows (BATL-TWEAK-01); the creator is told about his own (BATL-NEW-01)."""
    busy = (
        busy_participations(campaign_id, user_ids)
        .select_related("user", "battle")
        .order_by("user__first_name", "user__email", "-battle__created_at")
    )
    warnings: dict[int, dict] = {}
    for entry in busy:
        if entry.user_id in warnings:
            continue
        battle = entry.battle
        where = f"#{battle.id}, {battle.status}"
        message = (
            f"You already have an unfinished battle ({where})."
            if entry.user_id == creator_id
            else f"{display_name(entry.user)} is already in an unfinished battle ({where})."
        )
        warnings[entry.user_id] = {
            "code": "player_busy",
            "message": message,
            "user_id": entry.user_id,
            "battle_id": battle.id,
            "battle_status": battle.status,
            "last_activity_at": battle.last_activity_at.isoformat(),
            "page": page_for(battle, entry),  # where to go to finish it (BATL-NEW-01)
        }
    return list(warnings.values())


def participant_user_ids(raw_ids, campaign_id: int, creator_id: int) -> list[int]:
    """The players to invite (everyone in the campaign when not given) plus the creator; Refused otherwise."""
    if raw_ids is None:
        user_ids = list(CampaignMembership.objects.filter(campaign_id=campaign_id).values_list("user_id", flat=True))
    elif isinstance(raw_ids, list):
        user_ids = []
        for entry in raw_ids:
            try:
                user_ids.append(int(entry))
            except (TypeError, ValueError):
                raise Refused("participant_user_ids must be integers") from None
    else:
        raise Refused("participant_user_ids must be a list")
    return sorted(set(user_ids + [creator_id]))


def players_warbands(campaign_id: int, user_ids: list[int]) -> dict[int, Warband]:
    """Each player's warband in the campaign; Refused when one isn't a member or has none."""
    members = set(
        CampaignMembership.objects.filter(campaign_id=campaign_id, user_id__in=user_ids).values_list(
            "user_id", flat=True
        )
    )
    if members != set(user_ids):
        raise Refused("One or more participants are not in this campaign")
    warbands = {
        warband.user_id: warband
        for warband in Warband.objects.filter(campaign_id=campaign_id, user_id__in=user_ids).only(
            "id", "name", "user_id"
        )
    }
    if any(user_id not in warbands for user_id in user_ids):
        raise Refused("All participants need a warband")
    return warbands


def scenario_name(raw_scenario) -> str:
    if not isinstance(raw_scenario, str):
        raise Refused("scenario is required")
    scenario = raw_scenario.strip()
    if not scenario:
        raise Refused("scenario is required")
    if len(scenario) > 120:
        raise Refused("scenario must be at most 120 characters")
    return scenario


def participant_ratings(raw, user_ids: list[int]) -> dict[int, int | None]:
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise Refused("participant_ratings must be an object")
    ratings: dict[int, int | None] = {}
    for user_id in user_ids:
        raw_rating = raw.get(str(user_id))
        if raw_rating is None:
            raw_rating = raw.get(user_id)
        if raw_rating in (None, ""):
            ratings[user_id] = None
            continue
        try:
            rating = int(raw_rating)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            raise Refused(f"Invalid rating for user {user_id}") from None
        if rating < 0:
            raise Refused(f"Rating must be zero or greater for user {user_id}")
        ratings[user_id] = rating
    return ratings


@dataclass
class NewBattle:
    scenario: str
    scenario_link: str | None
    user_ids: list[int]
    warbands: dict[int, Warband]
    ratings: dict[int, int | None]
    warnings: list[dict]


def new_battle(data, campaign_id: int, creator) -> NewBattle:
    """What `POST battles/` asks for, checked in the order its refusals have always come in."""
    scenario = scenario_name(data.get("scenario"))
    user_ids = participant_user_ids(data.get("participant_user_ids"), campaign_id, creator.id)
    warbands = players_warbands(campaign_id, user_ids)
    warnings = busy_player_warnings(campaign_id, user_ids, creator.id)
    raw_link = data.get("scenario_link")
    scenario_link = (raw_link.strip() if isinstance(raw_link, str) else None) or None
    ratings = participant_ratings(data.get("participant_ratings", {}), user_ids)
    return NewBattle(scenario, scenario_link, user_ids, warbands, ratings, warnings)


def _invite(battle: Battle, creator, user_id: int) -> None:
    payload = {
        "battle_id": battle.id,
        "campaign_id": battle.campaign_id,
        "status": battle.status,
        "scenario": battle.scenario,
        "battle_date": battle.created_at.strftime("%Y-%m-%d"),
        "created_by_user_id": creator.id,
        "created_by_user_label": display_name(creator),
    }
    logger.info("Creating battle invite notification battle_id=%s recipient_user_id=%s", battle.id, user_id)
    notification, _ = Notification.objects.update_or_create(
        user_id=user_id,
        notification_type=Notification.TYPE_BATTLE_INVITE,
        reference_id=str(battle.id),
        defaults={"campaign_id": battle.campaign_id, "payload": payload, "is_resolved": False, "resolved_at": None},
    )
    logger.info(
        "Battle invite notification saved battle_id=%s recipient_user_id=%s notification_id=%s",
        battle.id,
        user_id,
        notification.id,
    )
    notify_user(user_id, "battle_invite", {**payload, "notification_id": notification.id})
    logger.info(
        "Battle invite realtime notification queued battle_id=%s recipient_user_id=%s notification_id=%s",
        battle.id,
        user_id,
        notification.id,
    )


def create_battle(campaign_id: int, creator, request: NewBattle) -> tuple[Battle, list[dict]]:
    """The battle, its players (the creator has accepted) and their invitations; 72 hours to answer."""
    battle = Battle.objects.create(
        campaign_id=campaign_id,
        created_by_user=creator,
        flow_type=Battle.FLOW_TYPE_NORMAL,
        status=Battle.STATUS_INVITING,
        scenario=request.scenario,
        scenario_link=request.scenario_link,
        state_version=1,
        closes_at=invite_deadline(),  # 72 hours to answer (decision 2)
    )
    logger.info("Battle row created battle_id=%s campaign_id=%s", battle.id, campaign_id)
    payload = {"participant_user_ids": request.user_ids, "scenario": request.scenario}
    events = [append_event(battle, BattleEvent.TYPE_BATTLE_CREATED, actor_user=creator, payload=payload)]
    now = timezone.now()
    participants = [
        BattleParticipant(
            battle=battle,
            user_id=user_id,
            warband=request.warbands[user_id],
            invited_by_user=creator,
            status=BattleParticipant.STATUS_ACCEPTED if user_id == creator.id else BattleParticipant.STATUS_INVITED,
            invited_at=now,
            responded_at=now if user_id == creator.id else None,
            declared_rating=request.ratings.get(user_id),
        )
        for user_id in request.user_ids
    ]
    BattleParticipant.objects.bulk_create(participants)
    logger.info("Battle participants created battle_id=%s participant_count=%s", battle.id, len(participants))
    for user_id in request.user_ids:
        if user_id != creator.id:
            _invite(battle, creator, user_id)
    return battle, events
