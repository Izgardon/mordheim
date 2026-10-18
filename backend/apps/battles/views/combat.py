from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.throttling import BATTLE_WRITE_THROTTLE_CLASSES

from ..models import Battle, BattleEvent, BattleParticipant
from ..services.broadcast import ALL, bump_state_version
from ..services.closing import skip_postbattle
from ..services.errors import BattleError
from ..services.events import append_event
from ..services.exploration import keep_exploration
from ..services.item_use import check_payload_size, item_use_payload
from ..services.lifecycle import end_battle, everyone_confirmed, reset_trading_actions
from ..services.selection import selected_unit_keys
from ..services.timing import postbattle_deadline, record_activity
from ..services.unit_information import unit_entry
from ..services.unusual import unusual_value_warnings
from ..validation.coerce import coerce_bool
from ..validation.config import normalize_unit_information
from ..validation.unit_keys import parse_unit_key
from .responses import broadcast_response, response_with_snapshot
from .shared import (
    INGAME_EVENT_TYPES,
    KILLER_UNIT_TYPES,
    _apply_participant_postbattle_results,
    _build_battle_unit_event_payload,
    _get_user_battle_participant,
    _validate_postbattle_json_for_participant,
)


def _item_use_refusal(battle: Battle, participant: BattleParticipant) -> Response | None:
    if battle.status not in (Battle.STATUS_PREBATTLE, Battle.STATUS_ACTIVE):
        return Response({"detail": "Items can only be used in prebattle or active battle"}, status=400)
    if battle.status == Battle.STATUS_PREBATTLE and participant.status not in (
        BattleParticipant.STATUS_JOINED_PREBATTLE,
        BattleParticipant.STATUS_READY,
    ):
        return Response({"detail": "You are not currently in prebattle"}, status=400)
    if battle.status == Battle.STATUS_ACTIVE and participant.status != BattleParticipant.STATUS_IN_BATTLE:
        return Response({"detail": "You are not currently in battle"}, status=400)
    return None


def _checked_item_use(battle: Battle, participant: BattleParticipant, payload_json: dict) -> dict:
    """The item use to store: a unit of the player's (selected, once the battle is active) carrying the item."""
    selected = selected_unit_keys(participant) if battle.status == Battle.STATUS_ACTIVE else None
    return item_use_payload(participant, payload_json, selected)


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
        try:
            check_payload_size(payload_json)
        except BattleError as refused:
            return refused.response()

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
                if (refusal := _item_use_refusal(battle, participant)) is not None:
                    return refusal
                try:
                    payload_json = _checked_item_use(battle, participant, payload_json)
                except BattleError as refused:
                    return refused.response()
            else:
                if battle.status != Battle.STATUS_ACTIVE:
                    return Response({"detail": "Battle is not active"}, status=400)
                if participant.status != BattleParticipant.STATUS_IN_BATTLE:
                    return Response({"detail": "You are not currently in battle"}, status=400)

            event = append_event(
                battle,
                event_type,
                actor_user=request.user,
                payload=payload_json,
            )
            version = bump_state_version(battle)
        return broadcast_response(request, battle.id, [event], version, response_status=status.HTTP_201_CREATED)


class CampaignBattleUnitOoaView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        raw_unit_key = request.data.get("unit_key")
        try:
            unit = parse_unit_key(raw_unit_key)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        try:
            out_of_action = coerce_bool(request.data.get("out_of_action"), field_name="out_of_action")
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

            selected_keys = selected_unit_keys(participant)
            if unit["unit_key"] not in selected_keys:
                return Response({"detail": "unit_key is not selected for this participant"}, status=400)

            unit_information = normalize_unit_information(participant.unit_information_json)
            info = unit_entry(unit_information, unit["unit_key"])
            if info["out_of_action"] == out_of_action:
                return response_with_snapshot(battle.id, events)

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

            event = append_event(
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
            version = bump_state_version(battle)

        return broadcast_response(
            request, battle.id, events, version, changed=[participant.id], response_status=status.HTTP_201_CREATED
        )


def _kill_refusal(battle: Battle, participant: BattleParticipant, source: str) -> Response | None:
    """Kills are tapped in an active battle, or added in the killer's own postbattle when the request says
    `source: "postbattle"` (decision 5, BATL-NEW-06), so a phone that slept through End isn't taken for one."""
    if source == "postbattle":
        if battle.status == Battle.STATUS_POSTBATTLE and participant.status == BattleParticipant.STATUS_FINISHED_BATTLE:
            return None
        detail = "Kills can be added in postbattle only until you finalise"
        return Response({"detail": detail, "code": "not_in_postbattle"}, status=400)
    if battle.status != Battle.STATUS_ACTIVE:
        return Response({"detail": "Battle is not active"}, status=400)
    if participant.status != BattleParticipant.STATUS_IN_BATTLE:
        return Response({"detail": "You are not currently in battle"}, status=400)
    return None


class CampaignBattleUnitKillView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        raw_killer_unit_key = request.data.get("killer_unit_key")
        raw_victim_unit_key = request.data.get("victim_unit_key")
        raw_victim_name = request.data.get("victim_name", "")
        raw_notes = request.data.get("notes", "")

        try:
            killer = parse_unit_key(raw_killer_unit_key)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        victim = None
        if raw_victim_unit_key:
            try:
                victim = parse_unit_key(raw_victim_unit_key)
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
            earned_xp = coerce_bool(request.data.get("earned_xp", True), field_name="earned_xp")
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        source = "postbattle" if request.data.get("source") == "postbattle" else "battle"

        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if (refusal := _kill_refusal(battle, participant, source)) is not None:
                return refusal

            killer_selected_keys = selected_unit_keys(participant)
            if killer["unit_key"] not in killer_selected_keys:
                return Response({"detail": "killer_unit_key is not selected for this participant"}, status=400)

            unit_information = normalize_unit_information(participant.unit_information_json)
            killer_info = unit_entry(unit_information, killer["unit_key"])
            if killer_info["out_of_action"] and source == "battle":  # in postbattle he may have scored before
                return Response({"detail": "Cannot record kills for a unit that is out of action"}, status=400)

            participants = list(
                BattleParticipant.objects.select_for_update().filter(battle_id=battle.id).order_by("id")
            )
            victim_participant = None
            if victim is not None:
                for entry in participants:
                    entry_selected_keys = selected_unit_keys(entry)
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
                "source": source,
            }
            if notes:
                event_payload["notes"] = notes

            event = append_event(
                battle,
                BattleEvent.TYPE_UNIT_KILL_RECORDED,
                actor_user=request.user,
                payload=event_payload,
            )
            events.append(event)
            version = bump_state_version(battle)

        return broadcast_response(
            request, battle.id, events, version, changed=[participant.id], response_status=status.HTTP_201_CREATED
        )


class CampaignBattleFinishView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        winner_warband_ids = request.data.get("winner_warband_ids")
        if not isinstance(winner_warband_ids, list):  # [] is "No winner" (decision 8)
            return Response({"detail": "winner_warband_ids must be a list"}, status=400)
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
                return response_with_snapshot(battle.id, events)
            if battle.status == Battle.STATUS_POSTBATTLE:
                return response_with_snapshot(battle.id, events)
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
            # wins and losses count when the battle ends, not here (decision 3, BUG-09)
            for entry in participants:
                if entry.status in BattleParticipant.LEFT_STATUSES:
                    continue
                if entry.status == BattleParticipant.STATUS_CONFIRMED_POSTBATTLE:
                    continue
                entry.status = BattleParticipant.STATUS_FINISHED_BATTLE
                entry.finished_at = entry.finished_at or now
                entry.save(update_fields=["status", "finished_at", "updated_at"])

            battle.status = Battle.STATUS_POSTBATTLE
            battle.winner_warband_ids_json = normalized_winner_ids
            battle.closes_at = postbattle_deadline(now)  # 72 hours of postbattle (decision 2)
            battle.save(update_fields=["status", "winner_warband_ids_json", "closes_at", "updated_at"])
            reset_trading_actions(battle)
            event = append_event(
                battle,
                BattleEvent.TYPE_BATTLE_ENTERED_POSTBATTLE,
                actor_user=request.user,
                payload={"winner_warband_ids": normalized_winner_ids},
            )
            events.append(event)
            version = bump_state_version(battle)

        return broadcast_response(request, battle.id, events, version, changed=ALL)


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
                return response_with_snapshot(battle.id, events)

            try:
                postbattle_json = _validate_postbattle_json_for_participant(
                    battle,
                    participant,
                    request.data.get("postbattle_json", participant.postbattle_json),
                )
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=400)

            # the draft keeps the exploration roll, with the server's amount (decision 9, BUG-71)
            stored_exploration = (participant.postbattle_json or {}).get("exploration")
            postbattle_json["exploration"], warnings = keep_exploration(
                stored_exploration, postbattle_json["exploration"]
            )
            warnings += unusual_value_warnings(postbattle_json)  # allowed; logged at finalise (decision 9)
            participant.postbattle_json = postbattle_json
            participant.save(update_fields=["postbattle_json", "updated_at"])
            record_activity(battle)  # a draft is the player's own: activity, but no broadcast (PERF-34)
            # and it logs nothing: finalise logs each unit's injury once (decision 7, BUG-47)

        return response_with_snapshot(battle.id, events, warnings=warnings)


class CampaignBattleFinalizePostbattleView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = BATTLE_WRITE_THROTTLE_CLASSES

    def post(self, request, campaign_id, battle_id):
        try:
            return self._finalize(request, campaign_id, battle_id)
        except ValueError as exc:  # raised inside the transaction, so nothing it wrote is kept (BUG-124)
            return Response({"detail": str(exc)}, status=400)

    def _finalize(self, request, campaign_id, battle_id):
        events: list[dict] = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(campaign_id, battle_id, request.user, for_update=True)
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.status == Battle.STATUS_CANCELED:
                return Response({"detail": "Battle was canceled"}, status=400)
            if participant.status == BattleParticipant.STATUS_CONFIRMED_POSTBATTLE and participant.skipped_postbattle:
                detail = "Your postbattle was skipped, so its results can't be applied now"
                return Response({"detail": detail, "code": "postbattle_skipped"}, status=400)
            if participant.status == BattleParticipant.STATUS_CONFIRMED_POSTBATTLE:
                return response_with_snapshot(battle.id, events)
            if battle.status != Battle.STATUS_POSTBATTLE:
                return Response({"detail": "Battle is not in postbattle"}, status=400)
            if participant.status != BattleParticipant.STATUS_FINISHED_BATTLE:
                return Response({"detail": "You must enter postbattle before finalizing"}, status=400)

            postbattle_json = _validate_postbattle_json_for_participant(
                battle,
                participant,
                request.data.get("postbattle_json", participant.postbattle_json),
            )
            stored_exploration = (participant.postbattle_json or {}).get("exploration")
            postbattle_json["exploration"], warnings = keep_exploration(
                stored_exploration, postbattle_json["exploration"]
            )
            warnings += _apply_participant_postbattle_results(battle, participant, postbattle_json)
            participant.postbattle_json = postbattle_json
            participant.status = BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
            participant.confirmed_at = timezone.now()
            participant.save(update_fields=["postbattle_json", "status", "confirmed_at", "updated_at"])
            event = append_event(
                battle,
                BattleEvent.TYPE_PARTICIPANT_CONFIRMED_POSTBATTLE,
                actor_user=request.user,
                payload={"participant_user_id": request.user.id},
            )
            events.append(event)

            if battle.status != Battle.STATUS_ENDED and everyone_confirmed(battle.id):
                end_battle(battle, request.user, events)
            version = bump_state_version(battle)
            changed = ALL if battle.status == Battle.STATUS_ENDED else [participant.id]

        return broadcast_response(request, battle.id, events, version, changed=changed, warnings=warnings)


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
                return response_with_snapshot(battle.id, events)
            if battle.status != Battle.STATUS_POSTBATTLE:
                return Response({"detail": "Battle is not in postbattle"}, status=400)
            if participant.status != BattleParticipant.STATUS_FINISHED_BATTLE:
                return Response({"detail": "You must enter postbattle before leaving"}, status=400)

            events.append(skip_postbattle(battle, participant, actor_user=request.user))

            if battle.status != Battle.STATUS_ENDED and everyone_confirmed(battle.id):
                end_battle(battle, request.user, events)
            version = bump_state_version(battle)
            changed = ALL if battle.status == Battle.STATUS_ENDED else [participant.id]

        return broadcast_response(request, battle.id, events, version, changed=changed)
