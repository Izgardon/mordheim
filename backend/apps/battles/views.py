from collections import defaultdict

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.campaigns.models import CampaignMembership
from apps.campaigns.permissions import get_membership
from apps.realtime.services import (
    get_battle_channel_name,
    send_battle_event,
    send_user_notification,
)
from apps.warbands.models import Hero, Henchman, HiredSword, Warband

from .models import Battle, BattleEvent, BattleParticipant

KILLER_UNIT_TYPES = {"hero", "hired_sword", "henchman", "custom"}
AGGREGATED_KILLER_UNIT_TYPES = {"hero", "hired_sword", "henchman"}
INGAME_EVENT_TYPES = {
    BattleEvent.TYPE_KILL_RECORDED,
    BattleEvent.TYPE_DEATH_RECORDED,
    BattleEvent.TYPE_ITEM_USED,
}
NUMERIC_STAT_KEYS = {
    "movement",
    "weapon_skill",
    "ballistic_skill",
    "strength",
    "toughness",
    "wounds",
    "initiative",
    "attacks",
    "leadership",
}
ARMOUR_SAVE_STAT_KEY = "armour_save"
ALL_OVERRIDE_STAT_KEYS = NUMERIC_STAT_KEYS | {ARMOUR_SAVE_STAT_KEY}


def _display_name(user):
    first_name = getattr(user, "first_name", None)
    if first_name and str(first_name).strip():
        return str(first_name).strip()
    return user.get_username()


def _serialize_battle(battle: Battle) -> dict:
    return {
        "id": battle.id,
        "campaign_id": battle.campaign_id,
        "created_by_user_id": battle.created_by_user_id,
        "title": battle.title,
        "status": battle.status,
        "scenario": battle.scenario,
        "winner_warband_id": battle.winner_warband_id,
        "settings_json": battle.settings_json or {},
        "created_at": battle.created_at.isoformat(),
        "updated_at": battle.updated_at.isoformat(),
        "started_at": battle.started_at.isoformat() if battle.started_at else None,
        "ended_at": battle.ended_at.isoformat() if battle.ended_at else None,
        "post_processed_at": (
            battle.post_processed_at.isoformat() if battle.post_processed_at else None
        ),
        "channel": get_battle_channel_name(battle.id),
    }


def _serialize_participant(participant: BattleParticipant) -> dict:
    return {
        "id": participant.id,
        "battle_id": participant.battle_id,
        "status": participant.status,
        "connection_state": participant.connection_state,
        "last_event_id": participant.last_event_id,
        "invited_by_user_id": participant.invited_by_user_id,
        "invited_at": participant.invited_at.isoformat() if participant.invited_at else None,
        "responded_at": participant.responded_at.isoformat() if participant.responded_at else None,
        "joined_at": participant.joined_at.isoformat() if participant.joined_at else None,
        "ready_at": participant.ready_at.isoformat() if participant.ready_at else None,
        "canceled_at": participant.canceled_at.isoformat() if participant.canceled_at else None,
        "battle_joined_at": (
            participant.battle_joined_at.isoformat() if participant.battle_joined_at else None
        ),
        "finished_at": participant.finished_at.isoformat() if participant.finished_at else None,
        "confirmed_at": participant.confirmed_at.isoformat() if participant.confirmed_at else None,
        "last_seen_at": participant.last_seen_at.isoformat() if participant.last_seen_at else None,
        "selected_unit_keys_json": participant.selected_unit_keys_json or [],
        "stat_overrides_json": participant.stat_overrides_json or {},
        "custom_units_json": participant.custom_units_json or [],
        "declared_rating": participant.declared_rating,
        "user": {
            "id": participant.user_id,
            "label": _display_name(participant.user),
        },
        "warband": {
            "id": participant.warband_id,
            "name": participant.warband.name,
        },
    }


def _serialize_event(event: BattleEvent) -> dict:
    return {
        "id": event.id,
        "battle_id": event.battle_id,
        "type": event.type,
        "actor_user_id": event.actor_user_id,
        "payload_json": event.payload_json or {},
        "created_at": event.created_at.isoformat(),
    }


def _battle_snapshot(battle_id: int) -> dict:
    battle = Battle.objects.filter(id=battle_id).first()
    participants = (
        BattleParticipant.objects.select_related("user", "warband")
        .filter(battle_id=battle_id)
        .order_by("id")
    )
    return {
        "battle": _serialize_battle(battle),
        "participants": [_serialize_participant(participant) for participant in participants],
    }


def _battle_state_payload(battle_id: int, since_event_id: int) -> dict:
    snapshot = _battle_snapshot(battle_id)
    events = BattleEvent.objects.filter(battle_id=battle_id, id__gt=since_event_id).order_by(
        "id"
    )
    snapshot["events"] = [_serialize_event(event) for event in events]
    return snapshot


def _append_battle_event(
    battle: Battle,
    event_type: str,
    actor_user=None,
    payload: dict | None = None,
) -> dict:
    event = BattleEvent.objects.create(
        battle=battle,
        actor_user=actor_user,
        type=event_type,
        payload_json=payload or {},
    )
    serialized = _serialize_event(event)
    transaction.on_commit(
        lambda battle_id=battle.id, event_name=event_type, data=serialized: send_battle_event(
            battle_id, event_name, data
        )
    )
    return serialized


def _notify_user(user_id: int, event: str, payload: dict) -> None:
    transaction.on_commit(
        lambda uid=user_id, event_name=event, data=payload: send_user_notification(
            uid, event_name, data
        )
    )


def _notify_battle_state_changed(battle: Battle, *, actor_user_id: int | None = None, reason: str = "") -> None:
    payload = {
        "battle_id": battle.id,
        "campaign_id": battle.campaign_id,
        "status": battle.status,
    }
    if actor_user_id is not None:
        payload["actor_user_id"] = actor_user_id
    if reason:
        payload["reason"] = reason
    transaction.on_commit(
        lambda battle_id=battle.id, data=payload: send_battle_event(
            battle_id, "battle_state_updated", data
        )
    )


def _touch_participant(
    participant: BattleParticipant, *, last_event_id: int | None = None
) -> None:
    participant.connection_state = BattleParticipant.CONNECTION_ONLINE
    participant.last_seen_at = timezone.now()
    update_fields = ["connection_state", "last_seen_at"]
    if last_event_id is not None:
        participant.last_event_id = last_event_id
        update_fields.append("last_event_id")
    participant.save(update_fields=update_fields)


def _get_user_battle_participant(campaign_id: int, battle_id: int, user, for_update=False):
    if not get_membership(user, campaign_id):
        return None, None

    battle_qs = Battle.objects.filter(id=battle_id, campaign_id=campaign_id)
    if for_update:
        battle_qs = battle_qs.select_for_update()
    battle = battle_qs.first()
    if not battle:
        return None, None

    participant_qs = (
        BattleParticipant.objects.select_related("user", "warband")
        .filter(battle_id=battle.id, user=user)
    )
    if for_update:
        participant_qs = participant_qs.select_for_update()
    participant = participant_qs.first()
    return battle, participant


def _all_participants_ready(battle_id: int) -> bool:
    participants = BattleParticipant.objects.filter(battle_id=battle_id)
    return participants.exists() and not participants.exclude(
        status=BattleParticipant.STATUS_READY
    ).exists()


def _all_participants_accepted(battle_id: int) -> bool:
    participants = BattleParticipant.objects.filter(battle_id=battle_id)
    return participants.exists() and not participants.exclude(
        status__in=(
            BattleParticipant.STATUS_ACCEPTED,
            BattleParticipant.STATUS_JOINED_PREBATTLE,
            BattleParticipant.STATUS_READY,
        )
    ).exists()


def _all_participants_canceled_prebattle(battle_id: int) -> bool:
    participants = BattleParticipant.objects.filter(battle_id=battle_id)
    return participants.exists() and not participants.exclude(
        status=BattleParticipant.STATUS_CANCELED_PREBATTLE
    ).exists()


def _all_started_participants_finished(battle_id: int) -> bool:
    participants = BattleParticipant.objects.filter(battle_id=battle_id).exclude(
        status=BattleParticipant.STATUS_CANCELED_PREBATTLE
    )
    return participants.exists() and not participants.exclude(
        status__in=(
            BattleParticipant.STATUS_FINISHED_BATTLE,
            BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
        )
    ).exists()


def _all_started_participants_confirmed(battle_id: int) -> bool:
    participants = BattleParticipant.objects.filter(battle_id=battle_id).exclude(
        status=BattleParticipant.STATUS_CANCELED_PREBATTLE
    )
    return participants.exists() and not participants.exclude(
        status=BattleParticipant.STATUS_CONFIRMED_POSTBATTLE
    ).exists()


def _latest_finished_participant(battle_id: int):
    return (
        BattleParticipant.objects.filter(
            battle_id=battle_id,
            status__in=(
                BattleParticipant.STATUS_FINISHED_BATTLE,
                BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
            ),
            finished_at__isnull=False,
        )
        .order_by("-finished_at", "-id")
        .first()
    )


def _apply_kill_aggregation(battle_id: int) -> None:
    totals = {
        "hero": defaultdict(int),
        "hired_sword": defaultdict(int),
        "henchman": defaultdict(int),
    }
    kill_events = BattleEvent.objects.filter(
        battle_id=battle_id,
        type=BattleEvent.TYPE_KILL_RECORDED,
    ).values_list("payload_json", flat=True)

    for payload in kill_events:
        if not isinstance(payload, dict):
            continue
        unit_type = str(payload.get("killer_unit_type", "")).strip().lower()
        unit_id = payload.get("killer_unit_id")
        if unit_type not in KILLER_UNIT_TYPES:
            continue
        if unit_type not in AGGREGATED_KILLER_UNIT_TYPES:
            continue
        try:
            unit_id = int(unit_id)
        except (TypeError, ValueError):
            continue
        if unit_id <= 0:
            continue
        totals[unit_type][unit_id] += 1

    for unit_id, count in totals["hero"].items():
        Hero.objects.filter(id=unit_id).update(kills=F("kills") + count)
    for unit_id, count in totals["hired_sword"].items():
        HiredSword.objects.filter(id=unit_id).update(kills=F("kills") + count)
    for unit_id, count in totals["henchman"].items():
        Henchman.objects.filter(id=unit_id).update(kills=F("kills") + count)


def _finalize_battle(battle: Battle, actor_user, events: list[dict]) -> None:
    if battle.status == Battle.STATUS_ENDED:
        return

    now = timezone.now()
    if not battle.post_processed_at:
        _apply_kill_aggregation(battle.id)
        battle.post_processed_at = now

    battle.status = Battle.STATUS_ENDED
    battle.ended_at = battle.ended_at or now
    battle.save(update_fields=["status", "ended_at", "post_processed_at", "updated_at"])
    events.append(
        _append_battle_event(
            battle,
            BattleEvent.TYPE_BATTLE_ENDED,
            actor_user=actor_user,
            payload={"winner_warband_id": battle.winner_warband_id},
        )
    )


def _response_with_snapshot(battle_id: int, events: list[dict], response_status=200):
    payload = _battle_snapshot(battle_id)
    payload["events"] = events
    return Response(payload, status=response_status)


def _normalize_unit_keys(raw_value):
    if raw_value is None:
        return []
    if not isinstance(raw_value, list):
        raise ValueError("selected_unit_keys_json must be a list")

    normalized = []
    for entry in raw_value:
        if not isinstance(entry, str):
            raise ValueError("selected_unit_keys_json must contain only strings")
        key = entry.strip()
        if not key:
            continue
        normalized.append(key)
    return list(dict.fromkeys(normalized))


def _normalize_stat_overrides(raw_value):
    if raw_value is None:
        return {}
    if not isinstance(raw_value, dict):
        raise ValueError("stat_overrides_json must be an object")

    normalized = {}
    for unit_key, override in raw_value.items():
        if not isinstance(unit_key, str):
            raise ValueError("stat_overrides_json keys must be strings")
        if not isinstance(override, dict):
            raise ValueError("Each stat override must be an object")

        reason = override.get("reason", "")
        if reason is None:
            reason = ""
        if not isinstance(reason, str):
            raise ValueError("stat override reason must be a string")

        stats = override.get("stats", {})
        if stats is None:
            stats = {}
        if not isinstance(stats, dict):
            raise ValueError("stat override stats must be an object")

        normalized_unit_key = unit_key.strip()
        if not normalized_unit_key:
            continue

        cleaned_stats = {}
        for stat_key, stat_value in stats.items():
            if not isinstance(stat_key, str):
                raise ValueError("stat override keys must be strings")
            normalized_stat_key = stat_key.strip()
            if normalized_stat_key not in ALL_OVERRIDE_STAT_KEYS:
                raise ValueError(f"Unsupported stat override key '{normalized_stat_key}'")

            if normalized_stat_key == ARMOUR_SAVE_STAT_KEY:
                if stat_value is None:
                    cleaned_value = ""
                else:
                    cleaned_value = str(stat_value).strip()
                if len(cleaned_value) > 20:
                    raise ValueError("armour_save must be at most 20 characters")
                cleaned_stats[normalized_stat_key] = cleaned_value
                continue

            try:
                cleaned_value = int(stat_value)
            except (TypeError, ValueError):
                raise ValueError(f"stat override '{normalized_stat_key}' must be an integer")
            cleaned_stats[normalized_stat_key] = max(0, min(10, cleaned_value))

        if cleaned_stats or reason.strip():
            normalized[normalized_unit_key] = {
                "reason": reason.strip(),
                "stats": cleaned_stats,
            }
    return normalized


def _normalize_custom_units(raw_value):
    if raw_value is None:
        return []
    if not isinstance(raw_value, list):
        raise ValueError("custom_units_json must be a list")

    normalized = []
    seen_keys = set()
    for entry in raw_value:
        if not isinstance(entry, dict):
            raise ValueError("Each custom unit must be an object")

        key = entry.get("key")
        name = entry.get("name")
        unit_type = entry.get("unit_type")
        reason = entry.get("reason", "")
        rating = entry.get("rating", 0)
        stats = entry.get("stats")

        if not isinstance(key, str) or not key.strip():
            raise ValueError("custom unit key is required")
        key = key.strip()
        if not key.startswith("custom:"):
            raise ValueError("custom unit key must start with 'custom:'")
        if key in seen_keys:
            raise ValueError("custom unit keys must be unique")
        seen_keys.add(key)

        if not isinstance(name, str) or not name.strip():
            raise ValueError("custom unit name is required")
        name = name.strip()
        if len(name) > 120:
            raise ValueError("custom unit name must be at most 120 characters")

        if not isinstance(unit_type, str) or not unit_type.strip():
            raise ValueError("custom unit unit_type is required")
        unit_type = unit_type.strip()
        if len(unit_type) > 120:
            raise ValueError("custom unit unit_type must be at most 120 characters")

        if not isinstance(reason, str):
            raise ValueError("custom unit reason must be a string")
        reason = reason.strip()
        if len(reason) > 160:
            raise ValueError("custom unit reason must be at most 160 characters")

        try:
            rating = int(rating)
        except (TypeError, ValueError):
            raise ValueError("custom unit rating must be an integer")
        rating = max(0, min(9999, rating))

        if not isinstance(stats, dict):
            raise ValueError("custom unit stats must be an object")

        cleaned_stats = {}
        for stat_key in NUMERIC_STAT_KEYS:
            raw_stat = stats.get(stat_key, 0)
            try:
                parsed = int(raw_stat)
            except (TypeError, ValueError):
                raise ValueError(f"custom unit stat '{stat_key}' must be an integer")
            cleaned_stats[stat_key] = max(0, min(10, parsed))

        armour_save = stats.get(ARMOUR_SAVE_STAT_KEY, "")
        if armour_save is None:
            armour_save = ""
        if not isinstance(armour_save, str):
            armour_save = str(armour_save)
        armour_save = armour_save.strip()
        if len(armour_save) > 20:
            raise ValueError("custom unit armour_save must be at most 20 characters")
        cleaned_stats[ARMOUR_SAVE_STAT_KEY] = armour_save

        normalized.append(
            {
                "key": key,
                "name": name,
                "unit_type": unit_type,
                "reason": reason,
                "rating": rating,
                "stats": cleaned_stats,
            }
        )

    return normalized


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

        raw_title = request.data.get("title", "")
        if raw_title is None:
            raw_title = ""
        if not isinstance(raw_title, str):
            return Response({"detail": "title must be a string"}, status=400)
        title = raw_title.strip()
        if len(title) > 160:
            return Response({"detail": "title must be at most 160 characters"}, status=400)

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
                CampaignMembership.objects.filter(campaign_id=campaign_id).values_list(
                    "user_id", flat=True
                )
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
            CampaignMembership.objects.filter(
                campaign_id=campaign_id, user_id__in=participant_user_ids
            ).values_list("user_id", flat=True)
        )
        if campaign_user_ids != set(participant_user_ids):
            return Response({"detail": "One or more participants are not in this campaign"}, status=400)

        warbands = {
            warband.user_id: warband
            for warband in Warband.objects.filter(
                campaign_id=campaign_id, user_id__in=participant_user_ids
            ).only("id", "name", "user_id")
        }
        missing_warbands = [user_id for user_id in participant_user_ids if user_id not in warbands]
        if missing_warbands:
            return Response({"detail": "All participants need a warband"}, status=400)

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
                parsed_rating = int(raw_rating)
            except (TypeError, ValueError):
                return Response({"detail": f"Invalid rating for user {user_id}"}, status=400)
            if parsed_rating < 0:
                return Response(
                    {"detail": f"Rating must be zero or greater for user {user_id}"},
                    status=400,
                )
            participant_ratings[user_id] = parsed_rating

        events = []
        with transaction.atomic():
            battle = Battle.objects.create(
                campaign_id=campaign_id,
                created_by_user=request.user,
                status=Battle.STATUS_INVITING,
                title=title,
                scenario=scenario,
                settings_json=settings_json,
            )
            events.append(
                _append_battle_event(
                    battle,
                    BattleEvent.TYPE_BATTLE_CREATED,
                    actor_user=request.user,
                    payload={
                        "title": title,
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
                            BattleParticipant.STATUS_ACCEPTED
                            if is_creator
                            else BattleParticipant.STATUS_INVITED
                        ),
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
                            "title": title,
                            "scenario": scenario,
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
        events = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(
                campaign_id, battle_id, request.user, for_update=True
            )
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
                custom_units_raw = (
                    request.data.get("custom_units_json")
                    if "custom_units_json" in request.data
                    else participant.custom_units_json
                )

                selected_unit_keys = _normalize_unit_keys(selected_unit_keys_raw)
                stat_overrides = _normalize_stat_overrides(stat_overrides_raw)
                custom_units = _normalize_custom_units(custom_units_raw)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=400)

            participant.selected_unit_keys_json = selected_unit_keys
            participant.stat_overrides_json = stat_overrides
            participant.custom_units_json = custom_units
            participant.save(
                update_fields=[
                    "selected_unit_keys_json",
                    "stat_overrides_json",
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
        events = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(
                campaign_id, battle_id, request.user, for_update=True
            )
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
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
                        participant.save(
                            update_fields=["status", "battle_joined_at", "updated_at"]
                        )
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

        events = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(
                campaign_id, battle_id, request.user, for_update=True
            )
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
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
        events = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(
                campaign_id, battle_id, request.user, for_update=True
            )
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
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
                participant.save(
                    update_fields=["status", "canceled_at", "responded_at", "updated_at"]
                )
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
        events = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(
                campaign_id, battle_id, request.user, for_update=True
            )
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.created_by_user_id != request.user.id:
                return Response({"detail": "Only the battle creator can cancel this battle"}, status=403)
            if battle.status in (Battle.STATUS_ACTIVE, Battle.STATUS_POSTBATTLE, Battle.STATUS_ENDED):
                return Response({"detail": "Cannot cancel during or after battle"}, status=400)
            if battle.status == Battle.STATUS_CANCELED:
                return _response_with_snapshot(battle.id, events)

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
        events = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(
                campaign_id, battle_id, request.user, for_update=True
            )
            if not battle or not participant:
                return Response({"detail": "Not found"}, status=404)
            if battle.created_by_user_id != request.user.id:
                return Response({"detail": "Only the battle creator can start this battle"}, status=403)
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

            participants = list(
                BattleParticipant.objects.select_for_update().filter(battle_id=battle.id)
            )
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
            if unit_type == "custom":
                killer_unit_key = payload_json.get("killer_unit_key")
                if not isinstance(killer_unit_key, str) or not killer_unit_key.strip():
                    return Response({"detail": "killer_unit_key is required for custom units"}, status=400)
                payload_json["killer_unit_key"] = killer_unit_key.strip()
                payload_json.pop("killer_unit_id", None)
            else:
                try:
                    killer_unit_id = int(payload_json.get("killer_unit_id"))
                except (TypeError, ValueError):
                    return Response({"detail": "killer_unit_id is required"}, status=400)
                if killer_unit_id <= 0:
                    return Response({"detail": "killer_unit_id is required"}, status=400)
                payload_json["killer_unit_id"] = killer_unit_id

        with transaction.atomic():
            battle, participant = _get_user_battle_participant(
                campaign_id, battle_id, request.user, for_update=True
            )
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


class CampaignBattleFinishView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, campaign_id, battle_id):
        events = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(
                campaign_id, battle_id, request.user, for_update=True
            )
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

        events = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(
                campaign_id, battle_id, request.user, for_update=True
            )
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
                BattleParticipant.objects.filter(battle_id=battle.id).values_list(
                    "warband_id", flat=True
                )
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
        events = []
        with transaction.atomic():
            battle, participant = _get_user_battle_participant(
                campaign_id, battle_id, request.user, for_update=True
            )
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
