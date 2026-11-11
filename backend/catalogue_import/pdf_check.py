"""Checks the PDF warbands' source files (`sources/pdf-warbands/`, pdf_warbands.py) so that one careful read of a PDF
is checked by a script rather than read again (William, 5 Nov 2026: "make sure we can extract this data cheaply").
`python -I catalogue_import/check_pdf.py` (from backend/, in the lint container) prints each file's problems and what
it found; the gate's tests run the same check over every file (tests/test_pdf_warbands.py).

A file is checked for its shape against the snapshot pages' (the keys a page, list, line, fighter and rule hold, and
their types); each stat a whole number from 0 to 10 or written ("D6", "3(4)", "-"); its costs, list and brace prices
whole numbers; its counts and group sizes (min no more than max, a hero with no group size); its starting gold and most
models; every list a fighter names there, and every list someone's; every line's note read into who may take it; and
every item, alias, skill group, skill (a fighter's starting skills among them), race, spell lore and warband type it
names matched to our catalogue, or a
declared stub that matches nothing of ours; a stub's rules a shared item rule of ours (or a page's) or its own name and
text; a price it adds dice to before any multiplier ("100 + D6x10"); and a price row's item ours or a stub a page declares, and named by a line, and the warband types it serves ours; and its upgrade groups' shape (`mutations`).
"""

import copy
import re
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import load_json, loose_key, norm_name, slugify
from catalogue_import.pdf_warbands import ORIGIN, SHARED, lines_of, put_aliases_right
from catalogue_import.sources import OUT
from catalogue_import.template_fighters import STATS, FighterLog, race_of
from catalogue_import.template_lists import Fighter, ItemIndex, plain, read_note

WRITTEN = re.compile(r"^(\d{1,2}\(\d{1,2}\)|\d*D\d+(\+\d+)?|-)$")
SKILLS = ("combat", "shooting", "academic", "strength", "speed", "special")
STUB_TYPES = ("Weapon", "Armour", "Miscellaneous")
# key -> (what it must be, required); a page, its parts and the keys pdf_warbands.py adds
Spec = dict[str, tuple[type | tuple[type, ...], bool]]
PAGE: Spec = {
    "warbandType": (str, True),
    "name": (str, True),
    "source": (str, True),
    "sourceLink": (str, True),
    "warbandRules": (dict, True),
    "specialRules": (list, True),
    "equipmentLists": (list, True),
    "specialEquipment": (list, False),
    "fighters": (list, True),
    "skillGroup": (dict, False),
    "specialSkillsList": (list, False),
    SHARED: (dict, False),
    "aliases": (list, True),
    "stubs": (list, True),
    "mutations": (list, False),
    "itemRules": (list, False),
    "priceRows": (list, False),
    "flags": (list, True),
}
WARBAND_RULES: Spec = {"startingGc": (int, True), "maxModels": (int, True)}
RULE: Spec = {"rulename": (str, True), "ruleFull": (str, True)}
LIST: Spec = {"id": (str, True), "title": (str, True), "caveat": (str, True), "items": (list, True)}
LINE: Spec = {"name": (str, True), "alias": (str, True), "cost": (dict, True)}
COST: Spec = {"cost": (int, True), "costPrefix": (str, False), "costSuffix": (str, False), "braceCost": (int, False)}
SPECIAL: Spec = {
    "title": (str, True),
    "alias": (str, False),
    "cost": (dict, True),
    "availability": (str, True),
    "maxQty": (int, False),
}
FIGHTER: Spec = {
    "id": (str, True),
    "type": (str, True),
    "name": (str, True),
    "plural": (str, True),
    "race": (str, True),
    "minQty": (int, True),
    "maxQty": (int, False),
    "groupSize": (dict, False),
    "costGc": (int, True),
    "startingXp": (int, False),
    "gainExp": (bool, False),
    "promotable": (bool, False),
    "statblock": (dict, True),
    "equipmentLists": (list, True),
    "skillAccess": (dict, False),
    "skillGroups": (list, False),
    "skills": (list, False),  # the skills he starts with, by our names
    "equipment": (str, False),
    "spellLores": (list, False),
    "specialRules": (list, True),
}
GROUP: Spec = {"min": (int, True), "max": (int, True)}
SKILL_GROUP: Spec = {"name": (str, True), "new": (bool, True), "note": (str, False)}
SHARED_GROUP: Spec = {"name": (str, True), "note": (str, False), "types": (list, True), "skills": (list, True)}
NOTE_MAX = 200  # a group's learn_note
SKILL: Spec = {"name": (str, True), "description": (str, False), "ours": (str, False), "pdfName": (str, False)}
ALIAS: Spec = {"pdf": (str, True), "ours": (str, True), "page": (int, True)}
STUB: Spec = {
    "name": (str, True),
    "cost": ((int, type(None)), False),  # the setting's trading list, where it differs from the line's price
    "type": (str, True),
    "subtype": (str, True),
    "rarity": ((int, type(None)), True),
    "dice": ((int, type(None)), True),
    "diceMultiplier": ((int, type(None)), False),  # "100 + D6x10": dice 1, diceMultiplier 10
    "rulesPage": (int, True),
    "range": (str, False),
    "strength": (str, False),
    "save": (str, False),
    "rules": (list, False),
    "statblock": (list, False),
    "note": (str, False),
}
STUB_RULE: Spec = {
    "rule": (str, False),
    "name": (str, False),
    "summary": (str, False),
    "text": (str, False),
    "tables": (list, False),
}
UPGRADE_GROUP: Spec = {"mutationName": (str, True), "mutationflavour": (str, True), "items": (list, True)}
UPGRADE: Spec = {"heading": (str, True), "cost": (str, True), "ruleFull": (str, True)}
ITEM_RULE: Spec = {
    "name": (str, True),
    "summary": (str, False),
    "text": (str, True),
    "tables": (list, False),
    "ours": (list, False),
    "page": (int, True),
}
PRICE_ROW: Spec = {
    "name": (str, True),
    "cost": ((int, type(None)), False),  # a row for an item no line of the page sells
    "rarity": ((int, type(None)), True),
    "dice": ((int, type(None)), True),
    "diceMultiplier": ((int, type(None)), False),  # "100 + D6x10": dice 1, diceMultiplier 10
    "types": (list, False),  # the warband types it serves, the page's own among them (a setting's shop list)
    "note": (str, False),
    "page": (int, True),
}
FLAG: Spec = {"page": (int, True), "what": (str, True)}


@dataclass
class Catalogue:
    """What a file's names are matched against: our items (the stubs left out), skill groups and skills (the PDF
    pages' own left out), races, spell lores and warband types."""

    items: ItemIndex
    groups: dict[str, set[str]]
    skills: set[str]  # norm names
    races: set[str]
    lores: set[str]
    types: set[str]
    item_rules: set[str] = field(default_factory=set)  # shared item rules' names and aliases, norm names
    shared_groups: set[str] = field(default_factory=set)  # the groups the pages share between warband types
    page_skills: set[str] = field(default_factory=set)  # the new skills the pages declare, norm names
    page_stubs: set[str] = field(default_factory=set)  # the stubs the pages declare, loose keys


def load_catalogue(pages: dict[str, dict[str, Any]], races: set[str], lores: set[str]) -> Catalogue:
    """Our catalogue as out/ holds it, less what the PDF pages bring (their stubs, groups and new skills)."""
    own_groups = {page["skillGroup"]["name"] for page in pages.values() if page.get("skillGroup", {}).get("new")}
    own_groups |= {page[SHARED]["name"] for page in pages.values() if page.get(SHARED)}
    own_skills = {
        norm_name(row["name"])
        for page in pages.values()
        for rows in (page.get("specialSkillsList") or [], (page.get(SHARED) or {}).get("skills") or [])
        for row in rows
        if "description" in row
    }
    return Catalogue(
        ItemIndex(item for item in load_json(OUT / "items.json") if item.get("origin") != ORIGIN),
        {
            row["name"]: set(row["skills"])
            for row in load_json(OUT / "skill-groups.json")
            if row["name"] not in own_groups
        },
        {norm_name(row["name"]) for row in load_json(OUT / "skills.json")} - own_skills,
        races,
        lores,
        {row["slug"] for row in load_json(OUT / "warband-types.json")},
        {norm_name(name) for row in load_json(OUT / "item-rules.json") for name in [row["name"], *row["aliases"]]}
        | {norm_name(row["name"]) for page in pages.values() for row in page.get("itemRules") or []},
        {page[SHARED]["name"] for page in pages.values() if page.get(SHARED)},
        own_skills,
        {loose_key(stub["name"]) for page in pages.values() for stub in page.get("stubs") or []},
    )


@dataclass
class Found:
    """What a file's check found besides its problems, for the summary."""

    problems: list[str] = field(default_factory=list)
    lines: int = 0
    by: dict[str, int] = field(default_factory=dict)  # how lines were matched -> how many
    stubs: list[str] = field(default_factory=list)


def shape(value: Any, spec: Spec, where: str, problems: list[str]) -> bool:
    """A dict holding only the spec's keys, each of its type, the required ones present."""
    if not isinstance(value, dict):
        problems.append(f"{where}: not an object")
        return False
    before = len(problems)
    problems += [f"{where}: unknown key {key!r}" for key in sorted(value.keys() - spec.keys())]
    for key, (kind, required) in spec.items():
        if key not in value:
            if required:
                problems.append(f"{where}: no {key!r}")
        elif (isinstance(value[key], bool) and kind is int) or not isinstance(value[key], kind):
            problems.append(f"{where}: {key!r} is {value[key]!r}")
    return len(problems) == before


def _each(rows: Any, spec: Spec, where: str, problems: list[str]) -> list[dict[str, Any]]:
    """The rows of a list key that have the spec's shape (the others reported)."""
    good = []
    for n, row in enumerate(rows if isinstance(rows, list) else []):
        own: list[str] = []
        if shape(row, spec, f"{where} {n + 1}", own):
            good.append(row)
        problems += own
    return good


def _stats(fighter: dict[str, Any], where: str, problems: list[str]) -> None:
    block = fighter["statblock"]
    if set(block) != set(STATS):
        problems.append(f"{where}: its profile should hold {', '.join(STATS)}")
    for key, value in block.items():
        number = isinstance(value, int) and not isinstance(value, bool)
        if not (number and 0 <= value <= 10) and not (isinstance(value, str) and WRITTEN.match(value)):
            problems.append(f"{where}: {key} {value!r} is no stat")


def _counts(fighter: dict[str, Any], where: str, problems: list[str]) -> None:
    low, high = fighter["minQty"], fighter.get("maxQty")
    if low < 0 or (high is not None and high < max(low, 1)):
        problems.append(f"{where}: {low}-{high} is no count")
    group = fighter.get("groupSize")
    if fighter["type"] == "hero":
        if group is not None or "startingXp" not in fighter or "skillAccess" not in fighter:
            problems.append(f"{where}: a hero has starting XP and skill access, and no group size")
    elif "gainExp" not in fighter or "promotable" not in fighter:
        problems.append(f"{where}: a henchman says whether he gains XP and can be promoted")
    if group is not None and shape(group, GROUP, f"{where} group size", problems):
        if not 1 <= group["min"] <= group["max"]:
            problems.append(f"{where}: group size {group['min']}-{group['max']}")
    access = fighter.get("skillAccess")
    if access is not None and (set(access) != set(SKILLS) or not all(isinstance(v, bool) for v in access.values())):
        problems.append(f"{where}: skill access should tick {', '.join(SKILLS)} true or false")


def _fighters(slug: str, page: dict[str, Any], catalogue: Catalogue, problems: list[str]) -> None:
    lists = {raw["id"] for raw in page["equipmentLists"]}
    named: set[str] = set()
    # a fighter's own groups: ours, the page's own group, or the group it shares with other warband types
    known = set(catalogue.groups) | catalogue.shared_groups | {(page.get("skillGroup") or {}).get("name")}
    for fighter in _each(page["fighters"], FIGHTER, "fighter", problems):
        where = f"fighter {fighter['name']}"
        if fighter["type"] not in ("hero", "henchman"):
            problems.append(f"{where}: type {fighter['type']!r}")
            continue
        _stats(fighter, where, problems)
        _counts(fighter, where, problems)
        _each(fighter["specialRules"], RULE, f"{where} rule", problems)
        named |= set(fighter["equipmentLists"])
        problems += [f"{where}: no list {key!r}" for key in fighter["equipmentLists"] if key not in lists]
        problems += [
            f"{where}: no lore {lore!r}" for lore in fighter.get("spellLores") or [] if lore not in catalogue.lores
        ]
        problems += [
            f"{where}: no skill group {name!r}" for name in fighter.get("skillGroups") or [] if name not in known
        ]
        held = catalogue.skills | catalogue.page_skills
        problems += [
            f"{where}: no skill of ours {name!r} to start with"
            for name in fighter.get("skills") or []
            if norm_name(name) not in held
        ]
        log = FighterLog()
        race_of(slug, fighter, catalogue.races, log)
        problems += [f"{where}: no race of ours for {race!r}" for _p, _f, race in log.no_race + log.unknown_races]
    problems += [f"list {key!r}: no fighter buys from it" for key in sorted(lists - named)]


def _notes(page: dict[str, Any], problems: list[str]) -> None:
    fighters = [
        Fighter(slugify(row["id"]), row["type"], plain(row["name"]), plain(row["plural"]), plain(row["race"]))
        for row in page["fighters"]
    ]
    for raw in page["equipmentLists"]:
        for entry in raw["items"]:
            note = entry["cost"].get("costSuffix")
            if note and not read_note(note, fighters).read:
                problems.append(f"{raw['title']}, {entry['name']}: the note {note!r} isn't read")


def _items(page: dict[str, Any], catalogue: Catalogue, found: Found) -> None:
    """Every line's item ours or a stub, every stub nothing of ours and named by a line, every alias ours and used."""
    stubs = {loose_key(stub["name"]): stub["name"] for stub in page["stubs"]}
    for stub in page["stubs"]:
        item, how = catalogue.items.find(stub["name"])
        if item is not None:
            found.problems.append(f"stub {stub['name']!r}: our {item['name']!r} ({how or 'its name'}), link it")
        if stub["type"] not in STUB_TYPES:
            found.problems.append(f"stub {stub['name']!r}: type {stub['type']!r}")
        if stub.get("diceMultiplier") and not stub.get("dice"):
            found.problems.append(f"stub {stub['name']!r}: a dice multiplier needs dice")
        for rule in _each(stub.get("rules") or [], STUB_RULE, f"stub {stub['name']} rule", found.problems):
            if "rule" in rule and ("name" in rule or norm_name(rule["rule"]) not in catalogue.item_rules):
                found.problems.append(f"stub {stub['name']!r}: {rule['rule']!r} is no shared item rule of ours")
            elif "rule" not in rule and not (rule.get("name") and rule.get("text")):
                found.problems.append(f"stub {stub['name']!r}: a rule is a shared one's name, or its own name and text")
    for row in page["aliases"]:
        if catalogue.items.find(row["ours"])[0] is None:
            found.problems.append(f"alias {row['pdf']!r}: no item of ours is {row['ours']!r}")
    fixed = copy.deepcopy(page)
    put_aliases_right(fixed)
    used: set[str] = set()
    for title, name, _cost in lines_of(fixed):
        found.lines += 1
        item, how = catalogue.items.find(name, [page["name"]])
        if item is None and loose_key(name) in stubs:
            used.add(stubs[loose_key(name)])
            how = "a stub"
        elif item is None:
            found.problems.append(f"{title}, {name}: no item of ours and no stub")
            continue
        found.by[how or "its name"] = found.by.get(how or "its name", 0) + 1
    found.stubs = sorted(used)
    found.problems += [f"stub {name!r}: no line names it" for name in sorted(set(stubs.values()) - used)]
    raw_names = {norm_name(name) for _title, name, _cost in lines_of(page)}
    line_names = {norm_name(name) for _title, name, _cost in lines_of(fixed)}
    ours = {item["name"] for item in catalogue.items.items}
    for row in page.get("itemRules") or []:
        found.problems += [
            f"shared item rule {row['name']!r}: no item of ours {name!r}"
            for name in row.get("ours") or []
            if name not in ours
        ]
    for row in page.get("priceRows") or []:
        if catalogue.items.find(row["name"])[0] is None and loose_key(row["name"]) not in catalogue.page_stubs:
            found.problems.append(f"price row {row['name']!r}: no item of ours and no stub any page declares")
        elif row.get("cost") is None and norm_name(row["name"]) not in line_names:
            found.problems.append(f"price row {row['name']!r}: no line names it, and it has no cost of its own")
        if row.get("diceMultiplier") and not row.get("dice"):
            found.problems.append(f"price row {row['name']!r}: a dice multiplier needs dice")
        found.problems += [
            f"price row {row['name']!r}: no warband type {slug!r}"
            for slug in row.get("types") or []
            if slug not in catalogue.types
        ]
        if row.get("types") and page["warbandType"] not in row["types"]:
            found.problems.append(f"price row {row['name']!r}: the page's own type isn't one of its types")
    found.problems += [
        f"alias {row['pdf']!r}: no line" for row in page["aliases"] if norm_name(row["pdf"]) not in raw_names
    ]


def _group_skills(where: str, rows: list[dict[str, Any]], catalogue: Catalogue, problems: list[str]) -> None:
    """Each of a group's skills new (its description) or one of ours (`ours`), and no new one named as ours."""
    for row in rows:
        if ("description" in row) == ("ours" in row):
            problems.append(f"{where} {row['name']!r}: a description (new) or the skill of ours it is")
        elif "ours" in row and norm_name(row["ours"]) not in catalogue.skills:
            problems.append(f"{where} {row['name']!r}: no skill of ours {row['ours']!r}")
        elif "description" in row and norm_name(row["name"]) in catalogue.skills:
            problems.append(f"{where} {row['name']!r}: one of our skills holds the name, use it or name it apart")


def _shared_group(page: dict[str, Any], catalogue: Catalogue, problems: list[str]) -> None:
    """A group one page declares for several warband types: its shape, its types ours, its skills, its note."""
    group = page[SHARED]
    if not shape(group, SHARED_GROUP, "shared skill group", problems):
        return
    where = f"shared skill group {group['name']!r}"
    if group["name"] in catalogue.groups:
        problems.append(f"{where}: we have it already")
    problems += [f"{where}: no warband type {slug!r}" for slug in group["types"] if slug not in catalogue.types]
    if page["warbandType"] not in group["types"]:
        problems.append(f"{where}: the page's own type isn't one of its types")
    if len(group.get("note") or "") > NOTE_MAX:
        problems.append(f"{where}: its note is over {NOTE_MAX} characters")
    _group_skills("shared skill", _each(group["skills"], SKILL, "shared skill", problems), catalogue, problems)


def _skills(page: dict[str, Any], catalogue: Catalogue, problems: list[str]) -> None:
    group, rows = page["skillGroup"], _each(page["specialSkillsList"], SKILL, "special skill", problems)
    _group_skills("special skill", rows, catalogue, problems)
    note = group.get("note") or ""
    if note and not group["new"]:
        problems.append(f"skill group {group['name']!r}: only a new group takes a note")
    if len(note) > NOTE_MAX:
        problems.append(f"skill group {group['name']!r}: its note is over {NOTE_MAX} characters")
    if group["new"] and group["name"] in catalogue.groups:
        problems.append(f"skill group {group['name']!r}: we have it already")
    elif not group["new"]:
        held = catalogue.groups.get(group["name"])
        if held is None:
            problems.append(f"skill group {group['name']!r}: no such group of ours")
        problems += [
            f"skill group {group['name']!r}: holds no {row['ours']!r}"
            for row in rows
            if held is not None and row.get("ours") not in held
        ]


def check_page(slug: str, page: dict[str, Any], catalogue: Catalogue) -> Found:
    """A file's problems (none: it is good to build) and what it found."""
    found = Found()
    problems = found.problems
    if not shape(page, PAGE, slug, problems):
        return found
    if page["warbandType"] != slug or slug not in catalogue.types:
        problems.append(f"{slug}: warbandType {page['warbandType']!r} is no type of ours named as the file")
    shape(page["warbandRules"], WARBAND_RULES, "warband rules", problems)
    if ("skillGroup" in page) != ("specialSkillsList" in page):
        problems.append(f"{slug}: a skill group and its special skills, or neither (no Special column)")
    elif "skillGroup" in page:
        shape(page["skillGroup"], SKILL_GROUP, "skill group", problems)
    checks: list[tuple[Any, Spec, str]] = [
        (page["specialRules"], RULE, "warband rule"),
        (page["aliases"], ALIAS, "alias"),
        (page["stubs"], STUB, "stub"),
        (page.get("mutations") or [], UPGRADE_GROUP, "upgrade group"),
        (page.get("itemRules") or [], ITEM_RULE, "shared item rule"),
        (page.get("priceRows") or [], PRICE_ROW, "price row"),
        (page["flags"], FLAG, "flag"),
        (page.get("specialEquipment") or [], SPECIAL, "special equipment"),
    ]
    for rows, spec, where in checks:
        _each(rows, spec, where, problems)
    for entry in page.get("specialEquipment") or []:
        shape(entry.get("cost"), COST, f"special equipment {entry.get('title')} cost", problems)
    for group in page.get("mutations") or []:
        _each(group.get("items") or [], UPGRADE, f"{group.get('mutationName')} upgrade", problems)
    for raw in _each(page["equipmentLists"], LIST, "list", problems):
        for line in _each(raw["items"], LINE, f"{raw['title']} line", problems):
            shape(line["cost"], COST, f"{raw['title']}, {line['name']} cost", problems)
    if problems:
        return found  # the matching below reads the shape it checked
    _fighters(slug, page, catalogue, problems)
    _notes(page, problems)
    _items(page, catalogue, found)
    if page.get(SHARED):
        _shared_group(page, catalogue, problems)
    if "skillGroup" in page:
        _skills(page, catalogue, problems)
    else:
        problems += [
            f"fighter {row['name']}: ticks Special, but the page has no skill group"
            for row in page["fighters"]
            if (row.get("skillAccess") or {}).get("special")
        ]
    return found
