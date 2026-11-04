"""Who can hire and who can learn (the items rebuild): mordheimer's hired swords, dramatis personae and skills, their
``permittedWarbands`` read through the Resolver as warband types or groups (each included or excluded, or everyone),
and each hire fee and upkeep as a structured fee (fees.py: "2 treasures", "70 + 3D6", "Hero", "n/a").

Hired swords and dramatis personae are listed by mordheimer's name: the seeders match their rows by name, so a
dramatis persona seeded later finds its list here. Skills are our rows (name and list): the mordheimer entry our row
takes its setting from (assignments.py) gives its list; a row mordheimer lacks is for everyone on a general list,
else as William decided for its list (overrides.json `skill_lists`: skill_lists.py), else for the warband its list
is named after. Names the Resolver can't place, and lists it can't read, go in the report.
"""

from dataclasses import dataclass, field
from typing import Any

from catalogue_import.assignments import best_entry
from catalogue_import.common import as_list, norm_name
from catalogue_import.fees import ReadFee, in_his_rules, read_fee
from catalogue_import.groups import collapse
from catalogue_import.skill_lists import SkillLists
from catalogue_import.text import clean_inline
from catalogue_import.warbands import Resolver

GENERAL_LISTS = {"combat", "shooting", "academic", "strength", "speed", "cavalry"}


@dataclass
class HiringLog:
    """What the report lists: names the Resolver left out, lists that place no one, and the fees that aren't a plain
    number (each as the source writes it and as it was read)."""

    unplaced: list[tuple[str, str, list[str]]] = field(default_factory=list)  # kind, entry, names left out
    nobody: list[tuple[str, str]] = field(default_factory=list)  # kind, entry: a list naming no type it knows
    by_list_name: list[tuple[str, str]] = field(default_factory=list)  # our skill, the list it was read from
    fees: list[tuple[str, str, object, ReadFee, object, ReadFee]] = field(
        default_factory=list
    )  # kind, entry, hire, upkeep


def who(
    names: list[str],
    excluded: list[str],
    resolver: Resolver,
    groups: list[dict[str, Any]],
    where: str,
    added: list[str] | None = None,
) -> tuple[dict[str, Any], list[str]]:
    """The who-can list of a permitted list (none: everyone) and an excluded list, and the names it left out.
    `added`: type slugs William adds to the permitted list (overrides.json `hire_warbands_add`)."""
    left_out = [name for name in names + excluded if not resolver.resolve(name, where)]
    included = resolver.resolve_all(names, where)
    included += [slug for slug in added or [] if slug not in included]
    shut_out = resolver.resolve_all(excluded, where)
    warbands = [{**entry, "excluded": False} for entry in collapse(included, groups)]
    warbands += [{**entry, "excluded": True} for entry in collapse(shut_out, groups)]
    return {"for_everyone": not names, "warbands": warbands}, left_out


def _hireling(
    kind: str,
    entry: dict[str, Any],
    resolver: Resolver,
    groups: list[dict[str, Any]],
    log: HiringLog,
    in_rules: dict[str, str],
    hire_add: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    name = clean_inline(entry.get("name"))
    permitted = as_list(entry.get("permittedWarbands"))
    added = list(hire_add.get(name, {}).get("warbands", []))
    access, left_out = who(permitted, as_list(entry.get("excludedWarbands")), resolver, groups, kind, added)
    if left_out:
        log.unplaced.append((kind, name, left_out))
    if permitted and not access["warbands"]:
        log.nobody.append((kind, name))
    note = clean_inline(entry.get("permissiontext")).strip('"“” ')
    hire, upkeep = read_fee(entry.get("cost"), upkeep=False), read_fee(entry.get("upkeep"), upkeep=True)
    if name in in_rules:
        hire = in_his_rules(hire, note)
    if not (hire.plain and upkeep.plain):
        log.fees.append((kind, name, entry.get("cost"), hire, entry.get("upkeep"), upkeep))
    return {
        "name": name,
        **access,
        "note": note,
        "hire_fee": hire.fee,
        "upkeep_fee": upkeep.fee,
    }


def named_after(list_name: str, resolver: Resolver, groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The warband type a skill list is named after ("Low Kings"), else the group ("Orcs"); [] when neither."""
    slugs = resolver.find(list_name)
    if slugs:
        return [{**entry, "excluded": False} for entry in collapse(slugs, groups)]
    key = norm_name(list_name)
    for group in groups:
        if norm_name(group["name"]) in (key, key + "s", key.removesuffix("s")):
            return [{"group": group["slug"], "excluded": False}]
    return []


def _skill(
    row: dict[str, Any],
    theirs: dict[str, list[dict[str, Any]]],
    resolver: Resolver,
    groups: list[dict[str, Any]],
    log: HiringLog,
    lists: SkillLists,
) -> dict[str, Any]:
    name, list_name = str(row.get("name") or "").strip(), str(row.get("type") or "").strip()
    label = f"{name} ({list_name})"
    found = theirs.get(norm_name(name), [])
    if found:
        entry = best_entry(list_name, found)
        access, left_out = who(as_list(entry.get("permittedWarbands")), [], resolver, groups, "skills")
        how = "mordheimer"
    elif norm_name(list_name) in GENERAL_LISTS:
        access, left_out, how = {"for_everyone": True, "warbands": []}, [], "general list"
    elif decided := lists.access(list_name, name):
        access, left_out, how = decided, [], "overrides.json"
    elif warbands := named_after(list_name, resolver, groups):
        access, left_out, how = {"for_everyone": False, "warbands": warbands}, [], "its list's name"
        log.by_list_name.append((label, list_name))
    else:
        access, left_out, how = {"for_everyone": True, "warbands": []}, [list_name], "no match"
    if left_out:
        log.unplaced.append(("skills", label, left_out))
    return {"name": name, "type": list_name, **access, "how": how, **lists.extras_of(list_name)}


def build_who_can(
    sources: Any, resolver: Resolver, groups: list[dict[str, Any]], log: HiringLog, lists: SkillLists
) -> dict[str, list[dict[str, Any]]]:
    """``out/who-can.json``: who may learn each of our skills (with William's list decisions: `lists`), and who may
    hire each of mordheimer's hired swords and dramatis personae (with their fees; a fee overrides.json puts in his
    rules is `special`, `in_his_rules`)."""
    theirs: dict[str, list[dict[str, Any]]] = {}
    for entry in sources.skills:
        theirs.setdefault(norm_name(str(entry.get("name") or "")), []).append(entry)
    skills = [_skill(row, theirs, resolver, groups, log, lists) for row in sources.our_skills if row.get("name")]
    overrides = getattr(sources, "overrides", None) or {}
    in_rules = overrides.get("fees_in_rules", {})
    hire_add = overrides.get("hire_warbands_add", {})
    hirelings = {
        "hired_swords": [
            _hireling("hired swords", row, resolver, groups, log, in_rules, hire_add) for row in sources.hired_swords
        ],
        "dramatis_personae": [
            _hireling("dramatis personae", row, resolver, groups, log, in_rules, hire_add) for row in sources.personae
        ],
    }
    unknown = sorted(set(hire_add) - {row["name"] for rows in hirelings.values() for row in rows})
    if unknown:
        raise ValueError(f"overrides.json hire_warbands_add names no hired sword or dramatis persona: {unknown}")
    return {"skills": skills, **hirelings}
