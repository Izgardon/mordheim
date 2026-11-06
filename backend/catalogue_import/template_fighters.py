"""A warband template's fighters from a snapshot page: kind, counts, the first profile as written, race, skill groups
(a variant's table where it differs), spell lores, the caster, leader and Large flags, and his rules as specials (the
template's own, "Warband - Mercenaries", or our Large, Wizard and Priest)."""

from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import loose_key, norm_name, slugify
from catalogue_import.template_answers import (
    CASTERS,
    CORE_SKILLS,
    CREATURES,
    LORES,
    MAGIC_WARBANDS,
    RACES,
    RACES_BY_FIGHTER,
    RACES_BY_PAGE,
    SPECIAL_ADDED,
    SPECIAL_GROUPS,
    SPECIAL_GROUPS_BY_FIGHTER,
    VARIANT_COUNTS,
    VARIANT_STATS,
)
from catalogue_import.template_lists import plain
from catalogue_import.template_text import clean_rule, clean_title

STATS = {
    "m": "movement",
    "ws": "weapon_skill",
    "bs": "ballistic_skill",
    "s": "strength",
    "t": "toughness",
    "w": "wounds",
    "i": "initiative",
    "a": "attacks",
    "ld": "leadership",
}
LARGE_RULES = {"large", "large target", "large monster"}
OURS = {"large": ("Large", "Trait"), "wizard": ("Wizard", "Caster"), "priest": ("Priest", "Caster")}


def is_prayers(lore: str) -> bool:
    """A lore a priest casts from: prayers, or the Funerary Rites of a Priest of Morr, who "is not a wizard" (the
    Vampire Hunters of Sylvania's PDF, p11)."""
    return "Prayers" in lore or lore.startswith("Funerary Rites")


@dataclass
class FighterLog:
    """What the report lists about the fighters."""

    written: list[tuple[str, str, dict[str, str]]] = field(default_factory=list)  # page, fighter, written stats
    several_profiles: list[tuple[str, str, list[str]]] = field(default_factory=list)
    no_race: list[tuple[str, str, str]] = field(default_factory=list)  # page, fighter, mordheimer's race ("": none)
    unknown_races: list[tuple[str, str, str]] = field(default_factory=list)  # a race we don't have
    creatures: list[tuple[str, str, str]] = field(default_factory=list)
    no_special_group: list[tuple[str, str]] = field(default_factory=list)
    lores: dict[str, str] = field(default_factory=dict)  # magic.json's lore -> ours, where they differ
    unplaced_casters: list[str] = field(default_factory=list)  # magic.json lines no page fighter matches
    casters: list[tuple[str, str, str, list[str]]] = field(default_factory=list)  # page, fighter, caster, lores


def profile(page: str, fighter: dict[str, Any], log: FighterLog) -> dict[str, int | str]:
    """The nine characteristics of his first profile: a whole number, or the value as written ("1(2)", "D6", "-")."""
    block = fighter["statblock"]
    if isinstance(block, list):
        log.several_profiles.append((page, fighter["name"], [plain(row.get("title") or "?") for row in block]))
        block = block[0]
    stats: dict[str, int | str] = {}
    written: dict[str, str] = {}
    for short, name in STATS.items():
        value = block.get(short)
        text = str(value).strip().replace("–", "-") if value is not None else "-"
        if isinstance(value, int) and not isinstance(value, bool):
            stats[name] = value
        elif text.isdigit():
            stats[name] = int(text)
        else:
            stats[name] = written[name] = text
    if written:
        log.written.append((page, fighter["name"], written))
    return stats


def race_of(page: str, fighter: dict[str, Any], races: set[str], log: FighterLog) -> str | None:
    """Our race for his: a warband's own maximum where it has one, None for a creature or where none fits."""
    raw = norm_name(fighter.get("race") or "")
    named = RACES_BY_FIGHTER.get((page, plain(fighter["name"])))
    name = named or RACES_BY_PAGE.get((page, raw)) or RACES.get(raw)
    if raw in CREATURES and named is None:
        log.creatures.append((page, fighter["name"], raw))
        return None
    if name is None:
        log.no_race.append((page, fighter["name"], raw))
        return None
    if name not in races:
        log.unknown_races.append((page, fighter["name"], name))
    return name


def _table(ticks: dict[str, Any], specials: list[str]) -> list[str]:
    names = [name for key, name in CORE_SKILLS if ticks.get(key)]
    return names + (specials if ticks.get("special") else [])


def skill_types(
    page: str,
    fighter: dict[str, Any],
    variants: list[dict[str, str]],
    log: FighterLog,
    own: list[str] | None = None,
) -> tuple[list[str], dict[str, Any]]:
    """His skill groups (the first variant's table) and, by variant key, the tables that differ from it. The Special
    tick names the page's own group (`own`: a PDF page's), else template_answers' for the page."""
    access = fighter.get("skillAccess")
    if not access:
        return [], {}
    name = fighter["name"]
    specials = SPECIAL_GROUPS_BY_FIGHTER.get((page, name)) or own or SPECIAL_GROUPS.get(page, [])
    if isinstance(access, dict):
        tables = {"": {**access, **({"special": True} if name in SPECIAL_ADDED.get(page, []) else {})}}
        keyed = [("", "")]
    else:
        tables = {entry.get("subfaction") or "": entry.get("skills") or {} for entry in access}
        keyed = [(variant["key"], variant["subfaction"]) for variant in variants] or [("", next(iter(tables)))]
    if any(table.get("special") for table in tables.values()) and not specials:
        log.no_special_group.append((page, name))
    base = _table(tables.get(keyed[0][1]) or next(iter(tables.values())), specials)
    changes = {}
    for key, subfaction in keyed[1:]:
        table = _table(tables.get(subfaction, {}), specials)
        if table != base:
            changes[key] = {"skill_types": table}
    return base, changes


class Lores:
    """Who casts from which lore (magic.json, plus William's three), as our spells' lore names."""

    def __init__(self, magic: dict[str, Any], pages: dict[str, dict[str, Any]], ours: set[str], log: FighterLog):
        self.by_fighter: dict[tuple[str, str], list[dict[str, str]]] = {}
        by_name = {norm_name(page["name"]): slug for slug, page in pages.items()}
        loose = {loose_key(name): name for name in ours}
        for raw in magic["spellLists"].values():
            lore = LORES.get(raw["name"]) or loose.get(loose_key(raw["name"]), raw["name"])
            if lore != raw["name"]:
                log.lores[raw["name"]] = lore
            for line in raw.get("permittedWarbands") or []:
                if not isinstance(line, dict) or not line.get("warband"):
                    continue  # a hired sword's or a dramatis persona's lore
                slug = MAGIC_WARBANDS.get(line["warband"]) or by_name.get(norm_name(line["warband"]))
                fighter = self._fighter(pages.get(slug or ""), line["fighter"])
                if slug is None or fighter is None:
                    log.unplaced_casters.append(f"{raw['name']}: {line['warband']}, {line['fighter']}")
                    continue
                note = plain(line.get("prerequisite"))
                self.by_fighter.setdefault((slug, fighter), []).append({"name": lore, "note": note})
        for (slug, fighter), lore in CASTERS.items():
            self.by_fighter.setdefault((slug, fighter), []).append({"name": lore, "note": ""})

    @staticmethod
    def _fighter(page: dict[str, Any] | None, name: str) -> str | None:
        """The page's fighter of the name, or the one whose name ends with it ("Sorcerer": the Eshin Sorcerer)."""
        if page is None:
            return None
        names: list[str] = [fighter["name"] for fighter in page["fighters"]]
        exact = [found for found in names if loose_key(found) == loose_key(name)]
        ending = [found for found in names if loose_key(found).endswith(loose_key(name))]
        found = exact or ending
        return found[0] if found else None

    def of(self, page: str, name: str) -> list[dict[str, str]]:
        return self.by_fighter.get((page, name), [])


def rules(fighter: dict[str, Any], owner: str) -> tuple[list[dict[str, str]], bool, bool]:
    """His rules as specials (ours for Large, Wizard and Priest), whether he leads and whether he is Large."""
    specials: list[dict[str, str]] = []
    leader = large = False
    for raw in fighter.get("specialRules") or []:
        name = clean_title(raw.get("rulename"))
        key = name.lower()
        leader = leader or key == "leader"
        large = large or key in LARGE_RULES
        ours = OURS.get("large" if key in LARGE_RULES else key)
        special = (
            {"name": ours[0], "type": ours[1]}
            if ours
            else {"name": name, "type": owner, "description": clean_rule(raw.get("ruleFull"))}
        )
        if name and special["name"] not in [entry["name"] for entry in specials]:
            specials.append(special)
    return specials, leader, large


def _plus(value: int | str, amount: int) -> int | str:
    """A stat as written, its number raised by `amount` ("1(2)" and 1: "2(2)"); text with no number stays."""
    if isinstance(value, int):
        return value + amount
    text = str(value)
    digits = len(text) - len(text.lstrip("0123456789"))
    return f"{int(text[:digits]) + amount}{text[digits:]}" if digits else text


def variant_numbers(page: str, name: str, stats: dict[str, int | str], changes: dict[str, Any]) -> None:
    """A variant's numbers for the fighter, into his `variant_changes`: his profile as the variant has it
    (VARIANT_STATS, `stats` written as the book writes them) and his most (VARIANT_COUNTS)."""
    for variant, fighters in VARIANT_STATS.get(page, {}).items():
        if name in fighters:
            raised = {stat: _plus(stats[stat], amount) for stat, amount in fighters[name].items()}
            changes.setdefault(variant, {})["stats"] = raised
    for variant, counts in VARIANT_COUNTS.get(page, {}).items():
        if name in counts:
            changes.setdefault(variant, {})["max_count"] = counts[name]


def plural_of(fighter: dict[str, Any]) -> str:
    """mordheimer's plural, its "-mens" slip mended ("Marksmens" is "Marksmen", "Underclassmens" "Underclassmen")."""
    text = plain(fighter.get("plural"))
    return text[:-1] if text.endswith("mens") else text


def build_fighter(
    page: str, fighter: dict[str, Any], context: dict[str, Any], lists: list[str], log: FighterLog
) -> dict[str, Any]:
    """One fighter in the template's shape (`context`: variants, races, lores, owner)."""
    hero = fighter["type"] == "hero"
    lores = context["lores"].of(page, fighter["name"])
    specials, leader, large = rules(fighter, context["owner"])
    base, changes = skill_types(page, fighter, context["variants"], log, context.get("special_groups"))
    stats = profile(page, fighter, log)
    variant_numbers(page, plain(fighter["name"]), stats, changes)
    caster = ("Priest" if all(is_prayers(lore["name"]) for lore in lores) else "Wizard") if lores else "No"
    if lores:
        log.casters.append((page, fighter["name"], caster, [lore["name"] for lore in lores]))
    group = fighter.get("groupSize") or {}
    return {
        "key": slugify(fighter["id"]),
        "kind": "hero" if hero else "henchman",
        "name": plain(fighter["name"]),
        "plural": plural_of(fighter),
        "race": race_of(page, fighter, context["races"], log),
        "cost": fighter.get("costGc") or 0,
        "starting_xp": fighter.get("startingXp") or 0,
        "min_count": fighter.get("minQty") or 0,
        "max_count": fighter.get("maxQty"),
        "group_min": None if hero else group.get("min"),
        "group_max": None if hero else group.get("max"),
        "stats": stats,
        "skill_types": base,
        "spell_types": lores,
        "gains_xp": hero or fighter.get("gainExp") is not False,
        "promotable": hero or fighter.get("promotable") is not False,
        "is_leader": leader,
        "caster": caster,
        "large": large,
        "variant_changes": changes,
        "fixed_kit": plain(fighter.get("equipment")),
        "lists": lists,
        "specials": specials,
    }
