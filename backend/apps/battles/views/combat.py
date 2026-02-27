from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Battle, BattleEvent, BattleParticipant
from .shared import (
    INGAME_EVENT_TYPES,
    KILLER_UNIT_TYPES,
    _all_started_participants_confirmed,
    _all_started_participants_finished,
    _append_battle_event,
    _coerce_bool,
    _finalize_battle,
    _get_user_battle_participant,
    _latest_finished_participant,
    _normalize_unit_information,
    _parse_unit_key,
    _participant_selected_unit_keys,
    _response_with_snapshot,
    _touch_participant,
    _upsert_unit_information,
)


class CampaignBattleEventCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id, battle_id):
        event_type = request.data.get("type")
        payload_json = request.data.get("payload_json", {})
        if event_type not in INGAME_EVENT_TYPES:
            return Response({"detail": "Unsupported event type"}, status=400)
        if payload_json is None:
            payload_json = {}
        if not isinstance(payload_json, dict):
            return Response({"detail": "payload_json must be an object"}, status=400)

        if event_type == BattleEvent.TYPE_KILL_RECORDED:
            unit_type = str(payload_json.get("killer_unit_type", "")).strip().lower()
            if unit_type not in KILLER_UNIT_TYPES:
                return Response({"detail": "killer_unit_type is invalid"}, status=400)
            payload_json["killer_unit_type"] = unit_type
            if unit_type in ("custom", "bestiary"):
                killer_unit_key = payload_json.get("killer_unit_key")
                if not isinstance(killer_unit_key, str) or not killer_unit_key.strip():
                    return Response({"detail": "killer_unit_key is required for custom/bestiary units"}, status=400)
                payload_json["killer_unit_key"] = killer_unit_key.strip()
                payload_json.pop("killer_unit_id", None)
            else:
                try:
                    killer_unit_id = int(payload_json.get("killer_unit_id", 0))
                except (TypeError, ValueError):
                    return Response({"detail": "killer_unit_id is required"}, status=400)
                if killer_unit_id <= 0:
                    return Response({"detail": "killer_unit_id is required"}, status=400)
                payload_json["killer_unit_id"] = killer_unit_id

        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if event_type == BattleEvent.TYPE_ITEM_USED:
                if battle.status not in (Battle.STATUS_PREBATTLE, Battle.STATUS_ACTIVE):
                    return Response({"detail": "Items can only be used in prebattle or active battle"}, status=400)
                if battle.status == Battle.STATUS_PREBATTLE and participant.status not in (
                    BattleParticipant.STATUS_JOINED_PREBATTLE,
                    BattleParticipant.STATUS_READY,
                ):
                    return Response({"detail": "You are not currently in prebattle"}, status=400)
                if battle.status == Battle.STATUS_ACTIVE and participant.status != BattleParticipant.STATUS_IN_BATTLE:
                    return Response({"detail": "You are not currently in battle"}, status=400)
            else:
                if battle.status != Battle.STATUS_ACTIVE:
                    return Response({"detail": "Battle is not active"}, status=400)
                if participant.status != BattleParticipant.STATUS_IN_BATTLE:
                    return Response({"detail": "You are not currently in battle"}, status=400)

            event = _append_battle_event(
                battle,
                event_type,
                actor_user=request.user,
                payload=payload_json,
            )
            _touch_participant(participant, last_event_id=event["id"])
        return _response_with_snapshot(battle.id, [event], response_status=status.HTTP_201_CREATED)


class CampaignBattleUnitOoaView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id, battle_id):
        raw_unit_key = request.data.get("unit_key")
        try:
            unit = _parse_unit_key(raw_unit_key)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        try:
            out_of_action = _coerce_bool(request.data.get("out_of_action"), field_name="out_of_action")
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.status != Battle.STATUS_ACTIVE:
                return Response({"detail": "Battle is not active"}, status=400)
            if participant.status != BattleParticipant.STATUS_IN_BATTLE:
                return Response({"detail": "You are not currently in battle"}, status=400)

            selected_keys = _participant_selected_unit_keys(participant)
            if unit["unit_key"] not in selected_keys:
                return Response({"detail": "unit_key is not selected for this participant"}, status=400)

            unit_information = _normalize_unit_information(participant.unit_information_json)
            info = _upsert_unit_information(unit_information, unit["unit_key"])
            if info["out_of_action"] == out_of_action:
                _touch_participant(participant)
                return _response_with_snapshot(battle.id, events)

            info["out_of_action"] = out_of_action
            if (
                not info["stats_override"]
                and not info["stats_reason"]
                and not info["out_of_action"]
                and info["kill_count"] == 0
            ):
                unit_information.pop(unit["unit_key"], None)

            participant.unit_information_json = unit_information
            participant.save(update_fields=["unit_information_json", "updated_at"])

            event = _append_battle_event(
                battle,
                BattleEvent.TYPE_UNIT_OOA_SET if out_of_action else BattleEvent.TYPE_UNIT_OOA_UNSET,
                actor_user=request.user,
                payload={
                    "unit": {
                        "unit_key": unit["unit_key"],
                        "unit_type": unit["unit_type"],
                        "unit_id": unit["unit_id"],
                        "warband_id": participant.warband_id,
                    },
                    "out_of_action": out_of_action,
                },
            )
            events.append(event)
            _touch_participant(participant, last_event_id=event["id"])

        return _response_with_snapshot(battle.id, events, response_status=status.HTTP_201_CREATED)


class CampaignBattleUnitKillView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id, battle_id):
        raw_killer_unit_key = request.data.get("killer_unit_key")
        raw_victim_unit_key = request.data.get("victim_unit_key")
        raw_victim_name = request.data.get("victim_name", "")
        raw_notes = request.data.get("notes", "")

        try:
            killer = _parse_unit_key(raw_killer_unit_key)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        victim = None
        if raw_victim_unit_key:
            try:
                victim = _parse_unit_key(raw_victim_unit_key)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=400)

        if raw_victim_name is None:
            raw_victim_name = ""
        if not isinstance(raw_victim_name, str):
            return Response({"detail": "victim_name must be a string"}, status=400)
        victim_name = raw_victim_name.strip()
        if len(victim_name) > 120:
            return Response({"detail": "victim_name must be at most 120 characters"}, status=400)

        if raw_notes is None:
            raw_notes = ""
        if not isinstance(raw_notes, str):
            return Response({"detail": "notes must be a string"}, status=400)
        notes = raw_notes.strip()
        if len(notes) > 500:
            return Response({"detail": "notes must be at most 500 characters"}, status=400)

        if victim is None and not victim_name:
            return Response(
                {"detail": "Either victim_unit_key or victim_name is required"},
                status=400,
            )

        try:
            earned_xp = _coerce_bool(request.data.get("earned_xp", True), field_name="earned_xp")
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.status != Battle.STATUS_ACTIVE:
                return Response({"detail": "Battle is not active"}, status=400)
            if participant.status != BattleParticipant.STATUS_IN_BATTLE:
                return Response({"detail": "You are not currently in battle"}, status=400)

            killer_selected_keys = _participant_selected_unit_keys(participant)
            if killer["unit_key"] not in killer_selected_keys:
                return Response({"detail": "killer_unit_key is not selected for this participant"}, status=400)

            unit_information = _normalize_unit_information(participant.unit_information_json)
            killer_info = _upsert_unit_information(unit_information, killer["unit_key"])
            if killer_info["out_of_action"]:
                return Response({"detail": "Cannot record kills for a unit that is out of action"}, status=400)

            participants = list(
                BattleParticipant.objects.select_for_update().filter(battle_id=battle.id).order_by("id")
            )
            victim_participant = None
            if victim is not None:
                for entry in participants:
                    entry_selected_keys = _participant_selected_unit_keys(entry)
                    if victim["unit_key"] in entry_selected_keys:
                        victim_participant = entry
                        break
                if victim_participant is None:
                    return Response({"detail": "victim_unit_key is not selected in this battle"}, status=400)

            killer_info["kill_count"] = max(0, int(killer_info.get("kill_count", 0))) + 1
            participant.unit_information_json = unit_information
            participant.save(update_fields=["unit_information_json", "updated_at"])

            if victim is not None:
                victim_payload = {
                    "unit_key": victim["unit_key"],
                    "unit_type": victim["unit_type"],
                    "unit_id": victim["unit_id"],
                    "warband_id": victim_participant.warband_id if victim_participant else None,
                }
            else:
                victim_payload = {
                    "unit_key": None,
                    "unit_type": None,
                    "unit_id": None,
                    "warband_id": None,
                    "name": victim_name,
                }

            event_payload = {
                "killer": {
                    "unit_key": killer["unit_key"],
                    "unit_type": killer["unit_type"],
                    "unit_id": killer["unit_id"],
                    "warband_id": participant.warband_id,
                },
                "victim": victim_payload,
                "earned_xp": earned_xp,
            }
            if notes:
                event_payload["notes"] = notes

            event = _append_battle_event(
                battle,
                BattleEvent.TYPE_UNIT_KILL_RECORDED,
                actor_user=request.user,
                payload=event_payload,
            )
            events.append(event)
            _touch_participant(participant, last_event_id=event["id"])

        return _response_with_snapshot(battle.id, events, response_status=status.HTTP_201_CREATED)


class CampaignBattleFinishView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id, battle_id):
        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.status in (Battle.STATUS_INVITING, Battle.STATUS_PREBATTLE, Battle.STATUS_CANCELED):
                return Response({"detail": "Battle has not started"}, status=400)
            if battle.status == Battle.STATUS_ENDED:
                return _response_with_snapshot(battle.id, events)
            if participant.status == BattleParticipant.STATUS_CONFIRMED_POSTBATTLE:
                return _response_with_snapshot(battle.id, events)
            if participant.status not in (
                BattleParticipant.STATUS_IN_BATTLE,
                BattleParticipant.STATUS_FINISHED_BATTLE,
            ):
                return Response({"detail": "Cannot finish from current state"}, status=400)

            now = timezone.now()
            if participant.status == BattleParticipant.STATUS_IN_BATTLE:
                participant.status = BattleParticipant.STATUS_FINISHED_BATTLE
                participant.finished_at = now
                participant.save(update_fields=["status", "finished_at", "updated_at"])
                events.append(
                    _append_battle_event(
                        battle,
                        BattleEvent.TYPE_PARTICIPANT_FINISHED_BATTLE,
                        actor_user=request.user,
                        payload={"participant_user_id": request.user.id},
                    )
                )

            if battle.status == Battle.STATUS_ACTIVE and _all_started_participants_finished(battle.id):
                battle.status = Battle.STATUS_POSTBATTLE
                battle.save(update_fields=["status", "updated_at"])
                events.append(
                    _append_battle_event(
                        battle,
                        BattleEvent.TYPE_BATTLE_ENTERED_POSTBATTLE,
                        actor_user=request.user,
                        payload={},
                    )
                )

            _touch_participant(
                participant,
                last_event_id=events[-1]["id"] if events else participant.last_event_id,
            )

        return _response_with_snapshot(battle.id, events)


class CampaignBattleWinnerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id, battle_id):
        winner_warband_id = request.data.get("winner_warband_id")
        try:
            winner_warband_id = int(winner_warband_id)
        except (TypeError, ValueError):
            return Response({"detail": "winner_warband_id is required"}, status=400)

        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.status != Battle.STATUS_POSTBATTLE:
                return Response({"detail": "Winner can only be declared in postbattle"}, status=400)
            if participant.status not in (
                BattleParticipant.STATUS_FINISHED_BATTLE,
                BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
            ):
                return Response({"detail": "You must finish your battle first"}, status=400)

            participant_warband_ids = set(
                BattleParticipant.objects.filter(battle_id=battle.id).values_list("warband_id", flat=True)
            )
            if winner_warband_id not in participant_warband_ids:
                return Response({"detail": "winner_warband_id is not part of this battle"}, status=400)

            latest_finisher = _latest_finished_participant(battle.id)
            if latest_finisher and latest_finisher.user_id != request.user.id:
                return Response({"detail": "Only the last finisher can declare winner"}, status=403)

            if battle.winner_warband_id:
                if battle.winner_warband_id == winner_warband_id:
                    return _response_with_snapshot(battle.id, events)
                return Response({"detail": "Winner has already been declared"}, status=400)

            battle.winner_warband_id = winner_warband_id
            battle.save(update_fields=["winner_warband_id", "updated_at"])
            event = _append_battle_event(
                battle,
                BattleEvent.TYPE_WINNER_DECLARED,
                actor_user=request.user,
                payload={"winner_warband_id": winner_warband_id},
            )
            events.append(event)
            _touch_participant(participant, last_event_id=event["id"])

        return _response_with_snapshot(battle.id, events)


class CampaignBattleConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id, battle_id):
        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.status == Battle.STATUS_CANCELED:
                return Response({"detail": "Battle was canceled"}, status=400)
            if battle.status in (Battle.STATUS_INVITING, Battle.STATUS_PREBATTLE):
                return Response({"detail": "Battle has not started"}, status=400)
            if participant.status not in (
                BattleParticipant.STATUS_FINISHED_BATTLE,
                BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
            ):
                return Response({"detail": "You must finish your battle first"}, status=400)

            if participant.status != BattleParticipant.STATUS_CONFIRMED_POSTBATTLE:
                participant.status = BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
                participant.confirmed_at = timezone.now()
                participant.save(update_fields=["status", "confirmed_at", "updated_at"])
                events.append(
                    _append_battle_event(
                        battle,
                        BattleEvent.TYPE_PARTICIPANT_CONFIRMED_POSTBATTLE,
                        actor_user=request.user,
                        payload={"participant_user_id": request.user.id},
                    )
                )

            should_finalize = (
                battle.status != Battle.STATUS_ENDED
                and battle.winner_warband_id is not None
                and _all_started_participants_confirmed(battle.id)
            )
            if should_finalize:
                _finalize_battle(battle, request.user, events)

            _touch_participant(
                participant,
                last_event_id=events[-1]["id"] if events else participant.last_event_id,
            )

        return _response_with_snapshot(battle.id, events)
