"""Neutral groups: creatures nobody plays, added to a fight by anyone in it (next step 6).

They live on the battle (`Battle.neutral_groups_json`), go out in every snapshot, and are never rostered: nothing of
them reaches the post-game. A group is `{key, name, creature_type, stats, creatures}`; each creature is `{key, name,
status, wounds}`, its key stable (`<group key>-<n>`) so a kill can name it as its victim. Status is "standing",
"knocked_down", "stunned" or "out_of_action"; each new round stands the creatures up a step, as it does the players'
units (services/rounds.py).
"""

from typing import Any

from ..models import Battle, BattleEvent
from .errors import Refused
from .events import append_event
from .unit_information import ALL_OVERRIDE_STAT_KEYS, ARMOUR_SAVE_STAT_KEY, KNOCKED_DOWN, STUNNED

STANDING, OUT_OF_ACTION = "standing", "out_of_action"
CREATURE_STATUSES = (STANDING, KNOCKED_DOWN, STUNNED, OUT_OF_ACTION)
MAX_GROUPS = 12
MAX_CREATURES = 30
NOT_FOUND = "No such neutral group or creature in this battle."


def neutral_groups(battle: Battle) -> list[dict[str, Any]]:
    raw = battle.neutral_groups_json
    return [group for group in raw if isinstance(group, dict)] if isinstance(raw, list) else []


def _text(data: Any, field: str, limit: int) -> str:
    value = data.get(field) if isinstance(data, dict) else None
    text = value.strip() if isinstance(value, str) else ""
    if not text:
        raise ValueError(f"{field} is required")
    if len(text) > limit:
        raise ValueError(f"{field} must be at most {limit} characters")
    return text


def _whole(data: Any, field: str, low: int, high: int, default: int) -> int:
    value = data.get(field, default) if isinstance(data, dict) else default
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field} must be a whole number") from None
    if number < low or number > high:
        raise ValueError(f"{field} must be from {low} to {high}")
    return number


def _stats(raw: Any) -> dict[str, Any]:
    """The bestiary profile the group was added with, if any: its known stats only."""
    if not isinstance(raw, dict):
        return {}
    stats: dict[str, Any] = {}
    for key, value in raw.items():
        if key not in ALL_OVERRIDE_STAT_KEYS:
            continue
        if key == ARMOUR_SAVE_STAT_KEY:
            stats[key] = value if isinstance(value, int) and 1 <= value <= 6 else None
            continue
        try:
            stats[key] = max(0, min(10, int(value)))
        except (TypeError, ValueError):
            continue
    return stats


def new_group_request(data: Any) -> dict[str, Any]:
    """A group as `neutral-groups/` sends it: name, creature type, how many and their wounds (ValueError)."""
    return {
        "name": _text(data, "name", 60),
        "creature_type": _text(data, "creature_type", 80),
        "count": _whole(data, "count", 1, MAX_CREATURES, 1),
        "wounds": _whole(data, "wounds", 1, 10, 1),
        "stats": _stats(data.get("stats") if isinstance(data, dict) else None),
    }


def _index(key: str) -> int:
    try:
        return int(key.rsplit("-", 1)[-1].lstrip("n"))
    except ValueError:
        return 0


def _creature(group_key: str, creature_type: str, number: int, wounds: int, numbered: bool) -> dict[str, Any]:
    name = f"{creature_type} {number}" if numbered else creature_type
    return {"key": f"{group_key}-{number}", "name": name, "status": STANDING, "wounds": wounds}


def add_group(battle: Battle, request: dict[str, Any], actor) -> dict:
    """Add a group of `count` creatures, numbered when there is more than one (Zombie 1, Zombie 2)."""
    groups = neutral_groups(battle)
    if len(groups) >= MAX_GROUPS:
        raise Refused(f"A battle holds at most {MAX_GROUPS} neutral groups.", code="too_many_groups")
    key = f"n{max((_index(str(group.get('key', ''))) for group in groups), default=0) + 1}"
    count, wounds = request["count"], request["wounds"]
    creatures = [_creature(key, request["creature_type"], n, wounds, count > 1) for n in range(1, count + 1)]
    group = {"key": key, "name": request["name"], "creature_type": request["creature_type"], "max_wounds": wounds}
    group = {**group, "stats": request["stats"], "creatures": creatures}
    battle.neutral_groups_json = [*groups, group]
    battle.save(update_fields=["neutral_groups_json"])
    payload = {"group_key": key, "name": request["name"], "count": count, "round": battle.round}
    return append_event(battle, BattleEvent.TYPE_NEUTRAL_GROUP_ADDED, actor_user=actor, payload=payload)


def _group(groups: list[dict[str, Any]], group_key: str) -> dict[str, Any]:
    for group in groups:
        if group.get("key") == group_key:
            return group
    raise Refused(NOT_FOUND, code="not_found", status=404)


def add_creature(battle: Battle, group_key: str, actor) -> dict:
    """One more creature in the group, numbered after the last; a lone unnumbered one becomes "<type> 1"."""
    groups = neutral_groups(battle)
    group = _group(groups, group_key)
    creatures = [creature for creature in group.get("creatures", []) if isinstance(creature, dict)]
    if len(creatures) >= MAX_CREATURES:
        raise Refused(f"A neutral group holds at most {MAX_CREATURES} creatures.", code="too_many_creatures")
    creature_type = str(group.get("creature_type") or group.get("name") or "Creature")
    if len(creatures) == 1 and creatures[0].get("name") == creature_type:
        creatures[0]["name"] = f"{creature_type} 1"
    number = max((_index(str(creature.get("key", ""))) for creature in creatures), default=0) + 1
    wounds = int(group.get("max_wounds") or 1)
    creature = _creature(group_key, creature_type, number, wounds, True)
    group["creatures"] = [*creatures, creature]
    battle.neutral_groups_json = groups
    battle.save(update_fields=["neutral_groups_json"])
    payload = {"group_key": group_key, "creature_key": creature["key"], "name": creature["name"]}
    return append_event(battle, BattleEvent.TYPE_NEUTRAL_CREATURE_ADDED, actor_user=actor, payload=payload)


def remove_group(battle: Battle, group_key: str) -> None:
    groups = neutral_groups(battle)
    _group(groups, group_key)
    battle.neutral_groups_json = [group for group in groups if group.get("key") != group_key]
    battle.save(update_fields=["neutral_groups_json"])


def find_creature(groups: list[dict[str, Any]], creature_key: str) -> tuple[dict[str, Any], dict[str, Any]]:
    for group in groups:
        for creature in group.get("creatures", []):
            if isinstance(creature, dict) and creature.get("key") == creature_key:
                return group, creature
    raise Refused(NOT_FOUND, code="not_found", status=404)


def creature_change_request(data: Any) -> dict[str, Any]:
    """`neutral-creatures/<key>/`: a new status, wounds, or both (ValueError)."""
    change: dict[str, Any] = {}
    if isinstance(data, dict) and "status" in data:
        if data["status"] not in CREATURE_STATUSES:
            raise ValueError("status must be standing, knocked_down, stunned or out_of_action")
        change["status"] = data["status"]
    if isinstance(data, dict) and "wounds" in data:
        change["wounds"] = _whole(data, "wounds", 0, 10, 0)
    if not change:
        raise ValueError("Send a status or wounds")
    return change


def _ooa_event(battle: Battle, group: dict, creature: dict, out_of_action: bool, actor) -> dict:
    neutral = {"key": creature["key"], "name": creature.get("name"), "group_key": group.get("key")}
    payload = {"neutral": neutral, "out_of_action": out_of_action, "round": battle.round}
    return append_event(battle, BattleEvent.TYPE_NEUTRAL_OOA_SET, actor_user=actor, payload=payload)


def change_creature(battle: Battle, creature_key: str, change: dict[str, Any], actor) -> tuple[bool, list[dict]]:
    """Set a creature's status or wounds: whether anything changed, and the out-of-action event when it went out
    of action or came back."""
    groups = neutral_groups(battle)
    group, creature = find_creature(groups, creature_key)
    before = dict(creature)
    creature.update(change)
    if creature == before:
        return False, []
    battle.neutral_groups_json = groups
    battle.save(update_fields=["neutral_groups_json"])
    was_out, is_out = before.get("status") == OUT_OF_ACTION, creature.get("status") == OUT_OF_ACTION
    events = [_ooa_event(battle, group, creature, is_out, actor)] if was_out != is_out else []
    return True, events


def take_out(battle: Battle, creature_key: str) -> tuple[dict[str, Any], dict[str, Any], bool]:
    """A kill's victim: the creature, its group, and whether the kill took it out of action (it wasn't already)."""
    groups = neutral_groups(battle)
    group, creature = find_creature(groups, creature_key)
    if creature.get("status") == OUT_OF_ACTION:
        return group, creature, False
    creature["status"] = OUT_OF_ACTION
    battle.neutral_groups_json = groups
    battle.save(update_fields=["neutral_groups_json"])
    return group, creature, True


def put_back(battle: Battle, creature_key: str) -> None:
    """An undone kill's victim stands again, if it is still out of action and still in the battle."""
    groups = neutral_groups(battle)
    try:
        _group_of, creature = find_creature(groups, creature_key)
    except Refused:
        return
    if creature.get("status") == OUT_OF_ACTION:
        creature["status"] = STANDING
        battle.neutral_groups_json = groups
        battle.save(update_fields=["neutral_groups_json"])


def stand_up_creatures(battle: Battle) -> bool:
    """A new round's step for every creature (knocked down stands, stunned is knocked down); whether any changed.
    The caller saves the battle."""
    groups = neutral_groups(battle)
    changed = False
    for group in groups:
        for creature in group.get("creatures", []):
            if not isinstance(creature, dict):
                continue
            if creature.get("status") == KNOCKED_DOWN:
                creature["status"], changed = STANDING, True
            elif creature.get("status") == STUNNED:
                creature["status"], changed = KNOCKED_DOWN, True
    if changed:
        battle.neutral_groups_json = groups
    return changed
