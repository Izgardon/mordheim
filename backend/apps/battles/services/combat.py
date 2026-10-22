"""The fight: units taken out of action, kills and single-use items used (each player finishes his own battle:
services/finishing.py).

A kill is an event that names the killer and the victim (decision 5): tapped in battle, or added in the killer's own
postbattle (`source: "postbattle"`).
"""

from apps.warbands.models import Henchman, Hero, Hireling

from ..models import Battle, BattleEvent, BattleParticipant
from ..validation.config import normalize_unit_information
from .errors import Refused, battle_status_changed
from .events import append_event
from .item_use import item_use_payload
from .locks import locked
from .selection import custom_unit_entry, selected_unit_keys
from .unit_information import unit_entry

CASTERS = {"Wizard", "Priest"}


def _blank_unit_payload(unit: dict, warband_id: int | None) -> dict:
    return {
        "unit_key": unit["unit_key"],
        "unit_type": unit["unit_type"],
        "unit_id": unit["unit_id"],
        "warband_id": warband_id,
        "name": None,
        "type_name": None,  # the unit's type ("Youngblood"), so a nameless one can still be told (BATL-NEW-06)
        "is_leader": False,
        "is_caster": False,
        "caster_type": None,
        "is_large": False,
    }


def unit_event_payload(participant: BattleParticipant, unit: dict) -> dict:
    """What a kill event says about one of the participant's units (a parsed unit key)."""
    payload = _blank_unit_payload(unit, participant.warband_id)
    if unit["unit_type"] in ("hero", "hireling"):
        row: Hero | Hireling | None
        if unit["unit_type"] == "hero":
            row = Hero.objects.filter(id=unit["unit_id"], warband_id=participant.warband_id).first()
            payload["is_leader"] = bool(row and row.is_leader)
        else:
            row = Hireling.objects.filter(id=unit["unit_id"], warband_id=participant.warband_id).first()
        if row:
            payload["name"] = row.name or None
            payload["type_name"] = row.unit_type or None
            payload["is_caster"] = row.caster in CASTERS
            payload["caster_type"] = row.caster if row.caster in CASTERS else None
            payload["is_large"] = bool(row.large)
        return payload
    if unit["unit_type"] == "henchman":
        henchman = (
            Henchman.objects.select_related("group")
            .filter(id=unit["unit_id"], group__warband_id=participant.warband_id)
            .first()
        )
        if henchman:
            payload["name"] = henchman.name or None
            payload["type_name"] = henchman.group.unit_type or None
            payload["is_large"] = bool(getattr(henchman.group, "large", False))
        return payload
    custom_unit = custom_unit_entry(participant, unit["unit_key"])
    if custom_unit:
        payload["name"] = str(custom_unit.get("name", "")).strip() or None
        payload["type_name"] = str(custom_unit.get("unit_type") or "").strip() or None
    return payload


def set_out_of_action(battle: Battle, participant: BattleParticipant, unit: dict, out_of_action: bool, actor) -> list:
    """Mark one of the participant's selected units out of action (or back); no events when it already was."""
    if unit["unit_key"] not in selected_unit_keys(participant):
        raise Refused("unit_key is not selected for this participant")
    unit_information = normalize_unit_information(participant.unit_information_json)
    info = unit_entry(unit_information, unit["unit_key"])
    if info["out_of_action"] == out_of_action:
        return []
    info["out_of_action"] = out_of_action
    if not (info["stats_override"] or info.get("notes", "") or info["out_of_action"] or info["kill_count"]):
        unit_information.pop(unit["unit_key"], None)  # (current wounds aren't kept here, as before)
    participant.unit_information_json = unit_information
    participant.save(update_fields=["unit_information_json", "updated_at"])
    event_type = BattleEvent.TYPE_UNIT_OOA_SET if out_of_action else BattleEvent.TYPE_UNIT_OOA_UNSET
    unit_payload = {key: unit[key] for key in ("unit_key", "unit_type", "unit_id")}
    payload = {"unit": {**unit_payload, "warband_id": participant.warband_id}, "out_of_action": out_of_action}
    return [append_event(battle, event_type, actor_user=actor, payload=payload)]


def _victim_participant(participants: list[BattleParticipant], victim: dict) -> BattleParticipant:
    for entry in participants:
        if victim["unit_key"] in selected_unit_keys(entry):
            return entry
    raise Refused("victim_unit_key is not selected in this battle")


def record_kill(battle: Battle, participant: BattleParticipant, kill: dict, actor) -> list[dict]:
    """Record the killer's kill (`kill`: killer, victim or victim_name, earned_xp, source, notes); the killer's live
    kill_count goes up by one."""
    killer, victim, source = kill["killer"], kill["victim"], kill["source"]
    if killer["unit_key"] not in selected_unit_keys(participant):
        raise Refused("killer_unit_key is not selected for this participant")
    unit_information = normalize_unit_information(participant.unit_information_json)
    killer_info = unit_entry(unit_information, killer["unit_key"])
    if killer_info["out_of_action"] and source == "battle":  # in postbattle he may have scored before
        raise Refused("Cannot record kills for a unit that is out of action")
    participants = list(locked(BattleParticipant.objects.filter(battle_id=battle.id).order_by("id")))
    victim_participant = _victim_participant(participants, victim) if victim is not None else None
    killer_info["kill_count"] = max(0, int(killer_info.get("kill_count", 0))) + 1
    participant.unit_information_json = unit_information
    participant.save(update_fields=["unit_information_json", "updated_at"])
    killer_payload = unit_event_payload(participant, killer)
    if victim_participant is not None:
        victim_payload = unit_event_payload(victim_participant, victim)
    else:
        victim_payload = {"unit_key": None, "unit_type": None, "unit_id": None, "warband_id": None}
        victim_payload["name"] = kill["victim_name"]
    payload = {"killer": killer_payload, "victim": victim_payload, "earned_xp": kill["earned_xp"], "source": source}
    if kill["notes"]:
        payload["notes"] = kill["notes"]
    return [append_event(battle, BattleEvent.TYPE_UNIT_KILL_RECORDED, actor_user=actor, payload=payload)]


def item_use_refusal(battle: Battle, participant: BattleParticipant) -> None:
    """Items are used in prebattle or in the fight, by a player who is in that phase."""
    if battle.status not in (Battle.STATUS_PREBATTLE, Battle.STATUS_ACTIVE):
        raise battle_status_changed(battle, "Items can only be used in prebattle or active battle")
    in_prebattle = (BattleParticipant.STATUS_JOINED_PREBATTLE, BattleParticipant.STATUS_READY)
    if battle.status == Battle.STATUS_PREBATTLE and participant.status not in in_prebattle:
        raise Refused("You are not currently in prebattle")
    if battle.status == Battle.STATUS_ACTIVE and participant.status != BattleParticipant.STATUS_IN_BATTLE:
        raise Refused("You are not currently in battle")


def record_item_use(battle: Battle, participant: BattleParticipant, payload: dict, actor) -> dict:
    """The item use to store: a unit of the player's (selected, once the battle is active) carrying the item."""
    item_use_refusal(battle, participant)
    selected = selected_unit_keys(participant) if battle.status == Battle.STATUS_ACTIVE else None
    stored = item_use_payload(participant, payload, selected, battle.campaign_id)
    return append_event(battle, BattleEvent.TYPE_ITEM_USED, actor_user=actor, payload=stored)
