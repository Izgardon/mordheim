"""The postbattle draft (`postbattle_json`): exploration, finds, upkeep and each unit's results.

`normalize_postbattle` cleans what a client sends; the draft save and finalise then check it against the
participant's units and the campaign (services/postbattle/validate.py). Injury rolls get their result and effect
from the server's tables (decision 7); the exploration amount comes from the server's chart (decision 9).
"""

from typing import Any

from ..services.injuries import describe_roll
from .coerce import coerce_bool, coerce_int, optional_cost
from .unit_keys import parse_unit_key

MAX_EXPLORATION_DICE = 10
ROLL_MAXIMUM = {"d6": 6, "d66": 6, "d100": 100}
ROLL_COUNT = {"d6": ("one", 1), "d66": ("two", 2), "d100": ("one", 1)}


def empty_draft() -> dict[str, Any]:
    """The draft of a player who hasn't saved one, and of a skipped postbattle."""
    return {
        "exploration": {"dice_values": [], "resource_id": None},
        "finds": {"gold_crowns": 0, "items": []},
        "upkeep": {"pay_upkeep": True, "entries": {}},
        "unit_results": {},
    }


def _section(raw: dict, key: str, label: str) -> dict:
    value = raw.get(key, {})
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def _listed(value: Any, message: str) -> list:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError(message)
    return value


def _exploration(raw: dict) -> dict[str, Any]:
    section = _section(raw, "exploration", "postbattle exploration")
    dice_raw = section.get("dice_values")
    if dice_raw is None:
        dice_raw = section.get("dice", [])
    dice = []
    for entry in _listed(dice_raw, "postbattle exploration dice_values must be a list"):
        if isinstance(entry, dict):
            entry = entry.get("value", 1)
        dice.append(coerce_int(entry, field_name="exploration die value", minimum=1, maximum=6))
    if len(dice) > MAX_EXPLORATION_DICE:
        raise ValueError("postbattle exploration dice_values must contain at most 10 entries")
    resource_id = section.get("resource_id")
    if resource_id in ("", None):
        resource_id = None
    else:
        resource_id = coerce_int(resource_id, field_name="exploration resource_id", minimum=1)
    amount_override = section.get("amount_override")
    if amount_override not in (None, ""):
        amount_override = coerce_int(amount_override, field_name="exploration amount_override", minimum=0)
    else:
        amount_override = None
    return {"dice_values": dice, "resource_id": resource_id, "amount_override": amount_override}


def _find_item(entry: Any) -> dict[str, Any]:
    if not isinstance(entry, dict):
        raise ValueError("Each postbattle finds item must be an object")
    item_id = coerce_int(entry.get("item_id"), field_name="postbattle finds item_id", minimum=1)
    item_name = entry.get("name", "")
    item_type = entry.get("type")
    if not isinstance(item_name, str):
        raise ValueError("postbattle finds item name must be a string")
    if item_type is not None and not isinstance(item_type, str):
        raise ValueError("postbattle finds item type must be a string or null")
    return {
        "item_id": item_id,
        "name": item_name.strip()[:255],
        "type": item_type.strip()[:80] if isinstance(item_type, str) else None,
        "cost": optional_cost(entry.get("cost"), field_name="postbattle finds item cost"),
    }


def _finds(raw: dict) -> dict[str, Any]:
    section = _section(raw, "finds", "postbattle finds")
    gold_crowns = coerce_int(
        section.get("gold_crowns", 0), field_name="postbattle finds gold_crowns", minimum=0, maximum=999999
    )
    items = _listed(section.get("items", []), "postbattle finds items must be a list")
    return {"gold_crowns": gold_crowns, "items": [_find_item(entry) for entry in items]}


def _upkeep(raw: dict) -> dict[str, Any]:
    section = _section(raw, "upkeep", "postbattle upkeep")
    entries_raw = section.get("entries", {})
    if entries_raw is None:
        entries_raw = {}
    if not isinstance(entries_raw, dict):
        raise ValueError("postbattle upkeep entries must be an object")
    entries = {}
    for unit_key, entry in entries_raw.items():
        if not isinstance(unit_key, str) or not unit_key.strip():
            raise ValueError("postbattle upkeep entry keys must be strings")
        parsed_unit = parse_unit_key(unit_key)
        if parsed_unit["unit_type"] != "hireling":
            continue
        if not isinstance(entry, dict):
            raise ValueError("Each postbattle upkeep entry must be an object")
        unit_name = entry.get("unit_name", "")
        if not isinstance(unit_name, str):
            raise ValueError("postbattle upkeep unit_name must be a string")
        entries[parsed_unit["unit_key"]] = {
            "unit_name": unit_name.strip()[:120],
            "cost": optional_cost(entry.get("cost"), field_name="postbattle upkeep cost"),
        }
    return {"pay_upkeep": bool(section.get("pay_upkeep", True)), "entries": entries}


def _injury_roll(roll: Any) -> dict[str, Any]:
    if not isinstance(roll, dict):
        raise ValueError("Each serious_injury_roll must be an object")
    roll_type = str(roll.get("roll_type", "")).strip().lower()
    if roll_type not in ROLL_MAXIMUM:
        raise ValueError("serious_injury_roll roll_type is invalid")
    rolls_raw = roll.get("rolls", [])
    if not isinstance(rolls_raw, list):
        raise ValueError("serious_injury_roll rolls must be a list")
    rolls = [
        coerce_int(value, field_name="serious_injury_roll roll", minimum=1, maximum=ROLL_MAXIMUM[roll_type])
        for value in rolls_raw
    ]
    word, count = ROLL_COUNT[roll_type]
    if len(rolls) != count:
        raise ValueError(f"{roll_type} serious_injury_roll must have exactly {word} roll{'s' if count > 1 else ''}")
    # the server's table gives the result and its effect; `apply` is the tick (decision 7, BUG-47)
    return {
        "roll_type": roll_type,
        "rolls": rolls,
        **describe_roll(roll_type, rolls),
        "apply": coerce_bool(roll.get("apply", True), field_name="serious_injury_roll apply"),
    }


def _special_ids(entry: dict) -> list[int]:
    special_ids: list[int] = []
    for special_id in _listed(entry.get("special_ids", []), "postbattle special_ids must be a list"):
        parsed = coerce_int(special_id, field_name="postbattle special_id", minimum=1)
        if parsed not in special_ids:
            special_ids.append(parsed)
    return special_ids


def _text(entry: dict, field: str, default: str, limit: int) -> str:
    value = entry.get(field, default)
    if not isinstance(value, str):
        raise ValueError(f"postbattle {field} must be a string")
    return value.strip()[:limit]


def _unit_result(unit_type: str, entry: Any) -> dict[str, Any]:
    if not isinstance(entry, dict):
        raise ValueError("Each postbattle unit_result must be an object")
    texts = {
        "unit_name": _text(entry, "unit_name", "", 120),
        "unit_kind": _text(entry, "unit_kind", unit_type, 40),
        "unit_type": _text(entry, "unit_type", unit_type, 120),
        "group_name": _text(entry, "group_name", "", 120),
    }
    special_ids = _special_ids(entry)
    rolls_raw = entry.get("serious_injury_rolls", entry.get("death_rolls", []))
    rolls = _listed(rolls_raw, "postbattle serious_injury_rolls must be a list")
    serious_injury_rolls = [_injury_roll(roll) for roll in rolls]
    return {
        **texts,
        "out_of_action": bool(entry.get("out_of_action", False)),
        "kill_count": coerce_int(
            entry.get("kill_count", 0), field_name="postbattle kill_count", minimum=0, maximum=9999
        ),
        "xp_earned": coerce_int(entry.get("xp_earned", 0), field_name="postbattle xp_earned", minimum=0, maximum=9999),
        "dead": bool(entry.get("dead", False)),
        # battle stat changes are temporary unless kept (decision 6)
        "keep_stats": coerce_bool(entry.get("keep_stats", False), field_name="postbattle keep_stats"),
        "special_ids": special_ids,
        "serious_injury_rolls": serious_injury_rolls,
    }


def _unit_results(raw: dict) -> dict[str, dict]:
    section = _section(raw, "unit_results", "postbattle unit_results")
    results = {}
    for unit_key, entry in section.items():
        if not isinstance(unit_key, str) or not unit_key.strip():
            raise ValueError("postbattle unit_result keys must be strings")
        parsed_unit = parse_unit_key(unit_key)
        if parsed_unit["unit_type"] in {"custom", "bestiary", "pet"}:  # a pet follows its owner (step 5)
            continue
        results[parsed_unit["unit_key"]] = _unit_result(parsed_unit["unit_type"], entry)
    return results


RIDER_TYPES = {"hero", "hireling", "henchman"}
D6_FACES = {"1", "2", "3", "4", "5", "6"}


def _mount_roll(value: Any) -> int | None:
    if value in (None, ""):
        return None
    if isinstance(value, bool) or not isinstance(value, int | str) or str(value).strip() not in D6_FACES:
        raise ValueError("postbattle mount_survival roll must be from 1 to 6")
    return int(value)


def _mount_survival(raw: dict) -> dict[str, dict]:
    """Each rider's roll for his mount (a D6, or None before it is rolled) and whether it died (the player's result,
    the bestiary rewrite step 5)."""
    section = _section(raw, "mount_survival", "postbattle mount_survival")
    entries = {}
    for unit_key, entry in section.items():
        parsed_unit = parse_unit_key(unit_key)
        if parsed_unit["unit_type"] not in RIDER_TYPES:
            continue
        if not isinstance(entry, dict):
            raise ValueError("Each postbattle mount_survival entry must be an object")
        entries[parsed_unit["unit_key"]] = {
            "roll": _mount_roll(entry.get("roll")),
            "dead": coerce_bool(entry.get("dead", False), field_name="postbattle mount_survival dead"),
        }
    return entries


def normalize_postbattle(raw_value: Any) -> dict[str, Any]:
    """The cleaned draft, or ValueError for the first thing wrong (exploration, finds, upkeep, units, then mounts).
    `mount_survival` is left out when there is none."""
    if raw_value is None:
        return empty_draft()
    if not isinstance(raw_value, dict):
        raise ValueError("postbattle_json must be an object")
    draft = {
        "exploration": _exploration(raw_value),
        "finds": _finds(raw_value),
        "upkeep": _upkeep(raw_value),
        "unit_results": _unit_results(raw_value),
    }
    if mounts := _mount_survival(raw_value):
        draft["mount_survival"] = mounts
    return draft
