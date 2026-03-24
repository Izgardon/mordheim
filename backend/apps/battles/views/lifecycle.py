from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import CampaignMembership
from apps.campaigns.permissions import get_membership
from apps.warbands.models import Warband

from ..models import Battle, BattleEvent, BattleParticipant
from .shared import (
    _all_participants_accepted,
    _all_participants_canceled_prebattle,
    _all_participants_ready,
    _all_reported_result_participants_approved,
    _append_battle_event,
    _battle_snapshot,
    _battle_state_payload,
    _commit_reported_result_battle,
    _display_name,
    _get_user_battle_participant,
    _normalize_custom_units,
    _normalize_stat_overrides,
    _normalize_unit_information,
    _normalize_unit_keys,
    _notify_battle_state_changed,
    _notify_user,
    _response_with_snapshot,
    _sync_unit_information_from_stat_overrides,
    _touch_participant,
)

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


class CampaignBattleListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, campaign_id):
        membership = get_membership(request.user, campaign_id)
        if not membership:
            return Response({"detail": "Not found"}, status=404)

        battles = (
            Battle.objects.filter(campaign_id=campaign_id, participants__user=request.user)
            .distinct()
            .order_by("-created_at")
        )
        payload = []
        for battle in battles:
            snapshot = _battle_snapshot(battle.id)
            payload.append(snapshot)
        return Response(payload)

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

        settings_json = request.data.get("settings_json", {})
        if settings_json is None:
            settings_json = {}
        if not isinstance(settings_json, dict):
            return Response({"detail": "settings_json must be an object"}, status=400)

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

        busy_participants = list(
            BattleParticipant.objects.filter(
                user_id__in=participant_user_ids,
                battle__campaign_id=campaign_id,
                battle__flow_type=Battle.FLOW_TYPE_NORMAL,
                battle__status__in=_BUSY_BATTLE_STATUSES,
                status__in=_BUSY_PARTICIPANT_STATUSES,
            )
            .select_related("user")
            .order_by("user__first_name", "user__email")
        )
        if busy_participants:
            busy_labels = []
            seen_user_ids = set()
            for entry in busy_participants:
                if entry.user_id in seen_user_ids:
                    continue
                seen_user_ids.add(entry.user_id)
                busy_labels.append(_display_name(entry.user))
            return Response(
                {
                    "detail": (
                        "One or more participants are already in another battle: "
                        + ", ".join(busy_labels)
                    )
                },
                status=400,
            )

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

        events: list[dict] = []
        with transaction.atomic():
            battle = Battle.objects.create(
                campaign_id=campaign_id,
                created_by_user=request.user,
                flow_type=Battle.FLOW_TYPE_NORMAL,
                status=Battle.STATUS_INVITING,
                scenario=scenario,
                settings_json=settings_json,
            )
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
                        status=(BattleParticipant.STATUS_ACCEPTED if is_creator else BattleParticipant.STATUS_INVITED),
                        invited_at=now,
                        responded_at=now if is_creator else None,
                        declared_rating=participant_ratings.get(user_id),
                    )
                )
            BattleParticipant.objects.bulk_create(participants)

            for user_id in participant_user_ids:
                if user_id != request.user.id:
                    _notify_user(
                        user_id,
                        "battle_invite",
                        {
                            "battle_id": battle.id,
                            "campaign_id": campaign_id,
                            "status": battle.status,
                            "scenario": scenario,
                            "created_by_user_id": request.user.id,
                            "created_by_user_label": _display_name(request.user),
                        },
                    )

        return _response_with_snapshot(battle.id, events, response_status=status.HTTP_201_CREATED)


class PendingReportedBattleResultRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        pending_entries = (
            BattleParticipant.objects.select_related("battle__created_by_user", "warband")
            .filter(
                user_id=request.user.id,
                status=BattleParticipant.STATUS_REPORTED_RESULT_PENDING,
                battle__flow_type=Battle.FLOW_TYPE_REPORTED_RESULT,
                battle__status=Battle.STATUS_REPORTED_RESULT_PENDING,
            )
            .order_by("-battle__created_at")
        )

        payload = []
        for entry in pending_entries:
            battle = entry.battle
            participants = list(
                BattleParticipant.objects.select_related("warband").filter(battle_id=battle.id).order_by("id")
            )
            winner_ids = set(battle.winner_warband_ids_json or [])
            winner_names = [participant.warband.name for participant in participants if participant.warband_id in winner_ids]
            payload.append(
                {
                    "battle_id": battle.id,
                    "campaign_id": battle.campaign_id,
                    "status": battle.status,
                    "scenario": battle.scenario,
                    "winner_warband_ids": battle.winner_warband_ids_json or [],
                    "winner_warband_names": winner_names,
                    "created_by_user_id": battle.created_by_user_id,
                    "created_by_user_label": _display_name(battle.created_by_user),
                    "created_at": battle.created_at.isoformat(),
                }
            )

        return Response(payload)


class CampaignBattleReportedResultCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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
        if not winner_warband_ids:
            return Response({"detail": "Select at least one winner"}, status=400)
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
                winner_warband_ids_json=winner_warband_ids,
                settings_json={},
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
            winner_names = [winner_name_by_id[winner_id] for winner_id in winner_warband_ids if winner_id in winner_name_by_id]
            for user_id in participant_user_ids:
                if user_id == request.user.id:
                    continue
                _notify_user(
                    user_id,
                    "battle_result_request",
                    {
                        "battle_id": battle.id,
                        "campaign_id": campaign_id,
                        "status": battle.status,
                        "scenario": battle.scenario,
                        "winner_warband_ids": winner_warband_ids,
                        "winner_warband_names": winner_names,
                        "created_by_user_id": request.user.id,
                        "created_by_user_label": _display_name(request.user),
                    },
                )

        return _response_with_snapshot(battle.id, events, response_status=status.HTTP_201_CREATED)


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

        payload = _battle_state_payload(battle.id, since_event_id_int)
        events = payload.get("events", [])
        last_event_id = events[-1]["id"] if events else None
        _touch_participant(participant, last_event_id=last_event_id)
        return Response(payload)


class CampaignBattleConfigView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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
                selected_unit_keys_raw = (
                    request.data.get("selected_unit_keys_json")
                    if "selected_unit_keys_json" in request.data
                    else participant.selected_unit_keys_json
                )
                stat_overrides_raw = (
                    request.data.get("stat_overrides_json")
                    if "stat_overrides_json" in request.data
                    else participant.stat_overrides_json
                )
                unit_information_raw = (
                    request.data.get("unit_information_json")
                    if "unit_information_json" in request.data
                    else participant.unit_information_json
                )
                custom_units_raw = (
                    request.data.get("custom_units_json")
                    if "custom_units_json" in request.data
                    else participant.custom_units_json
                )

                selected_unit_keys = _normalize_unit_keys(selected_unit_keys_raw)
                stat_overrides = _normalize_stat_overrides(stat_overrides_raw)
                unit_information = _normalize_unit_information(unit_information_raw)
                custom_units = _normalize_custom_units(custom_units_raw)
                unit_information = _sync_unit_information_from_stat_overrides(unit_information, stat_overrides)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=400)

            participant.selected_unit_keys_json = selected_unit_keys
            participant.stat_overrides_json = stat_overrides
            participant.unit_information_json = unit_information
            participant.custom_units_json = custom_units
            participant.save(
                update_fields=[
                    "selected_unit_keys_json",
                    "stat_overrides_json",
                    "unit_information_json",
                    "custom_units_json",
                    "updated_at",
                ]
            )
            _touch_participant(participant)
            _notify_battle_state_changed(
                battle,
                actor_user_id=request.user.id,
                reason="participant_config_updated",
            )
        return _response_with_snapshot(battle.id, events)


class CampaignBattleJoinView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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
            event_type = None

            if battle.status == Battle.STATUS_INVITING:
                if participant.status == BattleParticipant.STATUS_INVITED:
                    participant.status = BattleParticipant.STATUS_ACCEPTED
                    participant.responded_at = now
                    participant.save(update_fields=["status", "responded_at", "updated_at"])
                    state_changed = True

                if _all_participants_accepted(battle.id):
                    battle.status = Battle.STATUS_PREBATTLE
                    battle.save(update_fields=["status", "updated_at"])
                    state_changed = True
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

            last_event_id = None
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
                last_event_id = event["id"]
            elif events:
                last_event_id = events[-1]["id"]

            _touch_participant(participant, last_event_id=last_event_id)
            if state_changed and not event_type:
                _notify_battle_state_changed(
                    battle,
                    actor_user_id=request.user.id,
                    reason="participant_joined_or_updated",
                )

        return _response_with_snapshot(battle.id, events)


class CampaignBattleReportedResultApproveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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

            _touch_participant(participant)

            if _all_reported_result_participants_approved(battle.id):
                _commit_reported_result_battle(battle)
                battle.status = Battle.STATUS_ENDED
                battle.ended_at = battle.ended_at or now
                battle.save(update_fields=["status", "ended_at", "updated_at"])

            participant_entries = list(BattleParticipant.objects.filter(battle_id=battle.id).values_list("user_id", flat=True))
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

        return _response_with_snapshot(battle.id, events)


class CampaignBattleReportedResultDeclineView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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

            participant_entries = list(BattleParticipant.objects.filter(battle_id=battle.id).values_list("user_id", flat=True))
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

        return _response_with_snapshot(battle.id, events)


class CampaignBattleReadyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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

            _touch_participant(
                participant,
                last_event_id=events[-1]["id"] if events else participant.last_event_id,
            )
            if state_changed:
                _notify_battle_state_changed(
                    battle,
                    actor_user_id=request.user.id,
                    reason="participant_ready_changed",
                )

        return _response_with_snapshot(battle.id, events)


class CampaignBattleCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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

            _touch_participant(
                participant,
                last_event_id=events[-1]["id"] if events else participant.last_event_id,
            )
            if state_changed and not events:
                _notify_battle_state_changed(
                    battle,
                    actor_user_id=request.user.id,
                    reason="participant_canceled_prebattle",
                )

        return _response_with_snapshot(battle.id, events)


class CampaignBattleCreatorCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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

            now = timezone.now()
            battle.status = Battle.STATUS_CANCELED
            battle.ended_at = now
            battle.save(update_fields=["status", "ended_at", "updated_at"])

            participants = BattleParticipant.objects.select_for_update().filter(battle_id=battle.id)
            for entry in participants:
                if entry.status != BattleParticipant.STATUS_CANCELED_PREBATTLE:
                    entry.status = BattleParticipant.STATUS_CANCELED_PREBATTLE
                    entry.canceled_at = entry.canceled_at or now
                    entry.responded_at = entry.responded_at or now
                    entry.save(
                        update_fields=[
                            "status",
                            "canceled_at",
                            "responded_at",
                            "updated_at",
                        ]
                    )

            event = _append_battle_event(
                battle,
                BattleEvent.TYPE_BATTLE_CANCELED,
                actor_user=request.user,
                payload={"canceled_by_user_id": request.user.id, "mode": "creator"},
            )
            events.append(event)
            _touch_participant(participant, last_event_id=event["id"])

        return _response_with_snapshot(battle.id, events)


class CampaignBattleStartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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

            participants = list(BattleParticipant.objects.select_for_update().filter(battle_id=battle.id))
            for entry in participants:
                entry.status = BattleParticipant.STATUS_IN_BATTLE
                entry.battle_joined_at = entry.battle_joined_at or now
                entry.save(update_fields=["status", "battle_joined_at", "updated_at"])

            event = _append_battle_event(
                battle,
                BattleEvent.TYPE_BATTLE_STARTED,
                actor_user=request.user,
                payload={"participant_user_ids": [entry.user_id for entry in participants]},
            )
            events.append(event)
            _touch_participant(participant, last_event_id=event["id"])

        return _response_with_snapshot(battle.id, events)
