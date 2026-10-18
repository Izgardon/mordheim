from collections import defaultdict

from django.db import models
from django.utils import timezone

from apps.campaigns.models import CampaignSettings
from apps.campaigns.permissions import get_membership
from apps.items.models import Item
from apps.logs.utils import log_warband_event
from apps.notifications.models import Notification
from apps.notifications.utils import resolve_notifications_for_reference
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
from apps.warbands.utils.leaders import ensure_single_living_leader

from ..models import Battle, BattleEvent, BattleParticipant
from ..services.events import append_event, notify_user
from ..services.exploration import exploration_amount
from ..services.injuries import apply_stat_and_special, injury_outcome
from ..services.items_lost import carried_item_names, henchman_takes_his_share, lost_entry
from ..services.kills import kill_counts_by_unit
from ..services.lifecycle import participants_all_in, record_wins_and_losses
from ..services.selection import custom_unit_entry, permanent_unit_keys
from ..services.timing import is_overdue
from ..services.unit_information import (
    ARMOUR_SAVE_STAT_KEY,
    NUMERIC_STAT_KEYS,
    parse_armour_save_override,
)
from ..services.unusual import unusual_value_warnings
from ..services.warnings import Warning, unit_left_warband
from ..validation.coerce import coerce_int
from ..validation.config import normalize_unit_information
from ..validation.postbattle import normalize_postbattle
from ..validation.unit_keys import parse_unit_key

KILLER_UNIT_TYPES = {"hero", "hired_sword", "henchman", "custom", "bestiary"}
INGAME_EVENT_TYPES = {
    BattleEvent.TYPE_KILL_RECORDED,
    BattleEvent.TYPE_DEATH_RECORDED,
    BattleEvent.TYPE_ITEM_USED,
}


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
            if entry.status in (*BattleParticipant.LEFT_STATUSES, BattleParticipant.STATUS_CONFIRMED_POSTBATTLE):
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
            notify_user(
                user_id,
                "battle_result_updated",
                {
                    "battle_id": battle.id,
                    "campaign_id": battle.campaign_id,
                    "status": battle.status,
                },
            )

    return append_event(
        battle,
        BattleEvent.TYPE_BATTLE_CANCELED,
        actor_user=actor_user,
        payload={"canceled_by_user_id": actor_user.id if actor_user else None, "mode": mode},
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
    if for_update and is_overdue(battle):  # a write to an overdue battle settles it first (decision 2)
        from .expiry import settle_during_write

        settle_during_write(battle)
    participant = participant_qs.first()
    return battle, participant


def _all_participants_ready(battle_id: int) -> bool:
    headcount = participants_all_in(battle_id)
    return headcount.total > 0 and headcount.ready == headcount.total


def _all_participants_accepted(battle_id: int) -> bool:
    headcount = participants_all_in(battle_id)
    return headcount.total > 0 and headcount.accepted == headcount.total


def _all_reported_result_participants_approved(battle_id: int) -> bool:
    participants = BattleParticipant.objects.filter(battle_id=battle_id)
    return (
        participants.exists()
        and not participants.exclude(status=BattleParticipant.STATUS_REPORTED_RESULT_APPROVED).exists()
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
        status__in=BattleParticipant.LEFT_STATUSES
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
        append_event(
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
        .exclude(status__in=BattleParticipant.LEFT_STATUSES)
        .values_list("warband_id", flat=True)
    )
    for warband_id in dict.fromkeys(participant_warband_ids):
        if only_if_most_recent and not _battle_is_most_recent_for_warband(battle, warband_id):
            continue
        Hero.objects.filter(warband_id=warband_id).update(trading_action=True)


def _kept_stats(unit, stats_override: dict[str, int | str], unit_name: str, stat_logs: list[dict]) -> list[str]:
    """Make a unit's battle stat changes permanent (its Keep tick, decision 6, SEC-10) and log them with before and
    after; returns the changed fields."""
    before = {key: getattr(unit, key) for key in (*NUMERIC_STAT_KEYS, ARMOUR_SAVE_STAT_KEY)}
    fields = _apply_stats_override_to_unit(unit, stats_override)
    if fields:
        changes = {field: {"before": before[field], "after": getattr(unit, field)} for field in fields}
        stat_logs.append({"unit_name": unit_name, "changes": changes})
    return fields


def _apply_stats_override_to_unit(unit, stats_override: dict[str, int | str]) -> list[str]:
    update_fields: list[str] = []

    for stat_key in NUMERIC_STAT_KEYS:
        if stat_key not in stats_override:
            continue
        next_value = coerce_int(stats_override.get(stat_key), field_name=stat_key, minimum=0, maximum=10)
        if getattr(unit, stat_key) != next_value:
            setattr(unit, stat_key, next_value)
            update_fields.append(stat_key)

    if ARMOUR_SAVE_STAT_KEY in stats_override:
        next_armour_save = parse_armour_save_override(stats_override.get(ARMOUR_SAVE_STAT_KEY))
        if getattr(unit, ARMOUR_SAVE_STAT_KEY) != next_armour_save:
            setattr(unit, ARMOUR_SAVE_STAT_KEY, next_armour_save)
            update_fields.append(ARMOUR_SAVE_STAT_KEY)

    return update_fields


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

    custom_unit = custom_unit_entry(participant, unit["unit_key"])
    if custom_unit:
        payload["name"] = str(custom_unit.get("name", "")).strip() or None
    return payload


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
    normalized: dict = normalize_postbattle(postbattle_json)
    unit_results = normalized["unit_results"]
    hero_roll_type = (
        CampaignSettings.objects.filter(campaign_id=battle.campaign_id)
        .values_list("hero_death_roll", flat=True)
        .first()
        or "d66"
    )
    required_unit_keys = permanent_unit_keys(participant)
    missing_keys = sorted(required_unit_keys - set(unit_results.keys()))
    if missing_keys:
        raise ValueError("postbattle unit_results are missing selected units")

    for unit_key, result in unit_results.items():
        parsed_unit = parse_unit_key(unit_key)
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
        parsed_unit = parse_unit_key(unit_key)
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


def _build_battle_complete_log_payload(battle: Battle, participant: BattleParticipant) -> dict:
    participants = list(
        BattleParticipant.objects.select_related("warband")
        .filter(battle_id=battle.id)
        .exclude(status__in=BattleParticipant.LEFT_STATUSES)
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
        voided_at__isnull=True,  # an undone use keeps the item (decision 5)
    ).values_list("payload_json", flat=True)

    for payload in item_events:
        if not isinstance(payload, dict):
            continue
        unit_key = payload.get("unit_key")
        item_id_raw = payload.get("item_id")
        if not isinstance(unit_key, str) or not unit_key.strip():
            continue
        try:
            item_id = coerce_int(item_id_raw, field_name="item_id", minimum=1)
            parsed_unit = parse_unit_key(unit_key)
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
    battle: Battle, participant: BattleParticipant, normalized: dict
) -> list[Warning]:
    """Apply a participant's postbattle, which the caller validated (_validate_postbattle_json_for_participant: once,
    part of PERF-36); the warnings say which units were left out (BUG-73) and what was unusual (decision 9)."""
    unit_information = normalize_unit_information(participant.unit_information_json)
    unit_results = normalized["unit_results"]
    warband = Warband.objects.select_for_update().get(id=participant.warband_id)
    campaign_settings = CampaignSettings.objects.filter(campaign_id=battle.campaign_id).first()

    hero_ids = []
    hired_sword_ids = []
    henchman_ids = []
    for unit_key in unit_results.keys():
        parsed = parse_unit_key(unit_key)
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
    injury_logs: list[dict] = []
    stat_logs: list[dict] = []
    items_lost: list[dict | None] = []  # what each unit dying here takes with him (pass 2 decision 7)
    kills_by_unit = kill_counts_by_unit(battle.id, participant.warband_id)  # the live kill events (decision 5)
    group_xp_by_id: dict[int, int] = {}
    group_stats_override_by_id: dict[int, dict[str, int | str]] = {}
    group_stats_update_fields_by_id: defaultdict[int, set[str]] = defaultdict(set)
    for unit_key, result in unit_results.items():
        parsed = parse_unit_key(unit_key)
        info = unit_information.get(unit_key, {})
        stats_override = info.get("stats_override", {})
        kill_count = kills_by_unit.get(unit_key, 0)
        xp_earned = coerce_int(result.get("xp_earned", 0), field_name="xp_earned", minimum=0, maximum=9999)
        unit_name = result.get("unit_name", "") or unit_key
        injury = injury_outcome(result, unit_name)  # the last roll, when ticked (decision 7)
        dead = bool(result.get("dead", False)) or injury.dead

        if parsed["unit_type"] == "hero":
            hero = heroes.get(parsed["unit_id"])
            if not hero:
                warnings.append(unit_left_warband(unit_key, unit_name))
                continue
            injury_logs.append(injury.log or {})
            update_fields = _kept_stats(hero, stats_override, unit_name, stat_logs) if result["keep_stats"] else []
            update_fields += apply_stat_and_special(hero, injury, battle.campaign_id)
            if kill_count > 0:
                hero.kills += kill_count
                update_fields.append("kills")
            if apply_xp_gain(hero, xp_earned, campaign_settings):
                update_fields.extend(XP_FIELDS)
            if dead and not hero.dead:
                hero.dead = True
                update_fields.append("dead")
                items_lost.append(lost_entry(unit_name, carried_item_names(hero)))
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
            injury_logs.append(injury.log or {})
            effective_xp_earned = 0 if hired_sword.no_level_ups else xp_earned
            update_fields = (
                _kept_stats(hired_sword, stats_override, unit_name, stat_logs) if result["keep_stats"] else []
            )
            update_fields += apply_stat_and_special(hired_sword, injury, battle.campaign_id)
            if kill_count > 0:
                hired_sword.kills += kill_count
                update_fields.append("kills")
            if apply_xp_gain(hired_sword, effective_xp_earned, campaign_settings):
                update_fields.extend(XP_FIELDS)
            if dead and not hired_sword.dead:
                hired_sword.dead = True
                update_fields.append("dead")
                items_lost.append(lost_entry(unit_name, carried_item_names(hired_sword)))
            if update_fields:
                hired_sword.save(update_fields=[*dict.fromkeys(update_fields), "updated_at"])
            continue

        if parsed["unit_type"] == "henchman":
            henchman = henchmen.get(parsed["unit_id"])
            group = henchmen_groups.get(henchman.group_id) if henchman else None
            if not henchman or not group:  # he, or his whole group, was dismissed
                warnings.append(unit_left_warband(unit_key, unit_name))
                continue
            injury_logs.append(injury.log or {})
            effective_xp_earned = 0 if group.no_level_ups else xp_earned
            if stats_override and result["keep_stats"]:  # one Keep for the group: any member's tick
                existing_group_stats = group_stats_override_by_id.get(henchman.group_id)
                if existing_group_stats is None:
                    group_stats_override_by_id[henchman.group_id] = stats_override
                    group_name = group.name or group.unit_type or unit_name
                    group_stats_update_fields_by_id[henchman.group_id].update(
                        _kept_stats(group, stats_override, group_name, stat_logs)
                    )
                elif existing_group_stats != stats_override:
                    raise ValueError("All henchmen in a group must share the same stat overrides")
            if kill_count > 0:
                henchman.kills += kill_count
            if dead and not henchman.dead:
                henchman.dead = True
                items_lost.append(lost_entry(unit_name, henchman_takes_his_share(group)))
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
    resource_amount = exploration_amount(exploration)  # the server's table, or the override (decision 9)
    resource_name = None
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
        resource_name = resource.name

    upkeep = normalized.get("upkeep", {})
    if upkeep.get("pay_upkeep", True):
        upkeep_entries = upkeep.get("entries", {})
        upkeep_hired_sword_ids = []
        for unit_key in upkeep_entries.keys():
            parsed_unit = parse_unit_key(unit_key)
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
            parsed_unit = parse_unit_key(unit_key)
            if parsed_unit["unit_type"] != "hired_sword":
                continue
            hired_sword = active_upkeep_hired_swords.get(parsed_unit["unit_id"])
            if not hired_sword:
                continue
            cost = entry.get("cost")
            if cost is None:
                continue
            normalized_cost = coerce_int(
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
    finds_gold_crowns = coerce_int(
        finds.get("gold_crowns", 0),
        field_name="postbattle finds gold_crowns",
        minimum=0,
        maximum=999999,
    )
    finds_items = finds.get("items", [])
    canonical_find_items: list[dict] = []
    if finds_items:
        requested_item_ids = [
            coerce_int(entry.get("item_id"), field_name="postbattle finds item_id", minimum=1) for entry in finds_items
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
    previous_rolls = exploration.get("previous_rolls", [])  # kept by the server (services/exploration.py)
    log_warband_event(
        participant.warband_id,
        "battle",
        "exploration",
        {
            "dice": dice_values,
            "amount": resource_amount,
            "amount_override": exploration.get("amount_override"),
            "resource": resource_name,
            "rerolls": previous_rolls,
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
    for injury_log in filter(None, injury_logs):  # one per unit: the final roll, re-rolls, what was applied
        log_warband_event(participant.warband_id, "personnel", "serious_injury", injury_log)
    for stat_log in stat_logs:  # the kept stat changes, before and after (decision 6)
        log_warband_event(participant.warband_id, "personnel", "stats_kept", stat_log)
    if any(items_lost):
        log_warband_event(participant.warband_id, "battle", "items_lost", {"units": list(filter(None, items_lost))})
    unusual = unusual_value_warnings(normalized)  # allowed, answered and logged (decision 9)
    if unusual:
        log_warband_event(participant.warband_id, "battle", "warnings", {"warnings": unusual})
    return warnings + unusual
