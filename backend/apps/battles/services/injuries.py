"""The serious injury tables and what each result does (decision 7, BUG-47, BATL-TWEAK-05).

The server owns the tables: a draft's roll keeps its dice and its tick (`apply`), and the server fills in the result
and its effect. Simple results (dead, a characteristic -1, a named special such as Old Battle Wound) are applied at
finalise when ticked; complex ones (Robbed, Captured, Sold to the Pits, Multiple Injuries and the like) are flagged
to apply by hand. Only a unit's last roll counts (earlier ones were re-rolled); finalise writes one log per unit with
that roll, the re-rolls and what was applied. The labels are the ones the postbattle page has always shown.
"""

from dataclasses import dataclass, field
from typing import Any

from django.db.models import F, Q

from apps.core.catalogue import cache as catalogue_cache
from apps.special.models import Special

DEAD = {"kind": "dead"}
NONE = {"kind": "none"}
MANUAL = {"kind": "manual"}


def _stat(name: str) -> dict[str, Any]:
    return {"kind": "stat", "stat": name, "change": -1}


def _special(name: str) -> dict[str, Any]:
    return {"kind": "special", "special": name}


_D66_RANGES: list[tuple[int, int, str, dict[str, Any]]] = [
    (11, 15, "Dead", DEAD),
    (16, 21, "Full Recovery", NONE),
    (22, 26, "Horrible Scars", _special("Horrible Scars")),
    (31, 31, "Old Battle Wound", _special("Old Battle Wound")),
    (32, 32, "Nervous Condition", _stat("initiative")),
    (33, 33, "Smashed Leg", MANUAL),
    (34, 34, "Arm Wound", MANUAL),
    (35, 35, "Severe Head Wound", _special("Severe Head Wound")),
    (36, 36, "Robbed", MANUAL),
    (41, 55, "Sold to the Pits", MANUAL),
    (56, 56, "Bitter Enmity", MANUAL),
    (61, 61, "Captured", MANUAL),
    (62, 62, "Hardened", _special("Hardened")),
    (63, 63, "Mad", MANUAL),
    (64, 64, "Stupidity", _special("Stupidity")),
    (65, 65, "Frenzy", _special("Frenzy")),
    (66, 66, "Multiple Injuries", MANUAL),
]
_D100_RANGES: list[tuple[int, int, str, dict[str, Any]]] = [
    (1, 14, "Dead", DEAD),
    (15, 20, "Multiple Injuries", MANUAL),
    (21, 23, "Smashed Leg", MANUAL),
    (24, 24, "Arm Wound", MANUAL),
    (25, 26, "Madness", MANUAL),
    (27, 28, "Smashed Leg", MANUAL),
    (29, 31, "Chest Wound", _stat("toughness")),
    (32, 34, "Big City Shakes", MANUAL),
    (35, 37, "Blind in One Eye", _stat("ballistic_skill")),
    (38, 39, "Old Battle Wound", _special("Old Battle Wound")),
    (40, 42, "Nervous Condition", _stat("initiative")),
    (43, 45, "Hand Injury", _stat("weapon_skill")),
    (46, 49, "Deep Wound", MANUAL),
    (50, 74, "Full Recovery", NONE),
    (75, 77, "Robbed", MANUAL),
    (78, 80, "Bitter Enmity", MANUAL),
    (81, 85, "Captured", MANUAL),
    (86, 88, "Hardened", _special("Hardened")),
    (89, 91, "Horrible Scars", _special("Horrible Scars")),
    (92, 94, "Sold to the Pits", MANUAL),
    (95, 97, "Survives Against the Odds", MANUAL),
    (98, 99, "Really Survives Against the Odds", MANUAL),
    (100, 100, "Mutation", MANUAL),
]


def _lookup(ranges: list[tuple[int, int, str, dict[str, Any]]], value: int) -> tuple[str, dict[str, Any]]:
    for low, high, label, effect in ranges:
        if low <= value <= high:
            return label, effect
    return "Check the serious injury chart manually", MANUAL


def describe_roll(roll_type: str, rolls: list[int]) -> dict[str, Any]:
    """The table's result for a roll (already validated): code, label, whether it suggests death, and its effect."""
    if roll_type == "d6":
        dead = rolls[0] <= 2
        label, effect = ("Dead", DEAD) if dead else ("Survives", NONE)
        code = str(rolls[0])
    elif roll_type == "d66":
        code = f"{rolls[0]}{rolls[1]}"
        label, effect = _lookup(_D66_RANGES, int(code))
    else:
        code = str(rolls[0]).zfill(2)
        label, effect = _lookup(_D100_RANGES, rolls[0])
    dead_suggestion = effect["kind"] == "dead"
    return {"result_code": code, "result_label": label, "dead_suggestion": dead_suggestion, "effect": dict(effect)}


@dataclass
class InjuryOutcome:
    """What a unit's final roll does at finalise, and its log (None without a roll)."""

    dead: bool = False
    stat: str | None = None
    special: str | None = None
    log: dict[str, Any] | None = field(default=None)


def injury_outcome(result: dict[str, Any], unit_name: str) -> InjuryOutcome:
    """The effect of the unit's last roll when it is ticked; earlier rolls are logged as re-rolls."""
    rolls = result.get("serious_injury_rolls") or []
    if not rolls:
        return InjuryOutcome()
    final, rerolls = rolls[-1], rolls[:-1]
    effect = final.get("effect") or MANUAL
    applies = bool(final.get("apply", True)) and effect["kind"] in ("dead", "stat", "special")
    log = {
        "unit_name": unit_name,
        **{key: final.get(key) for key in ("roll_type", "rolls", "result_code", "result_label", "dead_suggestion")},
        "effect": effect,
        "applied": applies,
        "apply_by_hand": effect["kind"] == "manual",
        "rerolls": [roll.get("rolls", []) for roll in rerolls],
    }
    if not applies:
        return InjuryOutcome(log=log)
    return InjuryOutcome(dead=effect["kind"] == "dead", stat=effect.get("stat"), special=effect.get("special"), log=log)


def injury_special(name: str, campaign_id: int) -> Special:
    """The special an injury grants: the book's of that name (or the campaign's version of it, CAT-TWEAK-03), else
    the campaign's own, created the first time. One query to find it."""
    named = Q(name__iexact=name) & (Q(campaign__isnull=True) | Q(campaign_id=campaign_id))
    versions = Q(campaign_id=campaign_id, replaces__campaign__isnull=True, replaces__name__iexact=name)
    rows = list(Special.objects.filter(named | versions).order_by(F("campaign_id").asc(nulls_first=True), "id"))
    book = next((row for row in rows if row.campaign_id is None), None)
    if book is not None:
        return next((row for row in rows if row.replaces_id == book.id), book)
    own = next((row for row in rows if row.campaign_id is not None and row.name.lower() == name.lower()), None)
    if own is not None:
        return own
    special = Special.objects.create(campaign_id=campaign_id, name=name, type="Injury")
    catalogue_cache.bump(campaign_id)  # the campaign's specials list shows it (PERF-13)
    return special


def apply_stat_and_special(unit: Any, outcome: InjuryOutcome, campaign_id: int) -> list[str]:
    """Lower the unit's characteristic and grant the named special (a hero or hired sword); returns the changed
    unit fields."""
    fields: list[str] = []
    if outcome.stat:
        setattr(unit, outcome.stat, max(0, (getattr(unit, outcome.stat) or 0) - 1))
        fields.append(outcome.stat)
    if outcome.special:
        special = injury_special(outcome.special, campaign_id)
        links = unit.hero_specials if hasattr(unit, "hero_specials") else unit.hired_sword_specials
        if not links.filter(special=special).exists():
            links.create(special=special)
    return fields


def _rows(ranges: list[tuple[int, int, str, dict[str, Any]]]) -> list[dict[str, Any]]:
    return [{"low": low, "high": high, "label": label, "effect": dict(effect)} for low, high, label, effect in ranges]


def injury_tables() -> dict[str, list[dict[str, Any]]]:
    """The tables as postbattle shows them (IMP-52): each result's roll range (a d66 range runs over its codes),
    label and effect. A d6 (henchmen, hired swords) is Dead on 1-2."""
    d6 = [(1, 2, "Dead", DEAD), (3, 6, "Survives", NONE)]
    return {"d6": _rows(d6), "d66": _rows(_D66_RANGES), "d100": _rows(_D100_RANGES)}
