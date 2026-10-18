from django.utils import timezone

from apps.campaigns.permissions import get_membership
from apps.warbands.models import (
    Henchman,
    Hero,
    HiredSword,
)

from ..models import Battle, BattleEvent, BattleParticipant
from ..services.expiry import settle_during_write
from ..services.selection import custom_unit_entry
from ..services.timing import is_overdue

KILLER_UNIT_TYPES = {"hero", "hired_sword", "henchman", "custom", "bestiary"}
INGAME_EVENT_TYPES = {
    BattleEvent.TYPE_KILL_RECORDED,
    BattleEvent.TYPE_DEATH_RECORDED,
    BattleEvent.TYPE_ITEM_USED,
}


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
        settle_during_write(battle)
    participant = participant_qs.first()
    return battle, participant


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
