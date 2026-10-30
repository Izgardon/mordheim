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
from .neutrals import find_creature, neutral_groups, put_back, take_out
from .roster_units import roster_pet
from .selection import custom_unit_entry, selected_unit_keys
from .unit_information import is_empty, unit_entry

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
    if unit["unit_type"] == "pet":  # a pet fighting as its own model: named from the battle roster (step 5)
        pet = roster_pet(participant.roster_json, unit["unit_key"])
        payload["name"], payload["type_name"] = (pet or {}).get("name"), "Pet"
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
    _mark_out_of_action(unit_information, unit["unit_key"], out_of_action)
    participant.unit_information_json = unit_information
    participant.save(update_fields=["unit_information_json", "updated_at"])
    event_type = BattleEvent.TYPE_UNIT_OOA_SET if out_of_action else BattleEvent.TYPE_UNIT_OOA_UNSET
    unit_payload = {key: unit[key] for key in ("unit_key", "unit_type", "unit_id")}
    payload = {"unit": {**unit_payload, "warband_id": participant.warband_id}, "out_of_action": out_of_action}
    return [append_event(battle, event_type, actor_user=actor, payload={**payload, "round": battle.round})]


def _mark_out_of_action(unit_information: dict, unit_key: str, out_of_action: bool) -> None:
    """Out of action (or back in it) in a normalised map, in place: the knocked down or stunned status goes either
    way (next step 6), and an entry left saying nothing is dropped."""
    info = unit_entry(unit_information, unit_key)
    info["out_of_action"] = out_of_action
    info.pop("status", None)
    if is_empty(info):
        unit_information.pop(unit_key, None)


def _victim_participant(participants: list[BattleParticipant], victim: dict) -> BattleParticipant:
    for entry in participants:
        if victim["unit_key"] in selected_unit_keys(entry):
            return entry
    raise Refused("victim_unit_key is not selected in this battle")


NO_VICTIM_UNIT = {"unit_key": None, "unit_type": None, "unit_id": None, "warband_id": None}


def _take_out_victim(victim_participant: BattleParticipant, victim_key: str, killer: BattleParticipant) -> bool:
    """A kill in the fight puts its victim out of action (next step 6): whether it did (he wasn't already). The
    killer's own row is changed through `killer` when the victim is his."""
    row = killer if victim_participant.id == killer.id else victim_participant
    unit_information = normalize_unit_information(row.unit_information_json)
    if unit_entry(unit_information, victim_key)["out_of_action"]:
        return False
    _mark_out_of_action(unit_information, victim_key, True)
    row.unit_information_json = unit_information
    row.save(update_fields=["unit_information_json", "updated_at"])
    return True


def _neutral_victim(battle: Battle, creature_key: str, source: str) -> tuple[dict, bool]:
    """A neutral creature as a kill's victim: its payload, and whether the kill took it out of action."""
    if source == "battle":
        group, creature, taken_out = take_out(battle, creature_key)
    else:
        (group, creature), taken_out = find_creature(neutral_groups(battle), creature_key), False
    victim = {**NO_VICTIM_UNIT, "name": creature.get("name"), "type_name": group.get("creature_type")}
    return {**victim, "neutral_key": creature_key}, taken_out


def record_kill(battle: Battle, participant: BattleParticipant, kill: dict, actor) -> tuple[list[dict], list[int]]:
    """Record the killer's kill (`kill`: killer, victim, victim_neutral_key or victim_name, earned_xp, source,
    notes): the killer's live kill_count goes up by one, and in the fight the victim goes out of action
    (`victim_ooa` says the kill did it, so undoing it puts him back). The events, and the participants changed."""
    killer, victim, source = kill["killer"], kill["victim"], kill["source"]
    if killer["unit_key"] not in selected_unit_keys(participant):
        raise Refused("killer_unit_key is not selected for this participant")
    unit_information = normalize_unit_information(participant.unit_information_json)
    killer_info = unit_entry(unit_information, killer["unit_key"])
    if killer_info["out_of_action"] and source == "battle":  # in postbattle he may have scored before
        raise Refused("Cannot record kills for a unit that is out of action")
    participants = list(locked(BattleParticipant.objects.filter(battle_id=battle.id).order_by("id")))
    victim_participant = _victim_participant(participants, victim) if victim is not None else None
    if victim is None and kill.get("victim_neutral_key"):
        find_creature(neutral_groups(battle), kill["victim_neutral_key"])  # refused before anything is written
    killer_info["kill_count"] = max(0, int(killer_info.get("kill_count", 0))) + 1
    participant.unit_information_json = unit_information
    participant.save(update_fields=["unit_information_json", "updated_at"])
    killer_payload = unit_event_payload(participant, killer)
    changed, taken_out = [participant.id], False
    if victim_participant is not None:
        victim_payload = unit_event_payload(victim_participant, victim)
        if source == "battle":
            taken_out = _take_out_victim(victim_participant, victim["unit_key"], participant)
            changed = list(dict.fromkeys([participant.id, victim_participant.id]))
    elif kill.get("victim_neutral_key"):
        victim_payload, taken_out = _neutral_victim(battle, kill["victim_neutral_key"], source)
    else:
        victim_payload = {**NO_VICTIM_UNIT, "name": kill["victim_name"]}
    payload = {"killer": killer_payload, "victim": victim_payload, "earned_xp": kill["earned_xp"], "source": source}
    if source == "battle":
        payload["round"] = battle.round
    if taken_out:
        payload["victim_ooa"] = True
    if kill.get("how"):
        payload["how"] = kill["how"]
    if kill["notes"]:
        payload["notes"] = kill["notes"]
    return [append_event(battle, BattleEvent.TYPE_UNIT_KILL_RECORDED, actor_user=actor, payload=payload)], changed


def put_back_victim(battle: Battle, payload: dict) -> list[int]:
    """Undoing a kill that took its victim out of action puts him back in it, if he is still out and the battle is
    still being fought: the participants changed."""
    victim = payload.get("victim") if isinstance(payload, dict) else None
    if not (isinstance(victim, dict) and payload.get("victim_ooa")) or battle.status != Battle.STATUS_ACTIVE:
        return []
    if isinstance(victim.get("neutral_key"), str):
        put_back(battle, victim["neutral_key"])
        return []
    warband_id, unit_key = victim.get("warband_id"), victim.get("unit_key")
    if not isinstance(warband_id, int) or not isinstance(unit_key, str):
        return []
    row = locked(BattleParticipant.objects.filter(battle_id=battle.id, warband_id=warband_id)).first()
    if row is None:
        return []
    unit_information = normalize_unit_information(row.unit_information_json)
    if not unit_information.get(unit_key, {}).get("out_of_action"):
        return []
    _mark_out_of_action(unit_information, unit_key, False)
    row.unit_information_json = unit_information
    row.save(update_fields=["unit_information_json", "updated_at"])
    return [row.id]


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
