from collections import defaultdict

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.response import Response

from apps.campaigns.permissions import get_membership
from apps.realtime.services import (
    get_battle_channel_name,
    send_battle_event,
    send_user_notification,
)
from apps.warbands.models import Hero, Henchman, HiredSword

from ..models import Battle, BattleEvent, BattleParticipant

KILLER_UNIT_TYPES = {"hero", "hired_sword", "henchman", "custom", "bestiary"}
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
        "unit_information_json": participant.unit_information_json or {},
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
        type__in=(
            BattleEvent.TYPE_KILL_RECORDED,
            BattleEvent.TYPE_UNIT_KILL_RECORDED,
        ),
    ).values_list("type", "payload_json")

    for event_type, payload in kill_events:
        if not isinstance(payload, dict):
            continue
        if event_type == BattleEvent.TYPE_UNIT_KILL_RECORDED:
            killer_payload = payload.get("killer", {})
            if not isinstance(killer_payload, dict):
                continue
            unit_type = str(killer_payload.get("unit_type", "")).strip().lower()
            unit_id = killer_payload.get("unit_id")
        else:
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


def _normalize_unit_information(raw_value):
    if raw_value is None:
        return {}
    if not isinstance(raw_value, dict):
        raise ValueError("unit_information_json must be an object")

    normalized = {}
    for unit_key, info in raw_value.items():
        if not isinstance(unit_key, str):
            raise ValueError("unit_information_json keys must be strings")
        if not isinstance(info, dict):
            raise ValueError("Each unit information entry must be an object")

        normalized_unit_key = unit_key.strip()
        if not normalized_unit_key:
            continue

        stats_override = info.get("stats_override", {})
        if stats_override is None:
            stats_override = {}
        if not isinstance(stats_override, dict):
            raise ValueError("unit information stats_override must be an object")

        cleaned_stats = {}
        for stat_key, stat_value in stats_override.items():
            if not isinstance(stat_key, str):
                raise ValueError("unit information stat keys must be strings")
            normalized_stat_key = stat_key.strip()
            if normalized_stat_key not in ALL_OVERRIDE_STAT_KEYS:
                raise ValueError(f"Unsupported unit information stat key '{normalized_stat_key}'")

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
                raise ValueError(f"unit information stat '{normalized_stat_key}' must be an integer")
            cleaned_stats[normalized_stat_key] = max(0, min(10, cleaned_value))

        stats_reason = info.get("stats_reason", "")
        if stats_reason is None:
            stats_reason = ""
        if not isinstance(stats_reason, str):
            raise ValueError("unit information stats_reason must be a string")
        stats_reason = stats_reason.strip()
        if len(stats_reason) > 160:
            raise ValueError("unit information stats_reason must be at most 160 characters")

        out_of_action = bool(info.get("out_of_action", False))

        kill_count = info.get("kill_count", 0)
        try:
            kill_count = int(kill_count)
        except (TypeError, ValueError):
            raise ValueError("unit information kill_count must be an integer")
        kill_count = max(0, min(9999, kill_count))

        normalized[normalized_unit_key] = {
            "stats_override": cleaned_stats,
            "stats_reason": stats_reason,
            "out_of_action": out_of_action,
            "kill_count": kill_count,
        }

    return normalized


def _upsert_unit_information(
    unit_information: dict[str, dict], unit_key: str, *, preserve_existing=True
) -> dict:
    existing = unit_information.get(unit_key, {}) if preserve_existing else {}
    if not isinstance(existing, dict):
        existing = {}
    try:
        existing_kill_count = int(existing.get("kill_count", 0) or 0)
    except (TypeError, ValueError):
        existing_kill_count = 0
    merged = {
        "stats_override": existing.get("stats_override", {}),
        "stats_reason": existing.get("stats_reason", ""),
        "out_of_action": bool(existing.get("out_of_action", False)),
        "kill_count": max(0, existing_kill_count),
    }
    unit_information[unit_key] = merged
    return merged


def _sync_unit_information_from_stat_overrides(unit_information: dict, stat_overrides: dict) -> dict:
    next_info = dict(unit_information)
    override_keys = set(stat_overrides.keys())

    for unit_key, override in stat_overrides.items():
        entry = _upsert_unit_information(next_info, unit_key)
        entry["stats_override"] = dict(override.get("stats", {}))
        entry["stats_reason"] = str(override.get("reason", "")).strip()

    for unit_key in list(next_info.keys()):
        if unit_key in override_keys:
            continue
        entry = _upsert_unit_information(next_info, unit_key)
        entry["stats_override"] = {}
        entry["stats_reason"] = ""
        if (
            not entry["stats_override"]
            and not entry["stats_reason"]
            and not entry["out_of_action"]
            and entry["kill_count"] == 0
        ):
            next_info.pop(unit_key, None)

    return next_info


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
        if not key.startswith("custom:") and not key.startswith("bestiary:"):
            raise ValueError("custom unit key must start with 'custom:' or 'bestiary:'")
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


def _participant_custom_unit_keys(participant: BattleParticipant) -> set[str]:
    custom_units = participant.custom_units_json or []
    keys = set()
    if not isinstance(custom_units, list):
        return keys
    for entry in custom_units:
        if not isinstance(entry, dict):
            continue
        key = entry.get("key")
        if isinstance(key, str) and key.strip():
            keys.add(key.strip())
    return keys


def _participant_selected_unit_keys(participant: BattleParticipant) -> set[str]:
    selected = participant.selected_unit_keys_json or []
    if not isinstance(selected, list):
        return set()
    selected_keys = set()
    custom_keys = _participant_custom_unit_keys(participant)
    for raw_key in selected:
        if not isinstance(raw_key, str):
            continue
        key = raw_key.strip()
        if not key:
            continue
        if (key.startswith("custom:") or key.startswith("bestiary:")) and key not in custom_keys:
            continue
        selected_keys.add(key)
    return selected_keys


def _parse_unit_key(unit_key: str):
    if not isinstance(unit_key, str):
        raise ValueError("unit_key must be a string")
    normalized = unit_key.strip()
    if not normalized:
        raise ValueError("unit_key is required")
    if ":" not in normalized:
        raise ValueError("unit_key must use <type>:<id> format")

    unit_type, raw_identifier = normalized.split(":", 1)
    unit_type = unit_type.strip().lower()
    raw_identifier = raw_identifier.strip()
    if not unit_type or not raw_identifier:
        raise ValueError("unit_key must use <type>:<id> format")
    if unit_type not in {"hero", "henchman", "hired_sword", "custom", "bestiary"}:
        raise ValueError("unit_key type is invalid")

    if unit_type in ("custom", "bestiary"):
        return {
            "unit_key": normalized,
            "unit_type": unit_type,
            "unit_id": None,
            "custom_key": normalized,
        }

    try:
        unit_id = int(raw_identifier)
    except (TypeError, ValueError):
        raise ValueError("unit_key id must be an integer")
    if unit_id <= 0:
        raise ValueError("unit_key id must be an integer")
    return {
        "unit_key": normalized,
        "unit_type": unit_type,
        "unit_id": unit_id,
        "custom_key": None,
    }


def _coerce_bool(value, *, field_name: str):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes"}:
            return True
        if lowered in {"false", "0", "no"}:
            return False
    raise ValueError(f"{field_name} must be true or false")
