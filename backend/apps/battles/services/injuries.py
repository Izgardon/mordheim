"""The serious injury tables and what each result does (decision 7, BUG-47, BATL-TWEAK-05).

The server owns the tables: a draft's roll keeps its dice and its tick (`apply`), and the server fills in the result
and its effect. Simple results (dead, a characteristic -1, a named special such as Old Battle Wound) are applied at
finalise when ticked; complex ones (Robbed, Captured, Sold to the Pits, Multiple Injuries and the like) are flagged
to apply by hand. Only a unit's last roll counts (earlier ones were re-rolled); finalise writes one log per unit with
that roll, the re-rolls and what was applied. The D66 table is the book's (the catalogue import's
`out/serious-injuries.json`, from mordheimer's snapshot), its results named as the book names them; the D100 table's
labels are the ones the postbattle page has always shown; its 100, Mutation, takes a follow-up D66 on the random
mutation table, kept on the roll, whose special it grants (random_mutations.py). A named special is the book's general
one ("Injury", seeded with the book's rule text by seed_spells_and_special), never a warband's, hired sword's or
dramatis persona's own rule of the name; a campaign gets its own only for a name the book has none of.

A result that keeps the unit out of games carries a hint, `misses` (the games, and the dice when the book rolls for
them: Deep Wound's D3): postbattle offers it as the unit's missing games, set at finalise only when the player ticks
it (services/postbattle/missing.py). Smashed Leg and Arm Wound miss the next game on most of their second rolls.
"""

from dataclasses import dataclass, field
from functools import cache
from typing import Any

from django.db.models import F, Q

from apps.core.catalogue import cache as catalogue_cache
from apps.core.seeding import IMPORT_OUT, read_json_list
from apps.special.categories import book_category
from apps.special.kinds import BANE, GENERAL, INJURY, book_kind
from apps.special.models import Special

from .random_mutations import mutation_special

DEAD = {"kind": "dead"}
NONE = {"kind": "none"}
MANUAL = {"kind": "manual"}
# the D100's 100: a follow-up D66 on the random mutation table, kept on the roll (`mutation`), gives a special
MUTATION = {"kind": "mutation"}


def _stat(name: str) -> dict[str, Any]:
    return {"kind": "stat", "stat": name, "change": -1}


def _special(name: str) -> dict[str, Any]:
    return {"kind": "special", "special": name}


def _misses(games: int, dice: str | None = None) -> dict[str, Any]:
    """Applied by hand, and the unit misses `games` games (the book rolls `dice` for them)."""
    return {**MANUAL, "misses": {"games": games, **({"dice": dice} if dice else {})}}


def _copy(effect: dict[str, Any]) -> dict[str, Any]:
    """A copy of the effect the caller may change, its hint too."""
    return {key: dict(value) if isinstance(value, dict) else value for key, value in effect.items()}


_D66_RANGES: list[tuple[int, int, str, dict[str, Any]]] = [
    (11, 15, "Dead", DEAD),
    (16, 21, "Multiple Injuries", MANUAL),  # roll D6 times more
    (22, 22, "Leg Wound", _stat("movement")),
    (23, 23, "Arm Wound", _misses(1)),
    (24, 24, "Madness", MANUAL),  # a D6 for stupidity or frenzy
    (25, 25, "Smashed Leg", _misses(1)),
    (26, 26, "Chest Wound", _stat("toughness")),
    (31, 31, "Blinded in One Eye", _stat("ballistic_skill")),
    (32, 32, "Old Battle Wound", _special("Old Battle Wound")),
    (33, 33, "Nervous Condition", _stat("initiative")),
    (34, 34, "Hand Injury", _stat("weapon_skill")),
    (35, 35, "Deep Wound", _misses(2, "D3")),
    (36, 36, "Robbed", MANUAL),
    (41, 55, "Full Recovery", NONE),
    (56, 56, "Bitter Enmity", MANUAL),
    (61, 61, "Captured", _misses(1)),
    (62, 63, "Hardened", _special("Hardened")),
    (64, 64, "Horrible Scars", _special("Horrible Scars")),
    (65, 65, "Sold to the Pits", MANUAL),  # he fights in the pits and rejoins: no missed game (William, 5 Nov)
    (66, 66, "Survives Against the Odds", MANUAL),  # +1 Experience
]
_D100_RANGES: list[tuple[int, int, str, dict[str, Any]]] = [
    (1, 14, "Dead", DEAD),
    (15, 20, "Multiple Injuries", MANUAL),
    (21, 23, "Smashed Leg", _misses(1)),
    (24, 24, "Arm Wound", _misses(1)),
    (25, 26, "Madness", MANUAL),
    (27, 28, "Smashed Leg", _misses(1)),
    (29, 31, "Chest Wound", _stat("toughness")),
    (32, 34, "Big City Shakes", MANUAL),
    (35, 37, "Blinded in One Eye", _stat("ballistic_skill")),  # the D66's wording
    (38, 39, "Old Battle Wound", _special("Old Battle Wound")),
    (40, 42, "Nervous Condition", _stat("initiative")),
    (43, 45, "Hand Injury", _stat("weapon_skill")),
    (46, 49, "Deep Wound", _misses(2, "D3")),
    (50, 74, "Full Recovery", NONE),
    (75, 77, "Robbed", MANUAL),
    (78, 80, "Bitter Enmity", MANUAL),
    (81, 85, "Captured", _misses(1)),
    (86, 88, "Hardened", _special("Hardened")),
    (89, 91, "Horrible Scars", _special("Horrible Scars")),
    (92, 94, "Sold to the Pits", MANUAL),
    (95, 97, "Survives Against the Odds", MANUAL),
    (98, 99, "Really Survives Against the Odds", MANUAL),
    (100, 100, "Mutation", MUTATION),
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
    return {"result_code": code, "result_label": label, "dead_suggestion": dead_suggestion, "effect": _copy(effect)}


@dataclass
class InjuryOutcome:
    """What a unit's final roll does at finalise, and its log (None without a roll)."""

    dead: bool = False
    stat: str | None = None
    special: str | None = None
    mutation: tuple[str, str] | None = None  # the special a Mutation's follow-up gives: its name and type
    log: dict[str, Any] | None = field(default=None)


def injury_outcome(result: dict[str, Any], unit_name: str) -> InjuryOutcome:
    """The effect of the unit's last roll when it is ticked; earlier rolls are logged as re-rolls. A Mutation applies
    once its follow-up D66 names a special, and is left to apply by hand until then."""
    rolls = result.get("serious_injury_rolls") or []
    if not rolls:
        return InjuryOutcome()
    final, rerolls = rolls[-1], rolls[:-1]
    effect = final.get("effect") or MANUAL
    mutation = final.get("mutation") if effect["kind"] == MUTATION["kind"] else None
    gives = (mutation or {}).get("special")
    kinds = ("dead", "stat", "special", *(("mutation",) if gives else ()))
    applies = bool(final.get("apply", True)) and effect["kind"] in kinds
    log = {
        "unit_name": unit_name,
        **{key: final.get(key) for key in ("roll_type", "rolls", "result_code", "result_label", "dead_suggestion")},
        "effect": effect,
        "applied": applies,
        "apply_by_hand": effect["kind"] == "manual" or (effect["kind"] == MUTATION["kind"] and not gives),
        "rerolls": [roll.get("rolls", []) for roll in rerolls],
    }
    if mutation:
        log["mutation"] = {key: mutation.get(key) for key in ("rolls", "result_code", "name", "special")}
    if not applies:
        return InjuryOutcome(log=log)
    gained = (str(gives), str((mutation or {}).get("special_type", ""))) if gives else None
    return InjuryOutcome(
        dead=effect["kind"] == "dead", stat=effect.get("stat"), special=effect.get("special"), mutation=gained, log=log
    )


def injury_special(name: str, campaign_id: int) -> Special:
    """The special an injury grants: the book's general special of that name (or the campaign's version of it,
    CAT-TWEAK-03), else the campaign's own, created the first time (an injury, a bane unless the book's
    classification says otherwise). Never a warband's, hired sword's or dramatis persona's own rule of the name (the
    Hochland Bandits' Hardened, the Old Prospector's). One query to find it."""
    named = Q(name__iexact=name) & (Q(campaign__isnull=True) | Q(campaign_id=campaign_id))
    versions = Q(campaign_id=campaign_id, replaces__campaign__isnull=True, replaces__name__iexact=name)
    general = Special.objects.filter(owner_kind=GENERAL)
    rows = list(general.filter(named | versions).order_by(F("campaign_id").asc(nulls_first=True), "id"))
    book = next((row for row in rows if row.campaign_id is None), None)
    if book is not None:
        return next((row for row in rows if row.replaces_id == book.id), book)
    own = next((row for row in rows if row.campaign_id is not None and row.name.lower() == name.lower()), None)
    if own is not None:
        return own
    special = Special.objects.create(
        campaign_id=campaign_id,
        name=name,
        type=INJURY,
        kind=book_kind(name, BANE),
        category=book_category(name, INJURY),
    )
    catalogue_cache.bump(campaign_id, "specials")  # its specials list shows it (PERF-13, BUG-80)
    return special


def apply_stat_and_special(unit: Any, outcome: InjuryOutcome, campaign_id: int) -> list[str]:
    """Lower the unit's characteristic and grant the named special (a hero or hired sword); returns the changed
    unit fields."""
    fields: list[str] = []
    if outcome.stat and getattr(unit, outcome.stat) is not None:  # a written "D6" or "-" has no number to lower
        setattr(unit, outcome.stat, max(0, getattr(unit, outcome.stat) - 1))
        fields.append(outcome.stat)
    if outcome.special or outcome.mutation:
        if outcome.mutation:  # the special the random mutation table gives (random_mutations.py)
            special = mutation_special(*outcome.mutation, campaign_id)
        else:
            special = injury_special(outcome.special or "", campaign_id)
        links = unit.hero_specials if hasattr(unit, "hero_specials") else unit.hireling_specials
        if not links.filter(special=special).exists():
            links.create(special=special)
    return fields


def granted_specials() -> list[str]:
    """The specials the tables grant by name, which seed_spells_and_special seeds as the book's."""
    ranges = (*_D66_RANGES, *_D100_RANGES)
    return list(dict.fromkeys(effect["special"] for *_, effect in ranges if effect["kind"] == "special"))


@cache
def book_texts() -> dict[tuple[int, int], str]:
    """The book's line for each D66 result, by its roll range (the catalogue import's `out/serious-injuries.json`)."""
    return {(row["low"], row["high"]): row["text"] for row in read_json_list(IMPORT_OUT / "serious-injuries.json")}


def _rows(
    ranges: list[tuple[int, int, str, dict[str, Any]]], texts: dict[tuple[int, int], str]
) -> list[dict[str, Any]]:
    return [
        {"low": low, "high": high, "label": label, "effect": _copy(effect), "text": texts.get((low, high), "")}
        for low, high, label, effect in ranges
    ]


def injury_tables() -> dict[str, list[dict[str, Any]]]:
    """The tables as postbattle shows them (IMP-52): each result's roll range (a d66 range runs over its codes),
    label, effect and the book's line (the D66's only; the D6's and the D100's have none). A d6 (henchmen, and
    hirelings on the henchman table) is Dead on 1-2."""
    d6 = [(1, 2, "Dead", DEAD), (3, 6, "Survives", NONE)]
    return {"d6": _rows(d6, {}), "d66": _rows(_D66_RANGES, book_texts()), "d100": _rows(_D100_RANGES, {})}
