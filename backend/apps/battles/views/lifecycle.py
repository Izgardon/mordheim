import logging
from datetime import datetime, time

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import CampaignMembership
from apps.campaigns.permissions import get_membership
from apps.core.throttling import BATTLE_WRITE_THROTTLE_CLASSES, MethodScopedThrottleMixin
from apps.notifications.models import Notification
from apps.notifications.utils import resolve_notification, resolve_notifications_for_reference
from apps.warbands.models import Warband

from ..models import Battle, BattleEvent, BattleParticipant
from ..services.broadcast import ALL, bump_state_version
from ..services.errors import BattleError, field_error
from ..services.timing import invite_deadline, record_activity
from ..services.unit_information import apply_patch, apply_whole_map, is_empty
from .shared import (
    _all_participants_accepted,
    _all_participants_canceled_prebattle,
    _all_participants_ready,
    _all_reported_result_participants_approved,
    _append_battle_event,
    _battle_rosters_payload,
    _battle_state_payload,
    _broadcast_response,
    _cancel_battle_for_all_participants,
    _commit_reported_result_battle,
    _display_name,
    _get_user_battle_participant,
    _mark_participant_seen,
    _normalize_battle_notes,
    _normalize_custom_units,
    _normalize_unit_information,
    _normalize_unit_keys,
    _notify_user,
    _participants_prefetch,
    _reset_trading_actions_for_battle_participants,
    _response_with_snapshot,
    _snapshot_from_battle,
)

logger = logging.getLogger(__name__)

_BUSY_BATTLE_STATUSES = (
    Battle.STATUS_INVITING,
    Battle.STATUS_PREBATTLE,
    Battle.STATUS_ACTIVE,
    Battle.STATUS_POSTBATTLE,
)
_BUSY_PARTICIPANT_STATUSES = (
    BattleParticipant.STATUS_INVITED,
    BattleParticipant.STATUS_ACCEPTED,
    BattleParticipant.STATUS_JOINED_PREBATTLE,
    BattleParticipant.STATUS_READY,
    BattleParticipant.STATUS_IN_BATTLE,
    BattleParticipant.STATUS_FINISHED_BATTLE,
)


def _busy_player_warnings(campaign_id: int, user_ids: list[int], creator_id: int) -> list[dict]:
    """One warning per player already in an unfinished battle of the campaign (the most recent one): decision 1
    warns and allows (BATL-TWEAK-01); the creator is told about his own (BATL-NEW-01)."""
    busy = (
        BattleParticipant.objects.filter(
            user_id__in=user_ids,
            battle__campaign_id=campaign_id,
            battle__flow_type=Battle.FLOW_TYPE_NORMAL,
            battle__status__in=_BUSY_BATTLE_STATUSES,
            status__in=_BUSY_PARTICIPANT_STATUSES,
        )
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
            else f"{_display_name(entry.user)} is already in an unfinished battle ({where})."
        )
        warnings[entry.user_id] = {
            "code": "player_busy",
            "message": message,
            "user_id": entry.user_id,
            "battle_id": battle.id,
            "battle_status": battle.status,
            "last_activity_at": battle.last_activity_at.isoformat(),
        }
    return list(warnings.values())


class CampaignBattleListCreateView(MethodScopedThrottleMixin, APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        battles = (
            Battle.objects.filter(campaign_id=campaign_id, participants__user=request.user)
            .distinct()
            .order_by("-created_at")
            .prefetch_related(_participants_prefetch())
        )
        # ?open=1 skips finished history: callers looking for a resumable battle
        # don't need every battle the user has ever played.
        if request.query_params.get("open") in {"1", "true"}:
            battles = battles.exclude(status__in=(Battle.STATUS_ENDED, Battle.STATUS_CANCELED))
        return Response([_snapshot_from_battle(battle) for battle in battles])

    def post(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        raw_scenario = request.data.get("scenario")
        if not isinstance(raw_scenario, str):
            return Response({"detail": "scenario is required"}, status=400)
        scenario = raw_scenario.strip()
        if not scenario:
            return Response({"detail": "scenario is required"}, status=400)
        if len(scenario) > 120:
            return Response({"detail": "scenario must be at most 120 characters"}, status=400)

        raw_ids = request.data.get("participant_user_ids")
        if raw_ids is None:
            participant_user_ids = list(
                CampaignMembership.objects.filter(campaign_id=campaign_id).values_list("user_id", flat=True)
            )
        elif isinstance(raw_ids, list):
            participant_user_ids = []
            for entry in raw_ids:
                try:
                    participant_user_ids.append(int(entry))
                except (TypeError, ValueError):
                    return Response({"detail": "participant_user_ids must be integers"}, status=400)
        else:
            return Response({"detail": "participant_user_ids must be a list"}, status=400)

        participant_user_ids = sorted(set(participant_user_ids + [request.user.id]))
        campaign_user_ids = set(
            CampaignMembership.objects.filter(campaign_id=campaign_id, user_id__in=participant_user_ids).values_list(
                "user_id", flat=True
            )
        )
        if campaign_user_ids != set(participant_user_ids):
            return Response({"detail": "One or more participants are not in this campaign"}, status=400)

        warbands = {
            warband.user_id: warband
            for warband in Warband.objects.filter(campaign_id=campaign_id, user_id__in=participant_user_ids).only(
                "id", "name", "user_id"
            )
        }
        missing_warbands = [user_id for user_id in participant_user_ids if user_id not in warbands]
        if missing_warbands:
            return Response({"detail": "All participants need a warband"}, status=400)

        warnings = _busy_player_warnings(campaign_id, participant_user_ids, request.user.id)

        raw_scenario_link = request.data.get("scenario_link")
        scenario_link = raw_scenario_link.strip() if isinstance(raw_scenario_link, str) else None
        if not scenario_link:
            scenario_link = None

        participant_ratings_raw = request.data.get("participant_ratings", {})
        if participant_ratings_raw is None:
            participant_ratings_raw = {}
        if not isinstance(participant_ratings_raw, dict):
            return Response({"detail": "participant_ratings must be an object"}, status=400)
        participant_ratings: dict[int, int | None] = {}
        for user_id in participant_user_ids:
            raw_rating = participant_ratings_raw.get(str(user_id))
            if raw_rating is None:
                raw_rating = participant_ratings_raw.get(user_id)
            if raw_rating in (None, ""):
                participant_ratings[user_id] = None
                continue
            try:
                parsed_rating = int(raw_rating)  # type: ignore[arg-type]
            except (TypeError, ValueError):
                return Response({"detail": f"Invalid rating for user {user_id}"}, status=400)
            if parsed_rating < 0:
                return Response(
                    {"detail": f"Rating must be zero or greater for user {user_id}"},
                    status=400,
                )
            participant_ratings[user_id] = parsed_rating

        logger.info(
            "Battle create requested campaign_id=%s user_id=%s participants=%s ratings=%s scenario=%r scenario_link=%r",
            campaign_id,
            request.user.id,
            participant_user_ids,
            participant_ratings,
            scenario,
            scenario_link,
        )

        events: list[dict] = []
        try:
            with transaction.atomic():
                battle = Battle.objects.create(
                    campaign_id=campaign_id,
                    created_by_user=request.user,
                    flow_type=Battle.FLOW_TYPE_NORMAL,
                    status=Battle.STATUS_INVITING,
                    scenario=scenario,
                    scenario_link=scenario_link,
                    state_version=1,
                    closes_at=invite_deadline(),  # 72 hours to answer (decision 2)
                )
                logger.info("Battle row created battle_id=%s campaign_id=%s", battle.id, campaign_id)
                events.append(
                    _append_battle_event(
                        battle,
                        BattleEvent.TYPE_BATTLE_CREATED,
                        actor_user=request.user,
                        payload={
                            "participant_user_ids": participant_user_ids,
                            "scenario": scenario,
                        },
                    )
                )

                now = timezone.now()
                participants = []
                for user_id in participant_user_ids:
                    is_creator = user_id == request.user.id
                    participants.append(
                        BattleParticipant(
                            battle=battle,
                            user_id=user_id,
                            warband=warbands[user_id],
                            invited_by_user=request.user,
                            status=(
                                BattleParticipant.STATUS_ACCEPTED if is_creator else BattleParticipant.STATUS_INVITED
                            ),
                            invited_at=now,
                            responded_at=now if is_creator else None,
                            declared_rating=participant_ratings.get(user_id),
                        )
                    )
                BattleParticipant.objects.bulk_create(participants)
                logger.info(
                    "Battle participants created battle_id=%s participant_count=%s",
                    battle.id,
                    len(participants),
                )

                for user_id in participant_user_ids:
                    if user_id != request.user.id:
                        notif_payload = {
                            "battle_id": battle.id,
                            "campaign_id": campaign_id,
                            "status": battle.status,
                            "scenario": scenario,
                            "battle_date": battle.created_at.strftime("%Y-%m-%d"),
                            "created_by_user_id": request.user.id,
                            "created_by_user_label": _display_name(request.user),
                        }
                        logger.info(
                            "Creating battle invite notification battle_id=%s recipient_user_id=%s",
                            battle.id,
                            user_id,
                        )
                        notif, _ = Notification.objects.update_or_create(
                            user_id=user_id,
                            notification_type=Notification.TYPE_BATTLE_INVITE,
                            reference_id=str(battle.id),
                            defaults={
                                "campaign_id": campaign_id,
                                "payload": notif_payload,
                                "is_resolved": False,
                                "resolved_at": None,
                            },
                        )
                        logger.info(
                            "Battle invite notification saved battle_id=%s recipient_user_id=%s notification_id=%s",
                            battle.id,
                            user_id,
                            notif.id,
                        )
                        _notify_user(
                            user_id,
                            "battle_invite",
                            {**notif_payload, "notification_id": notif.id},
                        )
                        logger.info(
                            "Battle invite realtime notification queued battle_id=%s recipient_user_id=%s notification_id=%s",
                            battle.id,
                            user_id,
                            notif.id,
                        )
        except Exception:
            logger.exception(
                "Battle create failed campaign_id=%s user_id=%s participants=%s",
                campaign_id,
                request.user.id,
                participant_user_ids,
            )
            raise

        return _broadcast_response(
            request,
            battle.id,
            events,
            battle.state_version,
            changed=ALL,
            response_status=status.HTTP_201_CREATED,
            warnings=warnings,
        )


class CampaignBattleReportedResultCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        raw_ids = request.data.get("participant_user_ids")
        if not isinstance(raw_ids, list):
            return Response({"detail": "participant_user_ids must be a list"}, status=400)

        participant_user_ids: list[int] = []
        for entry in raw_ids:
            try:
                participant_user_ids.append(int(entry))
            except (TypeError, ValueError):
                return Response({"detail": "participant_user_ids must be integers"}, status=400)

        participant_user_ids = sorted(set(participant_user_ids + [request.user.id]))
        if len(participant_user_ids) < 2:
            return Response({"detail": "At least two participants are required"}, status=400)

        campaign_user_ids = set(
            CampaignMembership.objects.filter(campaign_id=campaign_id, user_id__in=participant_user_ids).values_list(
                "user_id", flat=True
            )
        )
        if campaign_user_ids != set(participant_user_ids):
            return Response({"detail": "One or more participants are not in this campaign"}, status=400)

        warbands = {
            warband.user_id: warband
            for warband in Warband.objects.filter(campaign_id=campaign_id, user_id__in=participant_user_ids).only(
                "id", "name", "user_id"
            )
        }
        missing_warbands = [user_id for user_id in participant_user_ids if user_id not in warbands]
        if missing_warbands:
            return Response({"detail": "All participants need a warband"}, status=400)

        raw_scenario = request.data.get("scenario")
        if not isinstance(raw_scenario, str):
            return Response({"detail": "scenario is required"}, status=400)
        scenario = raw_scenario.strip()
        if not scenario:
            return Response({"detail": "scenario is required"}, status=400)
        if len(scenario) > 120:
            return Response({"detail": "scenario must be at most 120 characters"}, status=400)

        raw_battle_date = request.data.get("battle_date")
        if not isinstance(raw_battle_date, str):
            return Response({"detail": "battle_date is required"}, status=400)
        battle_date = parse_date(raw_battle_date.strip())
        if battle_date is None:
            return Response({"detail": "battle_date must be a valid date"}, status=400)
        if battle_date > timezone.localdate():  # BATL-TEST-18
            return field_error(
                "battle_date", "battle_date can't be in the future", "Pick today or an earlier date."
            ).response()
        ended_at = timezone.make_aware(
            datetime.combine(battle_date, time.min),
            timezone.get_current_timezone(),
        )

        raw_winner_ids = request.data.get("winner_warband_ids")
        if not isinstance(raw_winner_ids, list):
            return Response({"detail": "winner_warband_ids must be a list"}, status=400)
        winner_warband_ids: list[int] = []
        for entry in raw_winner_ids:
            try:
                winner_warband_ids.append(int(entry))
            except (TypeError, ValueError):
                return Response({"detail": "winner_warband_ids must be integers"}, status=400)
        winner_warband_ids = list(dict.fromkeys(winner_warband_ids))
        participant_warband_ids = {warband.id for warband in warbands.values()}
        if not set(winner_warband_ids).issubset(participant_warband_ids):
            return Response({"detail": "winner_warband_ids must belong to selected participants"}, status=400)

        events: list[dict] = []
        now = timezone.now()
        with transaction.atomic():
            battle = Battle.objects.create(
                campaign_id=campaign_id,
                created_by_user=request.user,
                flow_type=Battle.FLOW_TYPE_REPORTED_RESULT,
                status=Battle.STATUS_REPORTED_RESULT_PENDING,
                scenario=scenario,
                ended_at=ended_at,
                winner_warband_ids_json=winner_warband_ids,
                state_version=1,
            )
            events.append(
                _append_battle_event(
                    battle,
                    BattleEvent.TYPE_BATTLE_CREATED,
                    actor_user=request.user,
                    payload={
                        "mode": "reported_result",
                        "participant_user_ids": participant_user_ids,
                        "winner_warband_ids": winner_warband_ids,
                        "scenario": scenario,
                        "battle_date": raw_battle_date.strip(),
                    },
                )
            )

            participants = []
            for user_id in participant_user_ids:
                is_creator = user_id == request.user.id
                participants.append(
                    BattleParticipant(
                        battle=battle,
                        user_id=user_id,
                        warband=warbands[user_id],
                        invited_by_user=request.user,
                        status=(
                            BattleParticipant.STATUS_REPORTED_RESULT_APPROVED
                            if is_creator
                            else BattleParticipant.STATUS_REPORTED_RESULT_PENDING
                        ),
                        invited_at=now,
                        responded_at=now if is_creator else None,
                        confirmed_at=now if is_creator else None,
                    )
                )
            BattleParticipant.objects.bulk_create(participants)

            winner_name_by_id = {warband.id: warband.name for warband in warbands.values()}
            winner_names = [
                winner_name_by_id[winner_id] for winner_id in winner_warband_ids if winner_id in winner_name_by_id
            ]
            for user_id in participant_user_ids:
                if user_id == request.user.id:
                    continue
                notif_payload = {
                    "battle_id": battle.id,
                    "campaign_id": campaign_id,
                    "status": battle.status,
                    "scenario": battle.scenario,
                    "battle_date": raw_battle_date.strip(),
                    "winner_warband_ids": winner_warband_ids,
                    "winner_warband_names": winner_names,
                    "created_by_user_id": request.user.id,
                    "created_by_user_label": _display_name(request.user),
                }
                notif, _ = Notification.objects.update_or_create(
                    user_id=user_id,
                    notification_type=Notification.TYPE_BATTLE_RESULT_REQUEST,
                    reference_id=str(battle.id),
                    defaults={
                        "campaign_id": campaign_id,
                        "payload": notif_payload,
                        "is_resolved": False,
                        "resolved_at": None,
                    },
                )
                _notify_user(
                    user_id,
                    "battle_result_request",
                    {**notif_payload, "notification_id": notif.id},
                )

        return _broadcast_response(
            request, battle.id, events, battle.state_version, changed=ALL, response_status=status.HTTP_201_CREATED
        )


class CampaignBattleStateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id, battle_id):
        battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user)
        if not battle or not participant:
            return Response({"detail": "Not found"}, status=404)

        since_event_id = request.query_params.get("sinceEventId", "0")
        try:
            since_event_id_int = max(0, int(since_event_id))
        except (TypeError, ValueError):
            return Response({"detail": "Invalid sinceEventId"}, status=400)

        view = str(request.query_params.get("view", "full")).strip().lower() or "full"
        if view not in {"full", "prebattle", "active", "postbattle"}:
            return Response({"detail": "Invalid view"}, status=400)

        payload = _battle_state_payload(battle, since_event_id_int, participant_view=view)
        _mark_participant_seen(participant)
        return Response(payload)


class CampaignBattleRosterView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id, battle_id):
        battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user)
        if not battle or not participant:
            return Response({"detail": "Not found"}, status=404)

        _mark_participant_seen(participant)
        return Response(_battle_rosters_payload(battle.id))


def _unit_information_change(data, participant) -> dict | None:
    """The participant's unit information after a config save, or None when the save doesn't touch it: a patch, or
    an older client's whole map, merged into what is stored (services/unit_information.py, BUG-44)."""
    has_patch, has_whole_map = "unit_information_patch" in data, "unit_information_json" in data
    if has_patch and has_whole_map:
        raise ValueError("Send unit_information_patch or unit_information_json, not both")
    if not (has_patch or has_whole_map):
        return None
    stored = _normalize_unit_information(participant.unit_information_json)
    if has_patch:
        return apply_patch(stored, data.get("unit_information_patch"))
    return apply_whole_map(stored, data.get("unit_information_json"))


def _declared_rating(raw_value) -> int | None:
    """A whole number from 0 to 9999, or None; a field error otherwise (BUG-125: "x" answered int()'s message)."""
    if raw_value in ("", None):
        return None
    message = "Enter a whole number from 0 to 9999, or leave it empty."
    try:
        declared_rating = int(raw_value)
    except (TypeError, ValueError):
        raise field_error("declared_rating", "declared_rating must be a whole number", message) from None
    if declared_rating < 0 or declared_rating > 9999:
        raise field_error("declared_rating", "declared_rating must be between 0 and 9999", message)
    return declared_rating


def _without_notes(unit_information: dict) -> dict:
    stripped = {key: {**entry, "notes": ""} for key, entry in (unit_information or {}).items()}
    return {key: entry for key, entry in stripped.items() if not is_empty(entry)}


def _changes_others_see(participant, changes: dict) -> bool:
    """Whether a config save changes anything but notes (battle notes and unit notes are the player's own)."""
    for field, value in changes.items():
        before = getattr(participant, field)
        if field == "battle_notes" or before == value:
            continue
        if field == "unit_information_json" and _without_notes(before) == _without_notes(value):
            continue
        return True
    return False


def _config_changes(data, participant) -> dict:
    """The participant fields a config save sets: only those the request sends (ValueError when one is invalid)."""
    changes: dict = {}
    if "selected_unit_keys_json" in data:
        changes["selected_unit_keys_json"] = _normalize_unit_keys(data.get("selected_unit_keys_json"))
    unit_information = _unit_information_change(data, participant)
    if unit_information is not None:
        changes["unit_information_json"] = unit_information
    if "custom_units_json" in data:
        changes["custom_units_json"] = _normalize_custom_units(data.get("custom_units_json"))
    if "declared_rating" in data:
        changes["declared_rating"] = _declared_rating(data.get("declared_rating"))
    if "battle_notes" in data:
        changes["battle_notes"] = _normalize_battle_notes(data.get("battle_notes"))
    return changes


class CampaignBattleConfigView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.status not in (
                Battle.STATUS_PREBATTLE,
                Battle.STATUS_ACTIVE,
                Battle.STATUS_POSTBATTLE,
            ):
                return Response({"detail": "Battle configuration is locked"}, status=400)

            try:
                changes = _config_changes(request.data, participant)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=400)
            except BattleError as refused:
                return refused.response()

            shared_change = _changes_others_see(participant, changes)
            for field, value in changes.items():
                setattr(participant, field, value)
            participant.save(update_fields=[*changes, "updated_at"])
            if not shared_change:  # notes only (or nothing): nobody else needs it (PERF-34)
                record_activity(battle)
                return _response_with_snapshot(battle.id, events)
            version = bump_state_version(battle)
        return _broadcast_response(
            request, battle.id, events, version, changed=[participant.id], reason="participant_config_updated"
        )


class CampaignBattleJoinView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.flow_type != Battle.FLOW_TYPE_NORMAL:
                return Response({"detail": "Reported results cannot be joined"}, status=400)
            if battle.status in (Battle.STATUS_CANCELED, Battle.STATUS_ENDED):
                return Response({"detail": "Battle is closed"}, status=400)

            now = timezone.now()
            state_changed = False
            opened = False  # the last acceptance opened prebattle for everyone
            event_type = None

            if battle.status == Battle.STATUS_INVITING:
                if participant.status == BattleParticipant.STATUS_INVITED:
                    participant.status = BattleParticipant.STATUS_ACCEPTED
                    participant.responded_at = now
                    participant.save(update_fields=["status", "responded_at", "updated_at"])
                    state_changed = True

                if _all_participants_accepted(battle.id):
                    battle.status = Battle.STATUS_PREBATTLE
                    battle.closes_at = None  # no deadline before postbattle
                    battle.save(update_fields=["status", "closes_at", "updated_at"])
                    state_changed = opened = True
                    participant_entries = list(
                        BattleParticipant.objects.select_for_update().filter(battle_id=battle.id)
                    )
                    for entry in participant_entries:
                        if entry.status == BattleParticipant.STATUS_ACCEPTED:
                            entry.status = BattleParticipant.STATUS_JOINED_PREBATTLE
                            entry.joined_at = entry.joined_at or now
                            entry.save(update_fields=["status", "joined_at", "updated_at"])
                            state_changed = True

                    for user_id in [entry.user_id for entry in participant_entries]:
                        _notify_user(
                            user_id,
                            "battle_prebattle_opened",
                            {
                                "battle_id": battle.id,
                                "campaign_id": battle.campaign_id,
                                "status": battle.status,
                            },
                        )
                    resolve_notifications_for_reference(Notification.TYPE_BATTLE_INVITE, str(battle.id))
            elif battle.status == Battle.STATUS_PREBATTLE:
                if participant.status != BattleParticipant.STATUS_READY:
                    participant.status = BattleParticipant.STATUS_JOINED_PREBATTLE
                    participant.joined_at = participant.joined_at or now
                    participant.save(update_fields=["status", "joined_at", "updated_at"])
                    state_changed = True
            elif battle.status == Battle.STATUS_ACTIVE:
                if participant.status not in (
                    BattleParticipant.STATUS_FINISHED_BATTLE,
                    BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
                ):
                    if participant.status != BattleParticipant.STATUS_IN_BATTLE:
                        participant.status = BattleParticipant.STATUS_IN_BATTLE
                        participant.battle_joined_at = participant.battle_joined_at or now
                        participant.save(update_fields=["status", "battle_joined_at", "updated_at"])
                        event_type = BattleEvent.TYPE_PARTICIPANT_JOINED_BATTLE
            else:
                if participant.status != BattleParticipant.STATUS_CONFIRMED_POSTBATTLE:
                    participant.status = BattleParticipant.STATUS_FINISHED_BATTLE
                    participant.finished_at = participant.finished_at or now
                    participant.save(update_fields=["status", "finished_at", "updated_at"])
                    state_changed = True

            if event_type:
                event = _append_battle_event(
                    battle,
                    event_type,
                    actor_user=request.user,
                    payload={
                        "participant_user_id": request.user.id,
                        "participant_status": participant.status,
                    },
                )
                events.append(event)
            if not (state_changed or event_type):
                return _response_with_snapshot(battle.id, events)
            version = bump_state_version(battle)
            changed = ALL if battle.status == Battle.STATUS_PREBATTLE and opened else [participant.id]

        return _broadcast_response(
            request, battle.id, events, version, changed=changed, reason="participant_joined_or_updated"
        )


class CampaignBattleReportedResultApproveView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.flow_type != Battle.FLOW_TYPE_REPORTED_RESULT:
                return Response({"detail": "This battle is not a reported result"}, status=400)
            if battle.status == Battle.STATUS_CANCELED:
                return Response({"detail": "Reported result has already been canceled"}, status=400)
            if battle.status == Battle.STATUS_ENDED:
                return _response_with_snapshot(battle.id, events)

            if participant.status == BattleParticipant.STATUS_REPORTED_RESULT_DECLINED:
                return Response({"detail": "You already declined this reported result"}, status=400)

            now = timezone.now()
            if participant.status != BattleParticipant.STATUS_REPORTED_RESULT_APPROVED:
                participant.status = BattleParticipant.STATUS_REPORTED_RESULT_APPROVED
                participant.responded_at = now
                participant.confirmed_at = now
                participant.save(update_fields=["status", "responded_at", "confirmed_at", "updated_at"])

            resolve_notification(request.user.id, Notification.TYPE_BATTLE_RESULT_REQUEST, str(battle.id))

            if _all_reported_result_participants_approved(battle.id):
                _commit_reported_result_battle(battle)
                battle.status = Battle.STATUS_ENDED
                battle.ended_at = battle.ended_at or now
                battle.save(update_fields=["status", "ended_at", "updated_at"])
                _reset_trading_actions_for_battle_participants(
                    battle,
                    only_if_most_recent=True,
                )

            participant_entries = list(
                BattleParticipant.objects.filter(battle_id=battle.id).values_list("user_id", flat=True)
            )
            for user_id in participant_entries:
                _notify_user(
                    user_id,
                    "battle_result_updated",
                    {
                        "battle_id": battle.id,
                        "campaign_id": battle.campaign_id,
                        "status": battle.status,
                    },
                )
            version = bump_state_version(battle)

        return _broadcast_response(request, battle.id, events, version, changed=ALL, reason="reported_result_approved")


class CampaignBattleReportedResultDeclineView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.flow_type != Battle.FLOW_TYPE_REPORTED_RESULT:
                return Response({"detail": "This battle is not a reported result"}, status=400)
            if battle.status == Battle.STATUS_ENDED:
                return Response({"detail": "Reported result has already been committed"}, status=400)
            if battle.status == Battle.STATUS_CANCELED:
                return _response_with_snapshot(battle.id, events)

            now = timezone.now()
            participant.status = BattleParticipant.STATUS_REPORTED_RESULT_DECLINED
            participant.responded_at = now
            participant.save(update_fields=["status", "responded_at", "updated_at"])

            battle.status = Battle.STATUS_CANCELED
            battle.ended_at = battle.ended_at or now
            battle.save(update_fields=["status", "ended_at", "updated_at"])

            resolve_notifications_for_reference(Notification.TYPE_BATTLE_RESULT_REQUEST, str(battle.id))

            participant_entries = list(
                BattleParticipant.objects.filter(battle_id=battle.id).values_list("user_id", flat=True)
            )
            for user_id in participant_entries:
                _notify_user(
                    user_id,
                    "battle_result_updated",
                    {
                        "battle_id": battle.id,
                        "campaign_id": battle.campaign_id,
                        "status": battle.status,
                    },
                )
            version = bump_state_version(battle)

        return _broadcast_response(request, battle.id, events, version, changed=ALL, reason="reported_result_declined")


class CampaignBattleReadyView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        if "ready" not in request.data:
            return Response({"detail": "ready is required"}, status=400)

        ready_value = request.data.get("ready")
        if isinstance(ready_value, bool):
            ready = ready_value
        elif isinstance(ready_value, str):
            lowered = ready_value.strip().lower()
            if lowered in {"true", "1", "yes"}:
                ready = True
            elif lowered in {"false", "0", "no"}:
                ready = False
            else:
                return Response({"detail": "ready must be true or false"}, status=400)
        else:
            return Response({"detail": "ready must be true or false"}, status=400)

        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.flow_type != Battle.FLOW_TYPE_NORMAL:
                return Response({"detail": "Reported results do not use prebattle ready states"}, status=400)
            if battle.status == Battle.STATUS_INVITING:
                return Response(
                    {"detail": "Waiting for all participants to accept invitation"},
                    status=400,
                )
            if battle.status in (Battle.STATUS_ACTIVE, Battle.STATUS_POSTBATTLE, Battle.STATUS_ENDED):
                return Response({"detail": "Battle is no longer in prebattle"}, status=400)
            if battle.status == Battle.STATUS_CANCELED:
                return Response({"detail": "Battle is canceled"}, status=400)

            now = timezone.now()
            state_changed = False
            if ready:
                if participant.status != BattleParticipant.STATUS_READY:
                    if participant.status == BattleParticipant.STATUS_ACCEPTED:
                        participant.joined_at = participant.joined_at or now
                    participant.status = BattleParticipant.STATUS_READY
                    participant.joined_at = participant.joined_at or now
                    participant.ready_at = now
                    participant.responded_at = now
                    participant.save(
                        update_fields=[
                            "status",
                            "joined_at",
                            "ready_at",
                            "responded_at",
                            "updated_at",
                        ]
                    )
                    state_changed = True
            else:
                if participant.status == BattleParticipant.STATUS_READY:
                    participant.status = (
                        BattleParticipant.STATUS_JOINED_PREBATTLE
                        if participant.joined_at
                        else BattleParticipant.STATUS_ACCEPTED
                    )
                    participant.responded_at = now
                    participant.save(update_fields=["status", "responded_at", "updated_at"])
                    state_changed = True

            if not state_changed:
                return _response_with_snapshot(battle.id, events)
            version = bump_state_version(battle)

        return _broadcast_response(
            request, battle.id, events, version, changed=[participant.id], reason="participant_ready_changed"
        )


class CampaignBattleCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.flow_type != Battle.FLOW_TYPE_NORMAL:
                return Response({"detail": "Reported results cannot be canceled this way"}, status=400)
            if battle.status in (Battle.STATUS_ACTIVE, Battle.STATUS_POSTBATTLE, Battle.STATUS_ENDED):
                return Response({"detail": "Cannot cancel during or after battle"}, status=400)
            if battle.status == Battle.STATUS_CANCELED:
                return Response({"detail": "Battle is already canceled"}, status=400)

            state_changed = False
            if participant.status != BattleParticipant.STATUS_CANCELED_PREBATTLE:
                now = timezone.now()
                participant.status = BattleParticipant.STATUS_CANCELED_PREBATTLE
                participant.canceled_at = now
                participant.responded_at = now
                participant.save(update_fields=["status", "canceled_at", "responded_at", "updated_at"])
                state_changed = True

            if _all_participants_canceled_prebattle(battle.id):
                battle.status = Battle.STATUS_CANCELED
                battle.ended_at = timezone.now()
                battle.save(update_fields=["status", "ended_at", "updated_at"])
                state_changed = True
                events.append(
                    _append_battle_event(
                        battle,
                        BattleEvent.TYPE_BATTLE_CANCELED,
                        actor_user=request.user,
                        payload={},
                    )
                )

            if not state_changed:
                return _response_with_snapshot(battle.id, events)
            version = bump_state_version(battle)
            changed = ALL if events else [participant.id]

        return _broadcast_response(
            request, battle.id, events, version, changed=changed, reason="participant_canceled_prebattle"
        )


class CampaignBattleCreatorCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.created_by_user_id != request.user.id:
                return Response({"detail": "Only the battle creator can cancel this battle"}, status=403)
            if battle.flow_type != Battle.FLOW_TYPE_NORMAL:
                return Response({"detail": "Reported results cannot be canceled this way"}, status=400)
            if battle.status == Battle.STATUS_CANCELED:
                return _response_with_snapshot(battle.id, events)
            if battle.status == Battle.STATUS_ENDED:
                return Response({"detail": "Battle is already ended"}, status=400)
            if battle.status == Battle.STATUS_POSTBATTLE:  # decision 3, BUG-09
                return Response(
                    {"detail": "Postbattle can't be cancelled; close it instead", "code": "use_close_postbattle"},
                    status=400,
                )

            event = _cancel_battle_for_all_participants(
                battle,
                actor_user=request.user,
                mode="creator",
            )
            events.append(event)
            version = bump_state_version(battle)

        return _broadcast_response(request, battle.id, events, version, changed=ALL)


class CampaignBattleStartView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.created_by_user_id != request.user.id:
                return Response({"detail": "Only the battle creator can start this battle"}, status=403)
            if battle.flow_type != Battle.FLOW_TYPE_NORMAL:
                return Response({"detail": "Reported results do not have an active battle phase"}, status=400)
            if battle.status in (Battle.STATUS_ACTIVE, Battle.STATUS_POSTBATTLE, Battle.STATUS_ENDED):
                return Response({"detail": "Battle already started"}, status=400)
            if battle.status == Battle.STATUS_INVITING:
                return Response(
                    {"detail": "Waiting for all participants to accept invitation"},
                    status=400,
                )
            if battle.status == Battle.STATUS_CANCELED:
                return Response({"detail": "Battle is canceled"}, status=400)
            if not _all_participants_ready(battle.id):
                return Response({"detail": "All participants must be ready before starting"}, status=400)

            now = timezone.now()
            battle.status = Battle.STATUS_ACTIVE
            battle.started_at = battle.started_at or now
            battle.save(update_fields=["status", "started_at", "updated_at"])

            rosters = _battle_rosters_payload(battle.id)  # live now; the battle keeps this snapshot (BUG-73)
            participants = list(BattleParticipant.objects.select_for_update().filter(battle_id=battle.id))
            for entry in participants:
                entry.status = BattleParticipant.STATUS_IN_BATTLE
                entry.battle_joined_at = entry.battle_joined_at or now
                entry.roster_json = rosters.get(str(entry.user_id), {})
                entry.save(update_fields=["status", "battle_joined_at", "roster_json", "updated_at"])

            event = _append_battle_event(
                battle,
                BattleEvent.TYPE_BATTLE_STARTED,
                actor_user=request.user,
                payload={"participant_user_ids": [entry.user_id for entry in participants]},
            )
            events.append(event)
            version = bump_state_version(battle)

        return _broadcast_response(request, battle.id, events, version, changed=ALL)
