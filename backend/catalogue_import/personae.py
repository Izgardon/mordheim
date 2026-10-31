"""Dramatis personae as our seeder reads them (``out/dramatis-personae.json``, next step 12), from mordheimer's.

Each of mordheimer's entries becomes one row in the shape ``seed_dramatis_personae`` reads (apps/hirelings/seeding.py):
its name, its fluff as the description, its profile, its special rules as specials, the skills and items its text
names (linked by name; a name the book lacks is left out with a warning), and its hire terms. A pair or a persona
with several guises (Ulli & Marquand, Luthor Wolfenbaum) takes the entry's own profile, else its first fighter's, and
lists the fighters in its description. Who may hire it, its fees and its hiring sentence come from ``who-can.json`` by
the same name, a fee that isn't plain gold kept as text; the fees here are only the plain numbers. One who stays a
single battle (a "Wanderer") says so; its spell lists ("knows all six Prayers of Sigmar") are kept as a special.
"""

import re
from typing import Any

from catalogue_import.common import unique
from catalogue_import.text import clean_inline

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
NAMED = re.compile(r"<(Tooltip|a)\b[^>]*>(.*?)</\1>", re.S | re.I)
LEADING_NUMBER = re.compile(r"^\s*(\d+)")
ONE_BATTLE = re.compile(r"\bwanderers?\b|for the duration of (?:the|one|a) battle|only ever stays", re.I)


def number(value: object) -> int:
    """A characteristic: the leading number of "3(4)" or "3", 0 for anything else."""
    match = LEADING_NUMBER.match(str(value)) if value is not None else None
    return int(match.group(1)) if match else 0


def plain_fee(value: object) -> int | None:
    return value if isinstance(value, int) else None


def _name(text: str) -> str:
    """A linked name, cleaned: mordheimer's broken links leave an attribute's tail ("...game\">Whip Master")."""
    return clean_inline(text.rsplit('">', 1)[-1])


def named(snippet: object) -> list[str]:
    """The names a text links (``<Tooltip>Dodge</Tooltip>``, ``<a ...>Righteous Fury</a>``), in order, once each."""
    return unique([_name(name) for _tag, name in NAMED.findall(str(snippet or "")) if _name(name)])


PLAIN_LIST = re.compile(r",\s*(?:and\s+)?|\s+and\s+")
SHORT_NAME = 40  # a plain list's names; anything longer is prose


def listed_skills(snippet: object) -> list[str]:
    """The skills a text names: its links, else a plain list after its colon ("the following skills: Horse Archer,
    Pistolier and Strongman."), prose left out."""
    linked = named(snippet)
    text = clean_inline(str(snippet or ""))
    if linked or ":" not in text:
        return linked
    names = [name.strip() for name in PLAIN_LIST.split(text.rsplit(":", 1)[1].strip().rstrip("."))]
    return unique([name for name in names if name[:1].isupper() and len(name) <= SHORT_NAME and "(" not in name])


def _fighters(entry: dict[str, Any]) -> list[dict[str, Any]]:
    return [fighter for fighter in entry.get("fighters") or [] if isinstance(fighter, dict)]


def _first(entry: dict[str, Any], key: str) -> Any:
    """The entry's own value, else its first fighter's that has one."""
    if entry.get(key):
        return entry[key]
    return next((fighter[key] for fighter in _fighters(entry) if fighter.get(key)), None)


def _description(entry: dict[str, Any]) -> str:
    parts = [clean_inline(entry.get("flavour"))]
    for fighter in _fighters(entry):
        parts.append(f"{clean_inline(fighter.get('name'))}: {clean_inline(fighter.get('flavour'))}")
    return "\n\n".join(part for part in parts if part)


def _rules(entry: dict[str, Any]) -> list[dict[str, Any]]:
    rules = [rule for rule in entry.get("specialRules") or [] if isinstance(rule, dict)]
    for fighter in _fighters(entry):
        rules += [rule for rule in fighter.get("specialRules") or [] if isinstance(rule, dict)]
    return rules


def _specials(entry: dict[str, Any], rules: list[dict[str, Any]]) -> list[dict[str, str]]:
    specials = [
        {"name": clean_inline(rule.get("rulename")), "description": clean_inline(rule.get("ruleFull"))}
        for rule in rules
        if clean_inline(rule.get("rulename"))
    ]
    spells = clean_inline(entry.get("spells"))
    if spells:
        specials.append({"name": "Spells", "description": spells})
    return specials


def _caster(entry: dict[str, Any]) -> str:
    spells = clean_inline(entry.get("spells")).lower()
    if not spells:
        return "No"
    return "Priest" if "prayer" in spells else "Wizard"


def _stays(rules: list[dict[str, Any]]) -> str:
    """ "one_battle" for a persona who leaves after the battle (a Wanderer), else "always"."""
    text = " ".join(f"{rule.get('rulename', '')} {rule.get('ruleFull', '')}" for rule in rules)
    return "one_battle" if ONE_BATTLE.search(clean_inline(text)) else "always"


class Catalogue:
    """The item and skill names our book seeds, to link a persona's kit and skills by: a name as written, else its
    singular ("Swords", "Throwing Knives"); what still matches nothing stays in the persona's description."""

    def __init__(self, items: list[str], skills: list[str]) -> None:
        self.items = {name.lower(): name for name in items}
        self.skills = {name.lower(): name for name in skills}

    @staticmethod
    def find(known: dict[str, str], name: str) -> str | None:
        key = name.lower()
        for candidate in (key, re.sub(r"ves$", "fe", key), key.removesuffix("s")):
            if candidate in known:
                return known[candidate]
        return None

    def split(self, known: dict[str, str], names: list[str]) -> tuple[list[str], list[str]]:
        """(the names it links, in its spelling; the names it lacks)."""
        found = [self.find(known, name) for name in names]
        return unique([name for name in found if name]), [
            name for name, hit in zip(names, found, strict=True) if not hit
        ]


def _unlinked(kit: list[str], skills: list[str]) -> str:
    lines = [f"{label}: {', '.join(names)}." for label, names in (("Also carries", kit), ("Also has", skills)) if names]
    return "\n".join(lines)


def persona_row(entry: dict[str, Any], catalogue: Catalogue) -> dict[str, Any]:
    """One of mordheimer's dramatis personae as a seed row."""
    statblock = _first(entry, "statblock") or {}
    if isinstance(statblock, list):  # several profiles (a horde): the first, its leader
        statblock = next((profile for profile in statblock if isinstance(profile, dict)), {})
    rules = _rules(entry)
    kit, other_kit = catalogue.split(catalogue.items, [name for name in named(_first(entry, "equipment")) if name.isprintable() and any(char.isalpha() for char in name)])  # fmt: skip
    skills, other_skills = catalogue.split(catalogue.skills, listed_skills(_first(entry, "skills")))
    return {
        "name": clean_inline(entry.get("name")),
        "description": "\n\n".join(part for part in (_description(entry), _unlinked(other_kit, other_skills)) if part),
        **{field: number(statblock.get(key)) for key, field in STATS.items()},
        "armour_save": None,
        "large": False,
        "caster": _caster(entry),
        "specials": _specials(entry, rules),
        "skills": skills,
        "spells": [],
        "equipment": [{"item": item, "quantity": 1} for item in kit],
        "dramatis_persona": {
            "hire_cost": plain_fee(entry.get("cost")),
            "upkeep_cost": plain_fee(entry.get("upkeep")),
            "rating": entry.get("rating") if isinstance(entry.get("rating"), int) else None,
            "grade": clean_inline(str(entry.get("grade") or "")),
            "race": clean_inline(str(entry.get("race") or "")).title(),
            "unique_to": clean_inline(entry.get("permissiontext")).strip('"“” '),
            "stays": _stays(rules),
            "payment_note": "",
        },
    }


def build_personae(personae: list[dict[str, Any]], catalogue: Catalogue) -> list[dict[str, Any]]:
    """``out/dramatis-personae.json``: every one of mordheimer's dramatis personae, by name."""
    rows = [persona_row(entry, catalogue) for entry in personae if clean_inline(entry.get("name"))]
    return sorted(rows, key=lambda row: row["name"].lower())
