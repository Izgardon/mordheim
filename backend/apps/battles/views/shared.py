from collections import defaultdict

from django.db import models
from django.db.models import F, Prefetch, prefetch_related_objects
from django.utils import timezone
from rest_framework.response import Response

from apps.campaigns.models import CampaignSettings
from apps.campaigns.permissions import get_membership
from apps.items.models import Item
from apps.logs.utils import log_warband_event
from apps.notifications.models import Notification
from apps.notifications.utils import resolve_notifications_for_reference
from apps.realtime.services import (
    get_battle_channel_name,
    send_user_notification,
    sender_socket_id,
)
from apps.special.models import Special
from apps.warbands.models import (
    Henchman,
    HenchmenGroup,
    HenchmenGroupItem,
    Hero,
    HeroItem,
    HeroSpecial,
    HiredSword,
    HiredSwordItem,
    LedgerAction,
    Warband,
    WarbandResource,
    not_dismissed,
    on_roster,
)
from apps.warbands.services import ledger
from apps.warbands.services.stash import add_costs
from apps.warbands.units.services.xp import XP_FIELDS, apply_xp_gain
from apps.warbands.utils.armour_save import ARMOUR_SAVE_ERROR, parse_armour_save
from apps.warbands.utils.leaders import ensure_single_living_leader

from ..models import Battle, BattleEvent, BattleParticipant
from ..services.broadcast import Changed, publish
from ..services.lifecycle import record_wins_and_losses
from ..services.unit_information import ARMOUR_SAVE_STAT_KEY, NUMERIC_STAT_KEYS, clean_editable_fields
from ..services.warnings import Warning, unit_left_warband

KILLER_UNIT_TYPES = {"hero", "hired_sword", "henchman", "custom", "bestiary"}
AGGREGATED_KILLER_UNIT_TYPES = {"hero", "hired_sword", "henchman"}
INGAME_EVENT_TYPES = {
    BattleEvent.TYPE_KILL_RECORDED,
    BattleEvent.TYPE_DEATH_RECORDED,
    BattleEvent.TYPE_ITEM_USED,
}


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
        "flow_type": battle.flow_type,
        "status": battle.status,
        "scenario": battle.scenario,
        "scenario_link": battle.scenario_link,
        "winner_warband_ids_json": battle.winner_warband_ids_json or [],
        "created_at": battle.created_at.isoformat(),
        "updated_at": battle.updated_at.isoformat(),
        "started_at": battle.started_at.isoformat() if battle.started_at else None,
        "ended_at": battle.ended_at.isoformat() if battle.ended_at else None,
        "post_processed_at": (battle.post_processed_at.isoformat() if battle.post_processed_at else None),
        "channel": get_battle_channel_name(battle.id),
        "state_version": battle.state_version,
    }


def _serialize_participant(participant: BattleParticipant, participant_view: str = "full") -> dict:
    payload = {
        "id": participant.id,
        "battle_id": participant.battle_id,
        "status": participant.status,
        "connection_state": participant.connection_state,
        "last_event_id": participant.last_event_id,
        "last_seen_at": participant.last_seen_at.isoformat() if participant.last_seen_at else None,
        "selected_unit_keys_json": participant.selected_unit_keys_json or [],
        "unit_information_json": participant.unit_information_json or {},
        "custom_units_json": participant.custom_units_json or [],
        "battle_notes": participant.battle_notes or "",
        "user": {
            "id": participant.user_id,
            "label": _display_name(participant.user),
        },
        "warband": {
            "id": participant.warband_id,
            "name": participant.warband.name,
        },
    }

    if participant_view == "active":
        return payload

    if participant_view in {"full", "prebattle", "postbattle"}:
        payload.update(
            {
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
                "skipped_postbattle": participant.skipped_postbattle,
            }
        )

    if participant_view in {"full", "prebattle"}:
        payload["declared_rating"] = participant.declared_rating

    if participant_view in {"full", "postbattle"}:
        payload["postbattle_json"] = participant.postbattle_json or {}

    return payload


def _serialize_event(event: BattleEvent) -> dict:
    return {
        "id": event.id,
        "battle_id": event.battle_id,
        "type": event.type,
        "actor_user_id": event.actor_user_id,
        "payload_json": event.payload_json or {},
        "created_at": event.created_at.isoformat(),
    }


def _participants_prefetch() -> Prefetch:
    """Prefetch everything _serialize_participant reads, so snapshots cost no extra queries."""
    return Prefetch(
        "participants",
        queryset=BattleParticipant.objects.select_related("user", "warband").defer("roster_json").order_by("id"),
    )


def _snapshot_from_battle(battle: Battle, participant_view: str = "full") -> dict:
    """Snapshot a battle loaded with _participants_prefetch()."""
    return {
        "battle": _serialize_battle(battle),
        "participants": [
            _serialize_participant(participant, participant_view) for participant in battle.participants.all()
        ],
    }


def _battle_snapshot(battle_id: int, participant_view: str = "full") -> dict:
    battle = Battle.objects.filter(id=battle_id).prefetch_related(_participants_prefetch()).first()
    if battle is None:
        return {"battle": None, "participants": []}
    return _snapshot_from_battle(battle, participant_view)


def _battle_state_payload(battle: Battle, since_event_id: int, participant_view: str = "full") -> dict:
    """State for an already-loaded battle: participants and new events, without re-reading the battle."""
    prefetch_related_objects([battle], _participants_prefetch())
    snapshot = _snapshot_from_battle(battle, participant_view)
    events = BattleEvent.objects.filter(battle_id=battle.id, id__gt=since_event_id).order_by("id")
    snapshot["events"] = [_serialize_event(event) for event in events]
    return snapshot


def _battle_item_entries_from_links(links, *, item_attr: str = "item") -> list[dict]:
    counts: dict[tuple[int, str], dict] = {}
    for link in links:
        item = getattr(link, item_attr, None)
        if not item or not item.id:
            continue
        key = (item.id, item.name)
        existing = counts.get(key)
        if existing is None:
            counts[key] = {
                "id": item.id,
                "name": item.name,
                "count": 1,
                "singleUse": bool(getattr(item, "single_use", False)),
            }
            continue
        existing["count"] += 1
        existing["singleUse"] = existing["singleUse"] or bool(getattr(item, "single_use", False))
    return sorted(counts.values(), key=lambda entry: (entry["name"], entry["id"]))


def _battle_detail_entries_from_links(links, *, attr_name: str) -> list[dict]:
    entries = []
    for link in links:
        entry = getattr(link, attr_name, None)
        if not entry or not entry.id:
            continue
        entries.append({"id": entry.id, "name": entry.name})
    return entries


def _battle_spell_entries_from_links(links) -> list[dict]:
    entries = []
    for link in links:
        spell = getattr(link, "spell", None)
        if not spell or not spell.id:
            continue
        entries.append({"id": spell.id, "name": spell.name, "dc": spell.dc})
    return entries


def _battle_unit_stats_payload(unit) -> dict:
    return {
        "movement": unit.movement,
        "weapon_skill": unit.weapon_skill,
        "ballistic_skill": unit.ballistic_skill,
        "strength": unit.strength,
        "toughness": unit.toughness,
        "wounds": unit.wounds,
        "initiative": unit.initiative,
        "attacks": unit.attacks,
        "leadership": unit.leadership,
        "armour_save": unit.armour_save,
    }


def _serialize_battle_hero_roster_entry(hero: Hero) -> dict:
    item_links = list(hero.hero_items.all())
    return {
        "key": f"hero:{hero.id}",
        "id": hero.id,
        "kind": "hero",
        "displayName": hero.name or f"Hero {hero.id}",
        "unitType": hero.unit_type or "Hero",
        "stats": _battle_unit_stats_payload(hero),
        "items": _battle_item_entries_from_links(item_links),
        "singleUseItems": [
            {"id": item["id"], "name": item["name"], "quantity": item["count"]}
            for item in _battle_item_entries_from_links(item_links)
            if item["singleUse"]
        ],
        "skills": _battle_detail_entries_from_links(hero.hero_skills.all(), attr_name="skill"),
        "spells": _battle_spell_entries_from_links(hero.hero_spells.all()),
        "specials": _battle_detail_entries_from_links(hero.hero_specials.all(), attr_name="special"),
    }


def _serialize_battle_hired_sword_roster_entry(hired_sword: HiredSword) -> dict:
    item_links = list(hired_sword.hired_sword_items.all())
    return {
        "key": f"hired_sword:{hired_sword.id}",
        "id": hired_sword.id,
        "kind": "hired_sword",
        "displayName": hired_sword.name or f"Hired Sword {hired_sword.id}",
        "unitType": hired_sword.unit_type or "Hired Sword",
        "stats": _battle_unit_stats_payload(hired_sword),
        "upkeepPrice": hired_sword.upkeep_price,
        "upkeepCostExpression": hired_sword.upkeep_cost_expression,
        "noLevelUps": bool(hired_sword.no_level_ups),
        "items": _battle_item_entries_from_links(item_links),
        "singleUseItems": [
            {"id": item["id"], "name": item["name"], "quantity": item["count"]}
            for item in _battle_item_entries_from_links(item_links)
            if item["singleUse"]
        ],
        "skills": _battle_detail_entries_from_links(hired_sword.hired_sword_skills.all(), attr_name="skill"),
        "spells": _battle_spell_entries_from_links(hired_sword.hired_sword_spells.all()),
        "specials": _battle_detail_entries_from_links(hired_sword.hired_sword_specials.all(), attr_name="special"),
    }


def _serialize_battle_henchmen_group_roster_entry(group: HenchmenGroup) -> dict:
    item_links = list(group.henchmen_group_items.all())
    items = _battle_item_entries_from_links(item_links)
    members = []
    for member in group.henchmen.all():
        members.append(
            {
                "key": f"henchman:{member.id}",
                "id": member.id,
                "kind": "henchman",
                "displayName": member.name or f"Henchman {member.id}",
                "unitType": group.unit_type or "Henchman",
                "stats": _battle_unit_stats_payload(group),
                "noLevelUps": bool(group.no_level_ups),
                "items": items,
                "singleUseItems": [
                    {"id": item["id"], "name": item["name"], "quantity": item["count"]}
                    for item in items
                    if item["singleUse"]
                ],
                "skills": _battle_detail_entries_from_links(group.henchmen_group_skills.all(), attr_name="skill"),
                "spells": [],
                "specials": _battle_detail_entries_from_links(
                    group.henchmen_group_specials.all(),
                    attr_name="special",
                ),
            }
        )
    return {
        "id": group.id,
        "name": group.name or f"Henchmen Group {group.id}",
        "unitType": group.unit_type or "Henchmen",
        "members": members,
    }


def _battle_rosters_payload(battle_id: int) -> dict:
    """Each participant's roster by user id: read live until the battle starts, then the snapshot `start/` stored,
    so a unit killed or dismissed on the sheet mid-battle stays in the battle (BUG-73, PERF-38)."""
    participants = list(BattleParticipant.objects.filter(battle_id=battle_id).order_by("id"))
    if participants and all(participant.roster_json is not None for participant in participants):
        return {str(participant.user_id): participant.roster_json for participant in participants}
    warband_ids = [participant.warband_id for participant in participants]
    if not warband_ids:
        return {}

    heroes_by_warband: defaultdict[int, list[dict]] = defaultdict(list)
    heroes = (
        on_roster(Hero.objects.filter(warband_id__in=warband_ids))
        .prefetch_related(
            "hero_items__item",
            "hero_skills__skill",
            "hero_specials__special",
            "hero_spells__spell",
        )
        .order_by("warband_id", "id")
    )
    for hero in heroes:
        heroes_by_warband[hero.warband_id].append(_serialize_battle_hero_roster_entry(hero))

    hired_swords_by_warband: defaultdict[int, list[dict]] = defaultdict(list)
    hired_swords = (
        on_roster(HiredSword.objects.filter(warband_id__in=warband_ids))
        .prefetch_related(
            "hired_sword_items__item",
            "hired_sword_skills__skill",
            "hired_sword_specials__special",
            "hired_sword_spells__spell",
        )
        .order_by("warband_id", "id")
    )
    for hired_sword in hired_swords:
        hired_swords_by_warband[hired_sword.warband_id].append(_serialize_battle_hired_sword_roster_entry(hired_sword))

    alive_henchmen_prefetch = models.Prefetch(
        "henchmen",
        queryset=on_roster(Henchman.objects.all()).order_by("id"),
    )
    henchmen_groups_by_warband: defaultdict[int, list[dict]] = defaultdict(list)
    henchmen_groups = (
        on_roster(HenchmenGroup.objects.filter(warband_id__in=warband_ids))
        .prefetch_related(
            "henchmen_group_items__item",
            "henchmen_group_skills__skill",
            "henchmen_group_specials__special",
            alive_henchmen_prefetch,
        )
        .order_by("warband_id", "id")
    )
    for group in henchmen_groups:
        henchmen_groups_by_warband[group.warband_id].append(_serialize_battle_henchmen_group_roster_entry(group))

    payload = {}
    for participant in participants:
        payload[str(participant.user_id)] = {
            "heroes": heroes_by_warband[participant.warband_id],
            "hiredSwords": hired_swords_by_warband[participant.warband_id],
            "henchmenGroups": henchmen_groups_by_warband[participant.warband_id],
        }
    return payload


def _append_battle_event(
    battle: Battle,
    event_type: str,
    actor_user=None,
    payload: dict | None = None,
) -> dict:
    """Add an event to the battle's timeline; the write broadcasts it after commit (_broadcast_response)."""
    event = BattleEvent.objects.create(
        battle=battle,
        actor_user=actor_user,
        type=event_type,
        payload_json=payload or {},
    )
    return _serialize_event(event)


def _notify_user(user_id: int, event: str, payload: dict) -> None:
    send_user_notification(user_id, event, payload)


def _cancel_battle_for_all_participants(
    battle: Battle,
    *,
    actor_user,
    mode: str,
) -> dict:
    now = timezone.now()
    battle.status = Battle.STATUS_CANCELED
    battle.ended_at = battle.ended_at or now
    battle.save(update_fields=["status", "ended_at", "updated_at"])

    participants = list(BattleParticipant.objects.select_for_update().filter(battle_id=battle.id))
    if battle.flow_type == Battle.FLOW_TYPE_NORMAL:
        for entry in participants:
            # a finished postbattle is a record, never rewritten (BUG-09; cancels refuse postbattle anyway)
            if entry.status in (
                BattleParticipant.STATUS_CANCELED_PREBATTLE,
                BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
            ):
                continue
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
        resolve_notifications_for_reference(Notification.TYPE_BATTLE_INVITE, str(battle.id))
    else:
        for entry in participants:
            update_fields = []
            if entry.status != BattleParticipant.STATUS_REPORTED_RESULT_DECLINED:
                entry.status = BattleParticipant.STATUS_REPORTED_RESULT_DECLINED
                update_fields.append("status")
            if entry.responded_at is None:
                entry.responded_at = now
                update_fields.append("responded_at")
            if update_fields:
                entry.save(update_fields=[*update_fields, "updated_at"])

        resolve_notifications_for_reference(Notification.TYPE_BATTLE_RESULT_REQUEST, str(battle.id))
        for user_id in [entry.user_id for entry in participants]:
            _notify_user(
                user_id,
                "battle_result_updated",
                {
                    "battle_id": battle.id,
                    "campaign_id": battle.campaign_id,
                    "status": battle.status,
                },
            )

    return _append_battle_event(
        battle,
        BattleEvent.TYPE_BATTLE_CANCELED,
        actor_user=actor_user,
        payload={"canceled_by_user_id": actor_user.id, "mode": mode},
    )


PRESENCE_REFRESH_SECONDS = 60


def _mark_participant_seen(participant: BattleParticipant) -> None:
    """Record presence from read requests at most once a minute.

    Every client refetches state on each battle event, so writing on every read turned
    reads into writes that could also wait behind a battle lock. Nothing reads these
    fields at finer granularity than "seen in the last minute".
    """
    now = timezone.now()
    last_seen = participant.last_seen_at
    if (
        participant.connection_state == BattleParticipant.CONNECTION_ONLINE
        and last_seen is not None
        and (now - last_seen).total_seconds() < PRESENCE_REFRESH_SECONDS
    ):
        return
    BattleParticipant.objects.filter(id=participant.id).update(
        connection_state=BattleParticipant.CONNECTION_ONLINE, last_seen_at=now
    )


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
        .defer("roster_json")
        .filter(battle_id=battle.id, user=user)
    )
    if for_update:
        participant_qs = participant_qs.select_for_update(of=("self",))  # not the user or warband rows (PERF-37)
    participant = participant_qs.first()
    return battle, participant


def _all_participants_ready(battle_id: int) -> bool:
    participants = BattleParticipant.objects.filter(battle_id=battle_id)
    return participants.exists() and not participants.exclude(status=BattleParticipant.STATUS_READY).exists()


def _all_participants_accepted(battle_id: int) -> bool:
    participants = BattleParticipant.objects.filter(battle_id=battle_id)
    return (
        participants.exists()
        and not participants.exclude(
            status__in=(
                BattleParticipant.STATUS_ACCEPTED,
                BattleParticipant.STATUS_JOINED_PREBATTLE,
                BattleParticipant.STATUS_READY,
            )
        ).exists()
    )


def _all_reported_result_participants_approved(battle_id: int) -> bool:
    participants = BattleParticipant.objects.filter(battle_id=battle_id)
    return (
        participants.exists()
        and not participants.exclude(status=BattleParticipant.STATUS_REPORTED_RESULT_APPROVED).exists()
    )


def _all_participants_canceled_prebattle(battle_id: int) -> bool:
    participants = BattleParticipant.objects.filter(battle_id=battle_id)
    return (
        participants.exists() and not participants.exclude(status=BattleParticipant.STATUS_CANCELED_PREBATTLE).exists()
    )


def _all_started_participants_finished(battle_id: int) -> bool:
    participants = BattleParticipant.objects.filter(battle_id=battle_id).exclude(
        status=BattleParticipant.STATUS_CANCELED_PREBATTLE
    )
    return (
        participants.exists()
        and not participants.exclude(
            status__in=(
                BattleParticipant.STATUS_FINISHED_BATTLE,
                BattleParticipant.STATUS_CONFIRMED_POSTBATTLE,
            )
        ).exists()
    )


def _all_started_participants_confirmed(battle_id: int) -> bool:
    participants = BattleParticipant.objects.filter(battle_id=battle_id).exclude(
        status=BattleParticipant.STATUS_CANCELED_PREBATTLE
    )
    return (
        participants.exists()
        and not participants.exclude(status=BattleParticipant.STATUS_CONFIRMED_POSTBATTLE).exists()
    )


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


def _participant_permanent_selected_unit_keys(participant: BattleParticipant) -> set[str]:
    return {
        key
        for key in _participant_selected_unit_keys(participant)
        if not key.startswith("custom:") and not key.startswith("bestiary:")
    }


def _apply_kill_aggregation(battle_id: int) -> None:
    totals: dict[str, defaultdict[int, int]] = {
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
        if unit_id is None:
            continue
        try:
            parsed_unit_id = int(unit_id)
        except (TypeError, ValueError):
            continue
        if parsed_unit_id <= 0:
            continue
        totals[unit_type][parsed_unit_id] += 1

    for unit_id, count in totals["hero"].items():
        Hero.objects.filter(id=unit_id).update(kills=F("kills") + count)
    for unit_id, count in totals["hired_sword"].items():
        HiredSword.objects.filter(id=unit_id).update(kills=F("kills") + count)
    for unit_id, count in totals["henchman"].items():
        Henchman.objects.filter(id=unit_id).update(kills=F("kills") + count)


def _finalize_battle(battle: Battle, actor_user, events: list[dict], **ended: object) -> None:
    """End the battle (the battle is locked; its status guards against a second end): wins and losses recorded
    once (decision 3), the battle_ended event (with `ended`, e.g. who closed postbattle) and pivotal moments."""
    if battle.status == Battle.STATUS_ENDED:
        return

    now = timezone.now()
    if not battle.post_processed_at:
        battle.post_processed_at = now

    battle.status = Battle.STATUS_ENDED
    battle.ended_at = battle.ended_at or now
    battle.save(update_fields=["status", "ended_at", "post_processed_at", "updated_at"])
    events.append(
        _append_battle_event(
            battle,
            BattleEvent.TYPE_BATTLE_ENDED,
            actor_user=actor_user,
            payload={"winner_warband_ids": battle.winner_warband_ids_json or [], **ended},
        )
    )
    record_wins_and_losses(battle)
    # trading actions were reset at End battle, once (BUG-122)
    from apps.campaigns.pivotal_moments import generate_pivotal_moments_for_battle

    generate_pivotal_moments_for_battle(battle)


def _commit_reported_result_battle(battle: Battle) -> None:
    participants = list(
        BattleParticipant.objects.select_related("warband")
        .filter(battle_id=battle.id)
        .exclude(status=BattleParticipant.STATUS_REPORTED_RESULT_DECLINED)
        .order_by("id")
    )
    record_wins_and_losses(battle)  # none when nobody won (decision 8)
    for participant in participants:
        log_warband_event(
            participant.warband_id,
            "battle",
            "complete",
            _build_battle_complete_log_payload(battle, participant),
        )


def _battle_is_most_recent_for_warband(battle: Battle, warband_id: int) -> bool:
    latest_battle_id = (
        Battle.objects.filter(
            participants__warband_id=warband_id,
            status=Battle.STATUS_ENDED,
            ended_at__isnull=False,
        )
        .distinct()
        .order_by("-ended_at", "-created_at", "-id")
        .values_list("id", flat=True)
        .first()
    )
    return latest_battle_id == battle.id


def _reset_trading_actions_for_battle_participants(
    battle: Battle,
    *,
    only_if_most_recent: bool = False,
) -> None:
    participant_warband_ids = list(
        BattleParticipant.objects.filter(battle_id=battle.id)
        .exclude(
            status__in=(
                BattleParticipant.STATUS_CANCELED_PREBATTLE,
                BattleParticipant.STATUS_REPORTED_RESULT_DECLINED,
            )
        )
        .values_list("warband_id", flat=True)
    )
    for warband_id in dict.fromkeys(participant_warband_ids):
        if only_if_most_recent and not _battle_is_most_recent_for_warband(battle, warband_id):
            continue
        Hero.objects.filter(warband_id=warband_id).update(trading_action=True)


def _response_with_snapshot(battle_id: int, events: list[dict], response_status=200, warnings=None):
    """Answer with the fresh snapshot, broadcasting nothing (a write that changed nothing others see)."""
    payload = _battle_snapshot(battle_id)
    payload["events"] = events
    if warnings:
        payload["warnings"] = warnings
    return Response(payload, status=response_status)


def _broadcast_response(
    request,
    battle_id: int,
    events: list[dict],
    version: int,
    *,
    changed: Changed = (),
    reason: str = "",
    response_status=200,
    warnings=None,
):
    """Answer a write that raised the battle's state_version (`version`) with the fresh snapshot, and send its
    events, or a battle_state_updated, to the other players with the snapshots of the participants it `changed`
    (services/broadcast.py). Called after the write's transaction; the sends go out in the background."""
    payload = _battle_snapshot(battle_id)
    publish(
        payload,
        events,
        version=version,
        changed=changed,
        reason=reason,
        actor_user_id=request.user.id,
        socket_id=sender_socket_id(request),
    )
    payload["events"] = events
    if warnings:
        payload["warnings"] = warnings
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


def _normalize_battle_notes(raw_value):
    if raw_value is None:
        return ""
    if not isinstance(raw_value, str):
        raw_value = str(raw_value)
    return raw_value.strip()


def _normalize_unit_information(raw_value):
    """A stored unit information map with every entry's fields filled in (services/unit_information.py)."""
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

        try:
            kill_count = int(info.get("kill_count", 0))
        except (TypeError, ValueError):
            raise ValueError("unit information kill_count must be an integer") from None

        normalized[normalized_unit_key] = {
            **clean_editable_fields(info),
            "out_of_action": bool(info.get("out_of_action", False)),
            "kill_count": max(0, min(9999, kill_count)),
        }

    return normalized


def _upsert_unit_information(unit_information: dict[str, dict], unit_key: str, *, preserve_existing=True) -> dict:
    existing = unit_information.get(unit_key, {}) if preserve_existing else {}
    if not isinstance(existing, dict):
        existing = {}
    try:
        existing_kill_count = int(existing.get("kill_count", 0) or 0)
    except (TypeError, ValueError):
        existing_kill_count = 0
    merged = {
        "stats_override": existing.get("stats_override", {}),
        "notes": existing.get("notes", ""),
        "current_wounds": existing.get("current_wounds", None),
        "out_of_action": bool(existing.get("out_of_action", False)),
        "kill_count": max(0, existing_kill_count),
    }
    unit_information[unit_key] = merged
    return merged


def _parse_armour_save_override(value) -> int | None:
    """A postbattle armour save for the roster unit: as every unit write parses it (decision 11), "-" is none."""
    if value is None:
        return None
    cleaned = str(value).strip()
    if cleaned == "-":
        return None
    try:
        return parse_armour_save(cleaned)
    except ValueError:
        raise ValueError(f"unit information armour_save: {ARMOUR_SAVE_ERROR}") from None


def _apply_stats_override_to_unit(unit, stats_override: dict[str, int | str]) -> list[str]:
    update_fields: list[str] = []

    for stat_key in NUMERIC_STAT_KEYS:
        if stat_key not in stats_override:
            continue
        next_value = _coerce_int(stats_override.get(stat_key), field_name=stat_key, minimum=0, maximum=10)
        if getattr(unit, stat_key) != next_value:
            setattr(unit, stat_key, next_value)
            update_fields.append(stat_key)

    if ARMOUR_SAVE_STAT_KEY in stats_override:
        next_armour_save = _parse_armour_save_override(stats_override.get(ARMOUR_SAVE_STAT_KEY))
        if getattr(unit, ARMOUR_SAVE_STAT_KEY) != next_armour_save:
            setattr(unit, ARMOUR_SAVE_STAT_KEY, next_armour_save)
            update_fields.append(ARMOUR_SAVE_STAT_KEY)

    return update_fields


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

        try:
            rating = int(rating)
        except (TypeError, ValueError):
            raise ValueError("custom unit rating must be an integer") from None
        rating = max(0, min(9999, rating))

        if not isinstance(stats, dict):
            raise ValueError("custom unit stats must be an object")

        cleaned_stats: dict[str, int | str] = {}
        for stat_key in NUMERIC_STAT_KEYS:
            raw_stat = stats.get(stat_key, 0)
            try:
                parsed = int(raw_stat)
            except (TypeError, ValueError):
                raise ValueError(f"custom unit stat '{stat_key}' must be an integer") from None
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
                "rating": rating,
                "stats": cleaned_stats,
            }
        )

    return normalized


def _participant_custom_unit_keys(participant: BattleParticipant) -> set[str]:
    custom_units = participant.custom_units_json or []
    keys: set[str] = set()
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
        raise ValueError("unit_key id must be an integer") from None
    if unit_id <= 0:
        raise ValueError("unit_key id must be an integer")
    return {
        "unit_key": normalized,
        "unit_type": unit_type,
        "unit_id": unit_id,
        "custom_key": None,
    }


def _find_custom_unit_entry(participant: BattleParticipant, unit_key: str) -> dict | None:
    raw_custom_units = participant.custom_units_json if isinstance(participant.custom_units_json, list) else []
    for entry in raw_custom_units:
        if not isinstance(entry, dict):
            continue
        if str(entry.get("key", "")).strip() == unit_key:
            return entry
    return None


def _build_battle_unit_event_payload(participant: BattleParticipant, unit: dict) -> dict:
    payload = {
        "unit_key": unit["unit_key"],
        "unit_type": unit["unit_type"],
        "unit_id": unit["unit_id"],
        "warband_id": participant.warband_id,
        "name": None,
        "is_leader": False,
        "is_caster": False,
        "caster_type": None,
        "is_large": False,
    }

    if unit["unit_type"] == "hero":
        hero = Hero.objects.filter(id=unit["unit_id"], warband_id=participant.warband_id).first()
        if hero:
            payload["name"] = hero.name or None
            payload["is_leader"] = bool(hero.is_leader)
            payload["is_caster"] = hero.caster in {"Wizard", "Priest"}
            payload["caster_type"] = hero.caster if hero.caster in {"Wizard", "Priest"} else None
            payload["is_large"] = bool(hero.large)
        return payload

    if unit["unit_type"] == "hired_sword":
        hired_sword = HiredSword.objects.filter(id=unit["unit_id"], warband_id=participant.warband_id).first()
        if hired_sword:
            payload["name"] = hired_sword.name or None
            payload["is_caster"] = hired_sword.caster in {"Wizard", "Priest"}
            payload["caster_type"] = hired_sword.caster if hired_sword.caster in {"Wizard", "Priest"} else None
            payload["is_large"] = bool(hired_sword.large)
        return payload

    if unit["unit_type"] == "henchman":
        henchman = (
            Henchman.objects.select_related("group")
            .filter(id=unit["unit_id"], group__warband_id=participant.warband_id)
            .first()
        )
        if henchman:
            payload["name"] = henchman.name or None
            payload["is_large"] = bool(getattr(henchman.group, "large", False))
        return payload

    custom_unit = _find_custom_unit_entry(participant, unit["unit_key"])
    if custom_unit:
        payload["name"] = str(custom_unit.get("name", "")).strip() or None
    return payload


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


def _coerce_int(value, *, field_name: str, minimum: int = 0, maximum: int | None = None) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be an integer") from None
    parsed = max(minimum, parsed)
    if maximum is not None:
        parsed = min(maximum, parsed)
    return parsed


def _normalize_postbattle_json(raw_value):
    if raw_value is None:
        return {
            "exploration": {"dice_values": [], "resource_id": None},
            "finds": {"gold_crowns": 0, "items": []},
            "upkeep": {"pay_upkeep": True, "entries": {}},
            "unit_results": {},
        }
    if not isinstance(raw_value, dict):
        raise ValueError("postbattle_json must be an object")

    exploration_raw = raw_value.get("exploration", {})
    if exploration_raw is None:
        exploration_raw = {}
    if not isinstance(exploration_raw, dict):
        raise ValueError("postbattle exploration must be an object")

    dice_values_raw = exploration_raw.get("dice_values")
    if dice_values_raw is None:
        dice_values_raw = exploration_raw.get("dice", [])
    if dice_values_raw is None:
        dice_values_raw = []
    if not isinstance(dice_values_raw, list):
        raise ValueError("postbattle exploration dice_values must be a list")
    normalized_dice_values = []
    for entry in dice_values_raw:
        if isinstance(entry, dict):
            entry = entry.get("value", 1)
        normalized_dice_values.append(_coerce_int(entry, field_name="exploration die value", minimum=1, maximum=6))
    if len(normalized_dice_values) > 10:
        raise ValueError("postbattle exploration dice_values must contain at most 10 entries")

    resource_id = exploration_raw.get("resource_id")
    if resource_id in ("", None):
        resource_id = None
    elif resource_id is not None:
        resource_id = _coerce_int(resource_id, field_name="exploration resource_id", minimum=1)

    amount_override_raw = exploration_raw.get("amount_override")
    amount_override: int | None = None
    if amount_override_raw not in (None, ""):
        amount_override = _coerce_int(amount_override_raw, field_name="exploration amount_override", minimum=0)

    exploration = {
        "dice_values": normalized_dice_values,
        "resource_id": resource_id,
        "amount_override": amount_override,
    }

    finds_raw = raw_value.get("finds", {})
    if finds_raw is None:
        finds_raw = {}
    if not isinstance(finds_raw, dict):
        raise ValueError("postbattle finds must be an object")

    gold_crowns = _coerce_int(
        finds_raw.get("gold_crowns", 0),
        field_name="postbattle finds gold_crowns",
        minimum=0,
        maximum=999999,
    )
    find_items_raw = finds_raw.get("items", [])
    if find_items_raw is None:
        find_items_raw = []
    if not isinstance(find_items_raw, list):
        raise ValueError("postbattle finds items must be a list")

    finds_items = []
    for entry in find_items_raw:
        if not isinstance(entry, dict):
            raise ValueError("Each postbattle finds item must be an object")
        item_id = _coerce_int(entry.get("item_id"), field_name="postbattle finds item_id", minimum=1)
        item_name = entry.get("name", "")
        item_type = entry.get("type")
        if not isinstance(item_name, str):
            raise ValueError("postbattle finds item name must be a string")
        if item_type is not None and not isinstance(item_type, str):
            raise ValueError("postbattle finds item type must be a string or null")
        cost_raw = entry.get("cost")
        if cost_raw in ("", None):
            cost = None
        else:
            cost = _coerce_int(
                cost_raw,
                field_name="postbattle finds item cost",
                minimum=0,
                maximum=999999,
            )
        finds_items.append(
            {
                "item_id": item_id,
                "name": item_name.strip()[:255],
                "type": item_type.strip()[:80] if isinstance(item_type, str) else None,
                "cost": cost,
            }
        )

    finds = {
        "gold_crowns": gold_crowns,
        "items": finds_items,
    }

    upkeep_raw = raw_value.get("upkeep", {})
    if upkeep_raw is None:
        upkeep_raw = {}
    if not isinstance(upkeep_raw, dict):
        raise ValueError("postbattle upkeep must be an object")

    upkeep_entries_raw = upkeep_raw.get("entries", {})
    if upkeep_entries_raw is None:
        upkeep_entries_raw = {}
    if not isinstance(upkeep_entries_raw, dict):
        raise ValueError("postbattle upkeep entries must be an object")

    upkeep_entries = {}
    for unit_key, entry in upkeep_entries_raw.items():
        if not isinstance(unit_key, str) or not unit_key.strip():
            raise ValueError("postbattle upkeep entry keys must be strings")
        parsed_unit = _parse_unit_key(unit_key)
        if parsed_unit["unit_type"] != "hired_sword":
            continue
        if not isinstance(entry, dict):
            raise ValueError("Each postbattle upkeep entry must be an object")

        unit_name = entry.get("unit_name", "")
        if not isinstance(unit_name, str):
            raise ValueError("postbattle upkeep unit_name must be a string")

        cost_raw = entry.get("cost")
        if cost_raw in ("", None):
            cost = None
        else:
            cost = _coerce_int(
                cost_raw,
                field_name="postbattle upkeep cost",
                minimum=0,
                maximum=999999,
            )

        upkeep_entries[parsed_unit["unit_key"]] = {
            "unit_name": unit_name.strip()[:120],
            "cost": cost,
        }

    upkeep = {
        "pay_upkeep": bool(upkeep_raw.get("pay_upkeep", True)),
        "entries": upkeep_entries,
    }

    unit_results_raw = raw_value.get("unit_results", {})
    if unit_results_raw is None:
        unit_results_raw = {}
    if not isinstance(unit_results_raw, dict):
        raise ValueError("postbattle unit_results must be an object")

    unit_results = {}
    for unit_key, entry in unit_results_raw.items():
        if not isinstance(unit_key, str) or not unit_key.strip():
            raise ValueError("postbattle unit_result keys must be strings")
        parsed_unit = _parse_unit_key(unit_key)
        if parsed_unit["unit_type"] in {"custom", "bestiary"}:
            continue
        if not isinstance(entry, dict):
            raise ValueError("Each postbattle unit_result must be an object")

        unit_name = entry.get("unit_name", "")
        unit_kind = entry.get("unit_kind", parsed_unit["unit_type"])
        unit_type = entry.get("unit_type", parsed_unit["unit_type"])
        group_name = entry.get("group_name", "")
        if not isinstance(unit_name, str):
            raise ValueError("postbattle unit_name must be a string")
        if not isinstance(unit_kind, str):
            raise ValueError("postbattle unit_kind must be a string")
        if not isinstance(unit_type, str):
            raise ValueError("postbattle unit_type must be a string")
        if not isinstance(group_name, str):
            raise ValueError("postbattle group_name must be a string")

        special_ids_raw = entry.get("special_ids", [])
        if special_ids_raw is None:
            special_ids_raw = []
        if not isinstance(special_ids_raw, list):
            raise ValueError("postbattle special_ids must be a list")
        special_ids: list[int] = []
        for special_id in special_ids_raw:
            parsed_special_id = _coerce_int(special_id, field_name="postbattle special_id", minimum=1)
            if parsed_special_id not in special_ids:
                special_ids.append(parsed_special_id)

        serious_injury_rolls_raw = entry.get("serious_injury_rolls", entry.get("death_rolls", []))
        if serious_injury_rolls_raw is None:
            serious_injury_rolls_raw = []
        if not isinstance(serious_injury_rolls_raw, list):
            raise ValueError("postbattle serious_injury_rolls must be a list")
        serious_injury_rolls = []
        for roll in serious_injury_rolls_raw:
            if not isinstance(roll, dict):
                raise ValueError("Each serious_injury_roll must be an object")
            roll_type = str(roll.get("roll_type", "")).strip().lower()
            if roll_type not in {"d6", "d66", "d100"}:
                raise ValueError("serious_injury_roll roll_type is invalid")
            rolls_raw = roll.get("rolls", [])
            if not isinstance(rolls_raw, list):
                raise ValueError("serious_injury_roll rolls must be a list")
            roll_max = 100 if roll_type == "d100" else 6
            rolls = [
                _coerce_int(value, field_name="serious_injury_roll roll", minimum=1, maximum=roll_max)
                for value in rolls_raw
            ]
            if roll_type == "d6" and len(rolls) != 1:
                raise ValueError("d6 serious_injury_roll must have exactly one roll")
            if roll_type == "d66" and len(rolls) != 2:
                raise ValueError("d66 serious_injury_roll must have exactly two rolls")
            if roll_type == "d100" and len(rolls) != 1:
                raise ValueError("d100 serious_injury_roll must have exactly one roll")
            result_code = roll.get("result_code", "")
            result_label = roll.get("result_label", "")
            if not isinstance(result_code, str):
                raise ValueError("serious_injury_roll result_code must be a string")
            if not isinstance(result_label, str):
                raise ValueError("serious_injury_roll result_label must be a string")
            serious_injury_rolls.append(
                {
                    "roll_type": roll_type,
                    "rolls": rolls,
                    "result_code": result_code.strip(),
                    "result_label": result_label.strip(),
                    "dead_suggestion": bool(roll.get("dead_suggestion", False)),
                }
            )

        unit_results[parsed_unit["unit_key"]] = {
            "unit_name": unit_name.strip()[:120],
            "unit_kind": unit_kind.strip()[:40],
            "unit_type": unit_type.strip()[:120],
            "group_name": group_name.strip()[:120],
            "out_of_action": bool(entry.get("out_of_action", False)),
            "kill_count": _coerce_int(
                entry.get("kill_count", 0), field_name="postbattle kill_count", minimum=0, maximum=9999
            ),
            "xp_earned": _coerce_int(
                entry.get("xp_earned", 0), field_name="postbattle xp_earned", minimum=0, maximum=9999
            ),
            "dead": bool(entry.get("dead", False)),
            "special_ids": special_ids,
            "serious_injury_rolls": serious_injury_rolls,
        }

    return {
        "exploration": exploration,
        "finds": finds,
        "upkeep": upkeep,
        "unit_results": unit_results,
    }


def _exploration_resource_amount(dice_values: list[int]) -> int:
    total = sum(dice_values)
    if total <= 0:
        return 0
    if total <= 5:
        return 1
    if total <= 11:
        return 2
    if total <= 17:
        return 3
    if total <= 24:
        return 4
    if total <= 30:
        return 5
    if total <= 35:
        return 6
    return 7


def _resolve_find_item_cost(item: Item) -> int | None:
    costs = [availability.cost for availability in item.availabilities.all() if availability.cost is not None]
    if not costs:
        return None
    return int(min(costs))


def _add_stash_items(warband: Warband, item: Item, costs: list[int | None]) -> None:
    """Battle finds join the stash at their own cost (services/stash.py; BUG-117: nothing is re-priced)."""
    add_costs(warband.id, item.id, costs)


def _validate_postbattle_json_for_participant(
    battle: Battle,
    participant: BattleParticipant,
    postbattle_json: dict,
) -> dict:
    normalized: dict = _normalize_postbattle_json(postbattle_json)
    unit_results = normalized["unit_results"]
    hero_roll_type = (
        CampaignSettings.objects.filter(campaign_id=battle.campaign_id)
        .values_list("hero_death_roll", flat=True)
        .first()
        or "d66"
    )
    required_unit_keys = _participant_permanent_selected_unit_keys(participant)
    missing_keys = sorted(required_unit_keys - set(unit_results.keys()))
    if missing_keys:
        raise ValueError("postbattle unit_results are missing selected units")

    for unit_key, result in unit_results.items():
        parsed_unit = _parse_unit_key(unit_key)
        expected_roll_type = hero_roll_type if parsed_unit["unit_type"] == "hero" else "d6"
        for roll in result.get("serious_injury_rolls", []):
            if roll.get("roll_type") != expected_roll_type:
                raise ValueError(f"{parsed_unit['unit_type']} serious_injury_rolls must use {expected_roll_type}")

    special_ids = {special_id for entry in unit_results.values() for special_id in entry.get("special_ids", [])}
    if special_ids:
        special_map = {
            special.id: special
            for special in Special.objects.filter(id__in=special_ids).filter(
                models.Q(campaign_id__isnull=True) | models.Q(campaign_id=battle.campaign_id)
            )
        }
        if len(special_map) != len(special_ids):
            raise ValueError("One or more selected injury specials are invalid")

    resource_id = normalized["exploration"].get("resource_id")
    if (
        resource_id is not None
        and not WarbandResource.objects.filter(
            id=resource_id,
            warband_id=participant.warband_id,
        ).exists()
    ):
        raise ValueError("Selected exploration resource is invalid")

    upkeep_entry_keys = normalized.get("upkeep", {}).get("entries", {}).keys()
    upkeep_hired_sword_ids = []
    for unit_key in upkeep_entry_keys:
        parsed_unit = _parse_unit_key(unit_key)
        if parsed_unit["unit_type"] == "hired_sword" and parsed_unit["unit_id"] is not None:
            upkeep_hired_sword_ids.append(parsed_unit["unit_id"])

    if upkeep_hired_sword_ids:  # the warband's own; one dismissed since is charged nothing (BUG-73)
        valid_hired_sword_ids = set(
            HiredSword.objects.filter(id__in=upkeep_hired_sword_ids, warband_id=participant.warband_id).values_list(
                "id", flat=True
            )
        )
        if len(valid_hired_sword_ids) != len(set(upkeep_hired_sword_ids)):
            raise ValueError("One or more upkeep hired swords are invalid")

    return normalized


def _log_new_serious_injury_rolls(
    participant: BattleParticipant,
    previous_postbattle_json: dict | None,
    next_postbattle_json: dict,
) -> None:
    previous_normalized = _normalize_postbattle_json(previous_postbattle_json)
    next_normalized = _normalize_postbattle_json(next_postbattle_json)
    previous_unit_results = previous_normalized.get("unit_results", {})
    next_unit_results = next_normalized.get("unit_results", {})

    for unit_key, result in next_unit_results.items():
        previous_result = previous_unit_results.get(unit_key, {})
        previous_roll_count = len(previous_result.get("serious_injury_rolls", []))
        next_rolls = result.get("serious_injury_rolls", [])
        if len(next_rolls) <= previous_roll_count:
            continue
        unit_name = (result.get("unit_name") or unit_key)[:120]
        for roll in next_rolls[previous_roll_count:]:
            log_warband_event(
                participant.warband_id,
                "personnel",
                "serious_injury",
                {
                    "unit_name": unit_name,
                    "roll_type": roll.get("roll_type"),
                    "rolls": roll.get("rolls", []),
                    "result_code": roll.get("result_code"),
                    "result_label": roll.get("result_label"),
                    "dead_suggestion": bool(roll.get("dead_suggestion", False)),
                },
            )


def _build_battle_complete_log_payload(battle: Battle, participant: BattleParticipant) -> dict:
    participants = list(
        BattleParticipant.objects.select_related("warband")
        .filter(battle_id=battle.id)
        .exclude(
            status__in=(
                BattleParticipant.STATUS_CANCELED_PREBATTLE,
                BattleParticipant.STATUS_REPORTED_RESULT_DECLINED,
            )
        )
        .order_by("id")
    )
    winner_ids = set(battle.winner_warband_ids_json or [])
    participant_won = participant.warband_id in winner_ids
    others = [entry for entry in participants if entry.warband_id != participant.warband_id]
    if not winner_ids:  # "No winner" (decision 8): everyone fought everyone
        return {"result": "no_winner", "with": [], "against": [entry.warband.name for entry in others]}

    with_names: list[str] = []
    against_names: list[str] = []
    for entry in others:
        if (entry.warband_id in winner_ids) == participant_won:
            with_names.append(entry.warband.name)
        else:
            against_names.append(entry.warband.name)

    return {
        "result": "won" if participant_won else "lost",
        "with": with_names,
        "against": against_names,
    }


def _remove_used_single_use_items(battle: Battle, participant: BattleParticipant) -> None:
    usage_counts: defaultdict[tuple[str, int, int], int] = defaultdict(int)
    item_ids: set[int] = set()
    henchman_ids: set[int] = set()

    item_events = BattleEvent.objects.filter(
        battle_id=battle.id,
        actor_user_id=participant.user_id,
        type=BattleEvent.TYPE_ITEM_USED,
    ).values_list("payload_json", flat=True)

    for payload in item_events:
        if not isinstance(payload, dict):
            continue
        unit_key = payload.get("unit_key")
        item_id_raw = payload.get("item_id")
        if not isinstance(unit_key, str) or not unit_key.strip():
            continue
        try:
            item_id = _coerce_int(item_id_raw, field_name="item_id", minimum=1)
            parsed_unit = _parse_unit_key(unit_key)
        except ValueError:
            continue
        if parsed_unit["unit_type"] not in {"hero", "hired_sword", "henchman"}:
            continue
        unit_id = parsed_unit["unit_id"]
        if unit_id is None:
            continue
        usage_counts[(parsed_unit["unit_type"], unit_id, item_id)] += 1
        item_ids.add(item_id)
        if parsed_unit["unit_type"] == "henchman":
            henchman_ids.add(unit_id)

    if not usage_counts or not item_ids:
        return

    single_use_item_ids = set(Item.objects.filter(id__in=item_ids, single_use=True).values_list("id", flat=True))
    if not single_use_item_ids:
        return

    henchman_group_ids = {
        henchman_id: group_id
        for henchman_id, group_id in Henchman.objects.filter(
            id__in=henchman_ids,
            group__warband_id=participant.warband_id,
        ).values_list("id", "group_id")
    }

    for (unit_type, unit_id, item_id), count in usage_counts.items():
        if item_id not in single_use_item_ids or count <= 0:
            continue

        if unit_type == "hero":
            row_ids = list(
                HeroItem.objects.select_for_update(of=("self",))
                .filter(hero_id=unit_id, hero__warband_id=participant.warband_id, item_id=item_id)
                .order_by("id")
                .values_list("id", flat=True)[:count]
            )
            if row_ids:
                HeroItem.objects.filter(id__in=row_ids).delete()
            continue

        if unit_type == "hired_sword":
            row_ids = list(
                HiredSwordItem.objects.select_for_update(of=("self",))
                .filter(hired_sword_id=unit_id, hired_sword__warband_id=participant.warband_id, item_id=item_id)
                .order_by("id")
                .values_list("id", flat=True)[:count]
            )
            if row_ids:
                HiredSwordItem.objects.filter(id__in=row_ids).delete()
            continue

        if unit_type == "henchman":
            group_id = henchman_group_ids.get(unit_id)
            if not group_id:
                continue
            row_ids = list(
                HenchmenGroupItem.objects.select_for_update(of=("self",))
                .filter(
                    henchmen_group_id=group_id,
                    henchmen_group__warband_id=participant.warband_id,
                    item_id=item_id,
                )
                .order_by("id")
                .values_list("id", flat=True)[:count]
            )
            if row_ids:
                HenchmenGroupItem.objects.filter(id__in=row_ids).delete()


def _apply_participant_postbattle_results(
    battle: Battle, participant: BattleParticipant, postbattle_json: dict
) -> list[Warning]:
    """Apply a participant's postbattle; the warnings say which units were left out (BUG-73)."""
    normalized = _validate_postbattle_json_for_participant(battle, participant, postbattle_json)
    unit_information = _normalize_unit_information(participant.unit_information_json)
    unit_results = normalized["unit_results"]
    warband = Warband.objects.select_for_update().get(id=participant.warband_id)
    campaign_settings = CampaignSettings.objects.filter(campaign_id=battle.campaign_id).first()

    hero_ids = []
    hired_sword_ids = []
    henchman_ids = []
    for unit_key in unit_results.keys():
        parsed = _parse_unit_key(unit_key)
        if parsed["unit_type"] == "hero":
            hero_ids.append(parsed["unit_id"])
        elif parsed["unit_type"] == "hired_sword":
            hired_sword_ids.append(parsed["unit_id"])
        elif parsed["unit_type"] == "henchman":
            henchman_ids.append(parsed["unit_id"])

    # Units dismissed since the battle started have left the warband: left out below, with a warning (BUG-73).
    heroes = {
        hero.id: hero
        for hero in not_dismissed(
            Hero.objects.select_for_update().filter(id__in=hero_ids, warband_id=participant.warband_id)
        )
    }
    hired_swords = {
        hired_sword.id: hired_sword
        for hired_sword in not_dismissed(
            HiredSword.objects.select_for_update().filter(
                id__in=hired_sword_ids,
                warband_id=participant.warband_id,
            )
        )
    }
    henchmen = {
        henchman.id: henchman
        for henchman in not_dismissed(Henchman.objects.select_for_update(of=("self",)))
        .select_related("group")
        .filter(
            id__in=henchman_ids,
            group__warband_id=participant.warband_id,
            group__dismissed_at__isnull=True,
        )
    }
    henchmen_groups = {
        group.id: group
        for group in not_dismissed(
            HenchmenGroup.objects.select_for_update().filter(
                id__in={henchman.group_id for henchman in henchmen.values()},
                warband_id=participant.warband_id,
            )
        )
    }

    warnings: list[Warning] = []
    group_xp_by_id: dict[int, int] = {}
    group_stats_override_by_id: dict[int, dict[str, int | str]] = {}
    group_stats_update_fields_by_id: defaultdict[int, set[str]] = defaultdict(set)
    for unit_key, result in unit_results.items():
        parsed = _parse_unit_key(unit_key)
        info = unit_information.get(unit_key, {})
        stats_override = info.get("stats_override", {})
        kill_count = _coerce_int(info.get("kill_count", 0), field_name="kill_count", minimum=0, maximum=9999)
        xp_earned = _coerce_int(result.get("xp_earned", 0), field_name="xp_earned", minimum=0, maximum=9999)
        dead = bool(result.get("dead", False))
        unit_name = result.get("unit_name", "") or unit_key

        if parsed["unit_type"] == "hero":
            hero = heroes.get(parsed["unit_id"])
            if not hero:
                warnings.append(unit_left_warband(unit_key, unit_name))
                continue
            update_fields = _apply_stats_override_to_unit(hero, stats_override)
            if kill_count > 0:
                hero.kills += kill_count
                update_fields.append("kills")
            if apply_xp_gain(hero, xp_earned, campaign_settings):
                update_fields.extend(XP_FIELDS)
            if dead and not hero.dead:
                hero.dead = True
                update_fields.append("dead")
            if update_fields:
                hero.save(update_fields=[*dict.fromkeys(update_fields), "updated_at"])
            for special_id in result.get("special_ids", []):
                if not HeroSpecial.objects.filter(hero_id=hero.id, special_id=special_id).exists():
                    HeroSpecial.objects.create(hero_id=hero.id, special_id=special_id)
            continue

        if parsed["unit_type"] == "hired_sword":
            hired_sword = hired_swords.get(parsed["unit_id"])
            if not hired_sword:
                warnings.append(unit_left_warband(unit_key, unit_name))
                continue
            effective_xp_earned = 0 if hired_sword.no_level_ups else xp_earned
            update_fields = _apply_stats_override_to_unit(hired_sword, stats_override)
            if kill_count > 0:
                hired_sword.kills += kill_count
                update_fields.append("kills")
            if apply_xp_gain(hired_sword, effective_xp_earned, campaign_settings):
                update_fields.extend(XP_FIELDS)
            if dead and not hired_sword.dead:
                hired_sword.dead = True
                update_fields.append("dead")
            if update_fields:
                hired_sword.save(update_fields=[*dict.fromkeys(update_fields), "updated_at"])
            continue

        if parsed["unit_type"] == "henchman":
            henchman = henchmen.get(parsed["unit_id"])
            group = henchmen_groups.get(henchman.group_id) if henchman else None
            if not henchman or not group:  # he, or his whole group, was dismissed
                warnings.append(unit_left_warband(unit_key, unit_name))
                continue
            effective_xp_earned = 0 if group.no_level_ups else xp_earned
            if stats_override:
                existing_group_stats = group_stats_override_by_id.get(henchman.group_id)
                if existing_group_stats is None:
                    group_stats_override_by_id[henchman.group_id] = stats_override
                elif existing_group_stats != stats_override:
                    raise ValueError("All henchmen in a group must share the same stat overrides")
                group_stats_update_fields_by_id[henchman.group_id].update(
                    _apply_stats_override_to_unit(group, stats_override)
                )
            if kill_count > 0:
                henchman.kills += kill_count
            if dead and not henchman.dead:
                henchman.dead = True
            henchman.save(update_fields=["kills", "dead"])
            existing_group_xp = group_xp_by_id.get(henchman.group_id)
            if existing_group_xp is None:
                group_xp_by_id[henchman.group_id] = effective_xp_earned
            elif existing_group_xp != effective_xp_earned:
                raise ValueError("All henchmen in a group must share the same xp_earned value")

    ensure_single_living_leader(participant.warband_id)

    for group_id, group in henchmen_groups.items():
        xp_earned = 0 if group.no_level_ups else group_xp_by_id.get(group_id, 0)
        update_fields = list(group_stats_update_fields_by_id.get(group_id, set()))
        if apply_xp_gain(group, xp_earned, campaign_settings):
            update_fields.extend(XP_FIELDS)
        all_group_members_dead = not on_roster(Henchman.objects.filter(group_id=group_id)).exists()
        if all_group_members_dead != group.dead:
            group.dead = all_group_members_dead
            update_fields.append("dead")
        if update_fields:
            group.save(update_fields=[*dict.fromkeys(update_fields), "updated_at"])

    exploration = normalized["exploration"]
    resource_id = exploration.get("resource_id")
    dice_values = exploration.get("dice_values", [])
    amount_override = exploration.get("amount_override")
    resource_amount = amount_override if amount_override is not None else _exploration_resource_amount(dice_values)
    if resource_id is not None and resource_amount > 0:
        resource = (
            WarbandResource.objects.select_for_update()
            .filter(
                id=resource_id,
                warband_id=participant.warband_id,
            )
            .first()
        )
        if not resource:
            raise ValueError("Selected exploration resource is invalid")
        resource.amount += resource_amount
        resource.save(update_fields=["amount"])

    upkeep = normalized.get("upkeep", {})
    if upkeep.get("pay_upkeep", True):
        upkeep_entries = upkeep.get("entries", {})
        upkeep_hired_sword_ids = []
        for unit_key in upkeep_entries.keys():
            parsed_unit = _parse_unit_key(unit_key)
            if parsed_unit["unit_type"] == "hired_sword" and parsed_unit["unit_id"] is not None:
                upkeep_hired_sword_ids.append(parsed_unit["unit_id"])

        active_upkeep_hired_swords = {
            hired_sword.id: hired_sword
            for hired_sword in on_roster(
                HiredSword.objects.select_for_update().filter(
                    id__in=upkeep_hired_sword_ids,
                    warband_id=participant.warband_id,
                )
            )
        }
        upkeep_total = 0
        upkeep_note_lines: list[str] = []
        for unit_key, entry in upkeep_entries.items():
            parsed_unit = _parse_unit_key(unit_key)
            if parsed_unit["unit_type"] != "hired_sword":
                continue
            hired_sword = active_upkeep_hired_swords.get(parsed_unit["unit_id"])
            if not hired_sword:
                continue
            cost = entry.get("cost")
            if cost is None:
                continue
            normalized_cost = _coerce_int(
                cost,
                field_name="postbattle upkeep cost",
                minimum=0,
                maximum=999999,
            )
            upkeep_total += normalized_cost
            unit_name = (entry.get("unit_name") or hired_sword.name or unit_key)[:120]
            upkeep_note_lines.append(f"{unit_name}: {normalized_cost} gc")

        if upkeep_total > 0:
            notes = "\n".join(upkeep_note_lines)
            ledger.record(warband, LedgerAction.UPKEEP, -upkeep_total, "Post-battle upkeep", notes=notes)

    finds = normalized.get("finds", {"gold_crowns": 0, "items": []})
    finds_gold_crowns = _coerce_int(
        finds.get("gold_crowns", 0),
        field_name="postbattle finds gold_crowns",
        minimum=0,
        maximum=999999,
    )
    finds_items = finds.get("items", [])
    canonical_find_items: list[dict] = []
    if finds_items:
        requested_item_ids = [
            _coerce_int(entry.get("item_id"), field_name="postbattle finds item_id", minimum=1) for entry in finds_items
        ]
        available_items = {
            item.id: item
            for item in Item.objects.filter(id__in=requested_item_ids)
            .filter(models.Q(campaign_id__isnull=True) | models.Q(campaign_id=battle.campaign_id))
            .prefetch_related("availabilities")
        }
        stash_costs_by_item_id: defaultdict[int, list[int | None]] = defaultdict(list)
        for item_id in requested_item_ids:
            item = available_items.get(item_id)
            if not item:
                raise ValueError("One or more found items are no longer available")
            base_cost = _resolve_find_item_cost(item)
            if base_cost is None:
                raise ValueError("One or more found items no longer have an available cost")
            stash_costs_by_item_id[item.id].append(base_cost)
            canonical_find_items.append(
                {
                    "item_id": item.id,
                    "name": item.name,
                    "type": item.type,
                    "cost": base_cost,
                }
            )
        for item_id, costs in stash_costs_by_item_id.items():
            _add_stash_items(warband, available_items[item_id], costs)

    if finds_gold_crowns > 0:
        notes = f"Postbattle finds from {battle.scenario}"[:2000]
        ledger.record(warband, LedgerAction.REWARD, finds_gold_crowns, "Battle reward", notes=notes)

    _remove_used_single_use_items(battle, participant)

    log_warband_event(
        participant.warband_id,
        "battle",
        "complete",
        _build_battle_complete_log_payload(battle, participant),
    )
    log_warband_event(
        participant.warband_id,
        "battle",
        "exploration",
        {
            "dice": dice_values,
        },
    )
    if finds_gold_crowns > 0 or canonical_find_items:
        log_warband_event(
            participant.warband_id,
            "battle",
            "finds",
            {
                "gold_crowns": finds_gold_crowns,
                "items": canonical_find_items,
            },
        )
    return warnings
