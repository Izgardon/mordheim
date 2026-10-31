"""Warband groups: races from Broheim's race field, sides from mordheimer's hiring sentences. Anything unsure
becomes a question for William in the report."""

import re
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import as_list, norm_name
from catalogue_import.text import clean_inline
from catalogue_import.warbands import Resolver


@dataclass
class GroupDef:
    slug: str
    name: str
    kind: str  # "race" or "side"
    races: set[str] = field(default_factory=set)
    include: dict[str, str] = field(default_factory=dict)  # type slug -> why
    exclude: set[str] = field(default_factory=set)  # types named beside the group in its evidence sentences
    hire_pattern: str = ""  # hired-sword / dramatis persona permissiontext naming the group
    item_phrase: str = ""  # an item note "<phrase> only" naming the group
    by_evidence: bool = False  # members are the types most of the evidence lists name
    questions: list[str] = field(default_factory=list)


GROUP_DEFS = [
    GroupDef(
        "humans",
        "Humans",
        "race",
        {"Human", "Human Wizard", "Human Mutant", "Chaos Human", "Chaos Human/Demon"},
        hire_pattern=r"any human warband",
        item_phrase="humans",  # chaos humans count too (William, 29 Oct 2026)
    ),
    GroupDef(
        "elves",
        "Elves",
        "race",
        {"High Elf", "Wood Elf", "Dark Elf"},
        item_phrase="elves",  # Dark Elves count, as mordheimer's "Elves only" Elven Steed reads (William, 29 Oct 2026)
    ),
    GroupDef(
        "dwarfs",
        "Dwarfs",
        "race",
        {"Dwarf"},
        item_phrase="dwarfs",  # Chaos Dwarfs are their own group, not Dwarfs (William, 29 Oct 2026)
    ),
    GroupDef("chaos-dwarfs", "Chaos Dwarfs", "race", {"Chaos Dwarf"}, item_phrase="chaos dwarfs"),
    GroupDef("halflings", "Halflings", "race", {"Halfling"}),
    GroupDef("undead", "Undead", "race", {"Undead", "Vampire", "Vampire/Undead", "Wraith/Revenant"}),
    GroupDef(
        "skaven",
        "Skaven",
        "race",
        {"Skaven", "Skaven/Goblin"},
        hire_pattern=r"only (be hired by )?skaven warbands",
        item_phrase="skaven",
        questions=["The Underworld Alliance (Skaven and Goblins) is in both Skaven and Goblins. Keep?"],
    ),
    GroupDef(
        "goblins",
        "Goblins",
        "race",
        {"Goblin", "Night Goblin", "Skaven/Goblin"},
        item_phrase="goblins",
        # mordheimer's "Goblins only" items (Giant Spider, Giant Wolf, Ball and Chain) list the Orc Mob, which fields
        # goblins (kept in: William, 29 Oct 2026)
        include={"orc-mob": ""},
    ),
    GroupDef("orcs", "Orcs", "race", {"Orcs & Goblins"}, item_phrase="orcs"),
    GroupDef(
        "orcs-and-goblins",
        "Orcs & Goblins",
        "race",
        {"Orcs & Goblins", "Goblin", "Night Goblin", "Skaven/Goblin", "Snotling"},
        hire_pattern=r"greenskin warband",
        questions=["Snotlings are greenskins, so they are in Orcs & Goblins but not Goblins. Right?"],
    ),
    GroupDef("ogres", "Ogres", "race", {"Ogre", "Ogre/Gnoblar"}),
    GroupDef("lizardmen", "Lizardmen", "race", {"Lizardmen"}, hire_pattern=r"lizardmen warbands only"),
    GroupDef("beastmen", "Beastmen", "race", {"Beastmen"}),
    GroupDef("amazons", "Amazons", "race", item_phrase="amazons"),
    GroupDef("tileans", "Tileans", "race", item_phrase="tileans"),
    GroupDef(
        "chaos",
        "Chaos",
        "side",
        {"Chaos Human", "Chaos Human/Demon", "Beastmen", "Chaos Dwarf"},
        hire_pattern=r"devoted to chaos",
    ),
    GroupDef(
        "sigmarite",
        "Sigmarite",
        "side",
        include={"witch-hunters": "", "sisters-of-sigmar": ""},  # mordheimer's "not available to" pairs
    ),
    GroupDef(
        "mercenaries",
        "Mercenaries",
        "side",
        exclude={"witch-hunters"},
        by_evidence=True,
        hire_pattern=r"^(human )?mercenaries( and witch hunters)? may hire",
    ),
    GroupDef("good", "Good", "side", by_evidence=True, hire_pattern=r"any (good[- ]aligned|good|non-evil) warband"),
    GroupDef(
        "evil",
        "Evil",
        "side",
        by_evidence=True,
        hire_pattern=r"any evil warband|evilly aligned|evil or chaotically aligned",
    ),
]


def _hire_evidence(gdef: GroupDef, sources: Any, resolver: Resolver) -> list[tuple[str, list[str]]]:
    lists: list[tuple[str, list[str]]] = []
    if not gdef.hire_pattern:
        return lists
    for kind, rows in (("hired swords", sources.hired_swords), ("dramatis personae", sources.personae)):
        for row in rows:
            if re.search(gdef.hire_pattern, clean_inline(row.get("permissiontext")), re.I):
                lists.append((row["name"], resolver.resolve_all(as_list(row.get("permittedWarbands")), kind)))
    return lists


def _item_evidence(gdef: GroupDef, sources: Any, resolver: Resolver) -> list[tuple[str, list[str]]]:
    lists: list[tuple[str, list[str]]] = []
    if not gdef.item_phrase:
        return lists
    for item in sources.items:
        notes = [clean_inline(item.get(key)) for key in ("caveat", "modelCaveat", "modelcaveat")]
        if any(norm_name(note).rstrip(",. ") == f"{gdef.item_phrase} only" for note in notes):
            lists.append((item["name"], resolver.resolve_all(as_list(item.get("permittedWarbands")), "items")))
    return lists


def _majority(lists: list[tuple[str, list[str]]], exclude: set[str]) -> tuple[set[str], dict[str, int]]:
    tally: dict[str, int] = {}
    for _name, slugs in lists:
        for slug in slugs:
            if slug not in exclude:
                tally[slug] = tally.get(slug, 0) + 1
    return {slug for slug, seen in tally.items() if seen * 2 >= len(lists)}, tally


def _base_members(gdef: GroupDef, types: list[dict[str, Any]]) -> set[str]:
    members = {row["slug"] for row in types if row["race"] in gdef.races}
    if gdef.slug == "amazons":
        members |= {row["slug"] for row in types if row["name"].startswith("Amazons")}
    if gdef.slug == "tileans":
        members |= {row["slug"] for row in types if row["mordheimer_url"].endswith("/tileans")}
    known = {row["slug"] for row in types}
    return members | {slug for slug in gdef.include if slug in known}


def _name_list(slugs: list[str], names: dict[str, str], tally: dict[str, int] | None = None, of: int = 0) -> str:
    parts = [f"{names[slug]} ({tally[slug]}/{of})" if tally else names[slug] for slug in slugs]
    return ", ".join(parts)


def _questions(gdef: GroupDef, members: set[str], lists: list[tuple[str, list[str]]], ctx: dict[str, Any]) -> list[str]:
    names, order, known = ctx["names"], ctx["order"], ctx["mordheimer"]
    questions = list(gdef.questions)
    questions += [
        f"{names[slug]} is in {gdef.name}: {why}. Keep?" for slug, why in gdef.include.items() if why and slug in names
    ]
    if not lists:
        return questions
    _chosen, tally = _majority(lists, gdef.exclude)
    seen = ", ".join(name for name, _slugs in lists[:4]) + (", ..." if len(lists) > 4 else "")
    extra = sorted((slug for slug in tally if slug not in members), key=order.__getitem__)
    if extra:
        questions.append(
            f"Not in {gdef.name}, though some of the {len(lists)} mordheimer lists that mean it ({seen}) name them: "
            + _name_list(extra, names, tally, len(lists))
            + ". Add any?"
        )
    missing = sorted((slug for slug in members if slug in known and slug not in tally), key=order.__getitem__)
    if missing:
        questions.append(
            f"In {gdef.name}, but none of those lists names them: {_name_list(missing, names)}. Keep them in?"
        )
    return questions


def build_groups(
    types: list[dict[str, Any]], sources: Any, resolver: Resolver
) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    """The groups with their members, and the questions about each group's membership."""
    overrides = sources.overrides.get("group_members", {})
    ctx: dict[str, Any] = {
        "names": {row["slug"]: row["name"] for row in types},
        "order": {row["slug"]: index for index, row in enumerate(types)},
        "mordheimer": {row["slug"] for row in types if row["mordheimer_url"]},
    }
    groups, questions = [], {}
    for gdef in GROUP_DEFS:
        lists = _hire_evidence(gdef, sources, resolver) + _item_evidence(gdef, sources, resolver)
        members = _base_members(gdef, types)
        if gdef.by_evidence:
            members |= _majority(lists, gdef.exclude)[0]
        questions[gdef.slug] = _questions(gdef, members, lists, ctx)
        added = set(overrides.get("add", {}).get(gdef.slug, []))
        removed = set(overrides.get("remove", {}).get(gdef.slug, []))
        members = (members | added) - removed
        members &= set(ctx["order"])  # a slug in overrides.json that names no type is ignored
        basis = f"most of {len(lists)} mordheimer hiring lists" if gdef.by_evidence else "race field and named types"
        if added or removed:
            basis += ", adjusted in overrides.json"
        groups.append(
            {
                "slug": gdef.slug,
                "name": gdef.name,
                "kind": gdef.kind,
                "basis": basis,
                "evidence": [name for name, _slugs in lists],
                "members": sorted(members, key=ctx["order"].__getitem__),
            }
        )
    return groups, questions


def collapse(slugs: list[str], groups: list[dict[str, Any]]) -> list[dict[str, str]]:
    """A list that is exactly a group's members (two or more) becomes that group; otherwise the types."""
    wanted = set(slugs)
    for group in groups:
        if len(group["members"]) > 1 and set(group["members"]) == wanted:
            return [{"group": group["slug"]}]
    return [{"type": slug} for slug in slugs]
