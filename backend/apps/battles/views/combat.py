from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.throttling import BATTLE_WRITE_THROTTLE_CLASSES
from apps.warbands.models import Warband

from ..models import Battle, BattleEvent, BattleParticipant
from .shared import (
    INGAME_EVENT_TYPES,
    KILLER_UNIT_TYPES,
    _all_started_participants_confirmed,
    _apply_participant_postbattle_results,
    _append_battle_event,
    _build_battle_unit_event_payload,
    _coerce_bool,
    _finalize_battle,
    _get_user_battle_participant,
    _log_new_serious_injury_rolls,
    _normalize_unit_information,
    _parse_unit_key,
    _participant_selected_unit_keys,
    _reset_trading_actions_for_battle_participants,
    _response_with_snapshot,
    _touch_participant,
    _upsert_unit_information,
    _validate_postbattle_json_for_participant,
)


class CampaignBattleEventCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

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
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

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
                and not info.get("notes", "")
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
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

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

            killer_payload = _build_battle_unit_event_payload(participant, killer)

            if victim is not None:
                victim_payload = (
                    _build_battle_unit_event_payload(victim_participant, victim)
                    if victim_participant is not None
                    else {
                        "unit_key": victim["unit_key"],
                        "unit_type": victim["unit_type"],
                        "unit_id": victim["unit_id"],
                        "warband_id": None,
                        "name": None,
                        "is_leader": False,
                        "is_caster": False,
                        "caster_type": None,
                        "is_large": False,
                    }
                )
            else:
                victim_payload = {
                    "unit_key": None,
                    "unit_type": None,
                    "unit_id": None,
                    "warband_id": None,
                    "name": victim_name,
                }

            event_payload = {
                "killer": killer_payload,
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
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        winner_warband_ids = request.data.get("winner_warband_ids", [])
        if not isinstance(winner_warband_ids, list) or not winner_warband_ids:
            return Response({"detail": "winner_warband_ids must be a non-empty list"}, status=400)
        normalized_winner_ids: list[int] = []
        for raw_winner_id in winner_warband_ids:
            try:
                winner_id = int(raw_winner_id)
            except (TypeError, ValueError):
                return Response({"detail": "winner_warband_ids must contain integers"}, status=400)
            if winner_id <= 0:
                return Response({"detail": "winner_warband_ids must contain integers"}, status=400)
            if winner_id not in normalized_winner_ids:
                normalized_winner_ids.append(winner_id)

        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.status in (Battle.STATUS_INVITING, Battle.STATUS_PREBATTLE, Battle.STATUS_CANCELED):
                return Response({"detail": "Battle has not started"}, status=400)
            if battle.status == Battle.STATUS_ENDED:
                return _response_with_snapshot(battle.id, events)
            if battle.status == Battle.STATUS_POSTBATTLE:
                return _response_with_snapshot(battle.id, events)
            if battle.status != Battle.STATUS_ACTIVE:
                return Response({"detail": "Battle is not active"}, status=400)
            if battle.created_by_user_id != request.user.id:
                return Response({"detail": "Only the battle creator can end the active battle"}, status=403)

            participant_warband_ids = set(
                BattleParticipant.objects.filter(battle_id=battle.id).values_list("warband_id", flat=True)
            )
            if any(winner_id not in participant_warband_ids for winner_id in normalized_winner_ids):
                return Response({"detail": "winner_warband_ids must belong to this battle"}, status=400)

            now = timezone.now()
            participants = list(
                BattleParticipant.objects.select_for_update().filter(battle_id=battle.id).order_by("id")
            )
            resolved_winner_ids = set(normalized_winner_ids)
            resolved_loser_ids: set[int] = set()
            for entry in participants:
                if entry.status == BattleParticipant.STATUS_CANCELED_PREBATTLE:
                    continue
                if entry.status == BattleParticipant.STATUS_CONFIRMED_POSTBATTLE:
                    continue
                if entry.warband_id in resolved_winner_ids:
                    continue
                resolved_loser_ids.add(entry.warband_id)

            if resolved_winner_ids:
                Warband.objects.filter(id__in=resolved_winner_ids).update(
                    wins=F("wins") + 1
                )
                Warband.objects.filter(id__in=resolved_winner_ids, wins__isnull=True).update(wins=1)
            if resolved_loser_ids:
                Warband.objects.filter(id__in=resolved_loser_ids).update(
                    losses=F("losses") + 1
                )
                Warband.objects.filter(id__in=resolved_loser_ids, losses__isnull=True).update(losses=1)

            for entry in participants:
                if entry.status == BattleParticipant.STATUS_CANCELED_PREBATTLE:
                    continue
                if entry.status == BattleParticipant.STATUS_CONFIRMED_POSTBATTLE:
                    continue
                entry.status = BattleParticipant.STATUS_FINISHED_BATTLE
                entry.finished_at = entry.finished_at or now
                entry.save(update_fields=["status", "finished_at", "updated_at"])

            battle.status = Battle.STATUS_POSTBATTLE
            battle.winner_warband_ids_json = normalized_winner_ids
            battle.save(update_fields=["status", "winner_warband_ids_json", "updated_at"])
            _reset_trading_actions_for_battle_participants(battle)
            event = _append_battle_event(
                battle,
                BattleEvent.TYPE_BATTLE_ENTERED_POSTBATTLE,
                actor_user=request.user,
                payload={"winner_warband_ids": normalized_winner_ids},
            )
            events.append(event)
            _touch_participant(participant, last_event_id=event["id"])

        return _response_with_snapshot(battle.id, events)


class CampaignBattleWinnerView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        return Response({"detail": "Winner selection happens when the active battle ends"}, status=400)


class CampaignBattlePostbattleSaveView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.status != Battle.STATUS_POSTBATTLE:
                return Response({"detail": "Battle is not in postbattle"}, status=400)
            if participant.status == BattleParticipant.STATUS_CONFIRMED_POSTBATTLE:
                return _response_with_snapshot(battle.id, events)

            try:
                postbattle_json = _validate_postbattle_json_for_participant(
                    battle,
                    participant,
                    request.data.get("postbattle_json", participant.postbattle_json),
                )
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=400)

            previous_postbattle_json = participant.postbattle_json
            participant.postbattle_json = {
                "exploration": {
                    "dice_values": [],
                    "resource_id": None,
                },
                "upkeep": postbattle_json.get("upkeep", {"pay_upkeep": True, "entries": {}}),
                "unit_results": postbattle_json.get("unit_results", {}),
            }
            participant.save(update_fields=["postbattle_json", "updated_at"])
            _log_new_serious_injury_rolls(
                participant,
                previous_postbattle_json,
                participant.postbattle_json,
            )
            _touch_participant(participant)

        return _response_with_snapshot(battle.id, events)


class CampaignBattleFinalizePostbattleView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.status == Battle.STATUS_CANCELED:
                return Response({"detail": "Battle was canceled"}, status=400)
            if participant.status == BattleParticipant.STATUS_CONFIRMED_POSTBATTLE:
                return _response_with_snapshot(battle.id, events)
            if battle.status != Battle.STATUS_POSTBATTLE:
                return Response({"detail": "Battle is not in postbattle"}, status=400)
            if participant.status != BattleParticipant.STATUS_FINISHED_BATTLE:
                return Response({"detail": "You must enter postbattle before finalizing"}, status=400)

            try:
                postbattle_json = _validate_postbattle_json_for_participant(
                    battle,
                    participant,
                    request.data.get("postbattle_json", participant.postbattle_json),
                )
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=400)

            _apply_participant_postbattle_results(battle, participant, postbattle_json)
            participant.postbattle_json = postbattle_json
            participant.status = BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
            participant.confirmed_at = timezone.now()
            participant.save(
                update_fields=["postbattle_json", "status", "confirmed_at", "updated_at"]
            )
            event = _append_battle_event(
                battle,
                BattleEvent.TYPE_PARTICIPANT_CONFIRMED_POSTBATTLE,
                actor_user=request.user,
                payload={"participant_user_id": request.user.id},
            )
            events.append(event)

            if battle.status != Battle.STATUS_ENDED and _all_started_participants_confirmed(battle.id):
                _finalize_battle(battle, request.user, events)

            _touch_participant(
                participant,
                last_event_id=events[-1]["id"] if events else participant.last_event_id,
            )

        return _response_with_snapshot(battle.id, events)


class CampaignBattleConfirmView(CampaignBattleFinalizePostbattleView):
    def post(self, request, campaign_id, battle_id):
        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.status == Battle.STATUS_CANCELED:
                return Response({"detail": "Battle was canceled"}, status=400)
            if participant.status == BattleParticipant.STATUS_CONFIRMED_POSTBATTLE:
                return _response_with_snapshot(battle.id, events)
            if battle.status != Battle.STATUS_POSTBATTLE:
                return Response({"detail": "Battle is not in postbattle"}, status=400)
            if participant.status != BattleParticipant.STATUS_FINISHED_BATTLE:
                return Response({"detail": "You must enter postbattle before leaving"}, status=400)

            participant.postbattle_json = {
                "exploration": {
                    "dice_values": [],
                    "resource_id": None,
                },
                "upkeep": {
                    "pay_upkeep": True,
                    "entries": {},
                },
                "unit_results": {},
            }
            participant.status = BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
            participant.confirmed_at = timezone.now()
            participant.save(
                update_fields=["postbattle_json", "status", "confirmed_at", "updated_at"]
            )
            event = _append_battle_event(
                battle,
                BattleEvent.TYPE_PARTICIPANT_CONFIRMED_POSTBATTLE,
                actor_user=request.user,
                payload={"participant_user_id": request.user.id, "skipped_postbattle": True},
            )
            events.append(event)

            if battle.status != Battle.STATUS_ENDED and _all_started_participants_confirmed(battle.id):
                _finalize_battle(battle, request.user, events)

            _touch_participant(
                participant,
                last_event_id=events[-1]["id"] if events else participant.last_event_id,
            )

        return _response_with_snapshot(battle.id, events)
