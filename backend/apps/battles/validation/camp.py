"""The post-game parts of the draft the Aftermath page and camp add (next step 3): each unit's advances rolled in the
Aftermath, the camp's own record (the veterans' XP pool, what was sold and recruited) and the resources each upkeep
pays (the fees and skill lists step).

Advances are applied at finalise, after the battle's XP (services/postbattle/advances.py); the camp record is the
player's checklist and is only kept with the draft.
"""

from typing import Any

from apps.hirelings.fees import MAX_FEE, MAX_RESOURCE_LINES

from .coerce import coerce_int

MAX_ADVANCES = 20
MAX_CAMP_ENTRIES = 20
# What an Aftermath advance may be: a stat, a pending pick, or the lad's got talent (resolved from the card).
ADVANCE_IDS = {"M", "WS", "BS", "S", "T", "W", "I", "A", "Ld", "Skill", "Spell", "Special", "LGT"}


def _listed(value: Any, message: str) -> list:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError(message)
    return value


def _label(value: Any, field: str, limit: int = 120) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string")
    return value.strip()[:limit]


def _dice(value: Any, field: str, most: int) -> list[int]:
    rolls = _listed(value, f"{field} must be a list")
    if len(rolls) > most:
        raise ValueError(f"{field} must have at most {most} dice")
    return [coerce_int(roll, field_name=field, minimum=1, maximum=6) for roll in rolls]


def _advance(entry: Any) -> dict[str, Any]:
    if not isinstance(entry, dict):
        raise ValueError("Each postbattle advance must be an object")
    advance_id = entry.get("id")
    if advance_id not in ADVANCE_IDS:
        raise ValueError("postbattle advance id is invalid")
    return {
        "id": advance_id,
        "label": _label(entry.get("label"), "postbattle advance label", 60),
        "at": coerce_int(entry.get("at", 0), field_name="postbattle advance at", minimum=0, maximum=9999),
        "rolls": _dice(entry.get("rolls"), "postbattle advance rolls", 3),
    }


def normalize_advances(entry: dict) -> dict[str, Any]:
    """`{"advances": [...]}` for a unit result that has any (each `{id, label, at, rolls}`), else nothing."""
    advances = _listed(entry.get("advances"), "postbattle advances must be a list")
    if len(advances) > MAX_ADVANCES:
        raise ValueError(f"postbattle advances must contain at most {MAX_ADVANCES} entries")
    return {"advances": [_advance(advance) for advance in advances]} if advances else {}


def _sold(entry: Any) -> dict[str, Any]:
    if not isinstance(entry, dict):
        raise ValueError("Each camp sale must be an object")
    return {
        "name": _label(entry.get("name"), "camp sale name"),
        "quantity": coerce_int(entry.get("quantity", 0), field_name="camp sale quantity", minimum=0, maximum=9999),
        "gold": coerce_int(entry.get("gold", 0), field_name="camp sale gold", minimum=0, maximum=999999),
    }


def _recruited(entry: Any) -> dict[str, Any]:
    if not isinstance(entry, dict):
        raise ValueError("Each camp recruit must be an object")
    return {
        "group": _label(entry.get("group"), "camp recruit group"),
        "count": coerce_int(entry.get("count", 0), field_name="camp recruit count", minimum=0, maximum=99),
        "xp": coerce_int(entry.get("xp", 0), field_name="camp recruit xp", minimum=0, maximum=99),
    }


def _entries(section: dict, key: str, clean: Any) -> list[dict[str, Any]]:
    rows = _listed(section.get(key), f"camp {key} must be a list")
    if len(rows) > MAX_CAMP_ENTRIES:
        raise ValueError(f"camp {key} must contain at most {MAX_CAMP_ENTRIES} entries")
    return [clean(row) for row in rows]


def normalize_camp(raw: dict) -> dict[str, Any]:
    """The camp record (`veterans`: the 2D6 rolled for the pool and the XP shared out of it; `sold` and `recruited`),
    or {} when there is none."""
    section = raw.get("camp")
    if section is None:
        return {}
    if not isinstance(section, dict):
        raise ValueError("postbattle camp must be an object")
    camp: dict[str, Any] = {}
    veterans = section.get("veterans")
    if veterans is not None:
        if not isinstance(veterans, dict):
            raise ValueError("camp veterans must be an object")
        dice = _dice(veterans.get("dice"), "camp veterans dice", 2)
        if len(dice) != 2:
            raise ValueError("camp veterans dice must be two dice")
        spent = coerce_int(veterans.get("spent", 0), field_name="camp veterans spent", minimum=0, maximum=999)
        camp["veterans"] = {"dice": dice, "spent": spent}
    for key, clean in (("sold", _sold), ("recruited", _recruited)):
        if rows := _entries(section, key, clean):
            camp[key] = rows
    return camp


def normalize_upkeep_resources(value: Any) -> list[dict[str, Any]]:
    """An upkeep entry's resource lines (the fees and skill lists step): `resource`, `amount` and the warband's
    counter that pays it, `resource_id` (null: don't pay it; left out: the counter of its name pays it at Ready)."""
    lines = _listed(value, "postbattle upkeep resources must be a list")
    if len(lines) > MAX_RESOURCE_LINES:
        raise ValueError(f"postbattle upkeep resources must have at most {MAX_RESOURCE_LINES} lines")
    cleaned = []
    for line in lines:
        if not isinstance(line, dict):
            raise ValueError("Each postbattle upkeep resource must be an object")
        resource = _label(line.get("resource"), "postbattle upkeep resource", 60)
        if not resource:
            raise ValueError("postbattle upkeep resource must name its resource")
        amount = coerce_int(line.get("amount", 0), field_name="postbattle upkeep amount", minimum=0, maximum=MAX_FEE)
        entry: dict[str, Any] = {"resource": resource, "amount": amount}
        if "resource_id" in line:
            picked = line["resource_id"]
            entry["resource_id"] = (
                None if picked is None else coerce_int(picked, field_name="upkeep resource_id", minimum=1)
            )
        cleaned.append(entry)
    return cleaned
