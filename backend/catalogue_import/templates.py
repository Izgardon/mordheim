"""Warband templates from mordheimer's New Warband Format snapshot (`sources/testwarbands-2026-10-31/`): one template
per page, linked to our warband types, with its variants, warband rules, equipment lists (their lines matched to our
items), fighters and upgrades, written to `out/warband-templates.json` for `seed_warband_templates`. William's
settled answers are `template_answers.py`; every doubt goes into the report's Warband templates section."""

import re
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import load_json, slugify
from catalogue_import.shared_specials import SharedSpecials
from catalogue_import.snapshot import Snapshot
from catalogue_import.sources import BACKEND
from catalogue_import.template_answers import SIZES, TEMPLATE_TYPES, VARIANT_HERO_SKILLS, VARIANT_TERMS, VARIANTS
from catalogue_import.template_fighters import FighterLog, Lores, build_fighter
from catalogue_import.template_lists import ItemIndex
from catalogue_import.template_parts import ListLog, build_lists, build_rules
from catalogue_import.template_text import clean_rule
from catalogue_import.template_upgrades import UpgradeLog, build_upgrades
from catalogue_import.warbands import Resolver

# words a rule written for one fighter or another shares ("Pursuers have", "An Ogre has")
FILLER = frozenset({"a", "an", "the", "has", "have", "is", "are", "and", "so", "follow", "follows", "cause", "causes"})


@dataclass
class TemplateLog:
    fighters: FighterLog = field(default_factory=FighterLog)
    lists: ListLog = field(default_factory=ListLog)
    upgrades: UpgradeLog = field(default_factory=UpgradeLog)
    hero_skills: list[tuple[str, str, str]] = field(default_factory=list)  # page, variant, a skill every hero gets
    no_types: list[str] = field(default_factory=list)  # pages that map to no type
    shared_types: list[tuple[str, list[str]]] = field(default_factory=list)  # a type two pages map to
    named_apart: list[tuple[str, str]] = field(default_factory=list)  # page, a rule worded apart for one fighter


def page_types(
    slug: str, page: dict[str, Any], types: list[dict[str, Any]], resolver: Resolver
) -> list[dict[str, str]]:
    """The types a page serves: William's mapping, else the type whose mordheimer page it is, else by name."""
    if slug in TEMPLATE_TYPES:
        return [{"type": type_slug, "variant": variant} for type_slug, variant in TEMPLATE_TYPES[slug].items()]
    by_url = [row["slug"] for row in types if row["mordheimer_url"].rstrip("/").rsplit("/", 1)[-1] == slug]
    found = by_url if len(by_url) == 1 else resolver.find(page["name"])
    return [{"type": type_slug, "variant": ""} for type_slug in found[:1]]


def _gist(text: str, *names: str) -> str:
    """A rule's wording without the fighter it is written for ("A Pit King has", "Pit Veterans have"), to tell a
    real difference from a change of subject."""
    lowered = text.lower()
    for name in sorted(filter(None, names), key=len, reverse=True):
        lowered = lowered.replace(name.lower(), " ")
    return " ".join(word.removesuffix("s") for word in re.findall(r"[a-z0-9]+", lowered) if word not in FILLER)


def _shared_rule(special: dict[str, str], fighter: dict[str, Any], name: str, shared: SharedSpecials) -> dict[str, str]:
    """A fighter's rule as William's list has it: the shared special it is (its name and type, no text, for the seeder
    to find in the book), or kept his own, named as the list names it and typed as its first owner has it, so owners
    in two templates (the Skaven's and Clan Pestilens' Rat Ogres) hold one row, worded as the first has it (in his own
    template `_specials_once` does that); an owner who words it differently, beyond his name, stops the build. Our
    Large, Wizard and Priest, and his other rules, stay."""
    found = shared.rule("warband", f"{name}: {fighter['name']}", special["name"]) if "description" in special else None
    if found is None:
        return special
    how, line = found
    if how == "shared":
        return {"name": line["name"], "type": line["type"]}
    gist = _gist(special["description"], fighter["name"], fighter["plural"])
    kind, wording, first = shared.kept.setdefault(line["name"], (special["type"], special["description"], gist))
    if first != gist:
        raise ValueError(f"shared-specials.json: {fighter['name']} words {line['name']} unlike its first owner")
    text = special["description"] if kind == special["type"] else wording
    return {"name": line["name"], "type": kind, "description": text}


def _share(fighters: list[dict[str, Any]], upgrades: list[dict[str, Any]], name: str, shared: SharedSpecials) -> None:
    """Each fighter's rule and upgrade a shared special stands for (a name or alias in William's list) links it, the
    upgrade keeping its price; a rule the list keeps apart stays his own (`_shared_rule`). Two of a fighter's rules
    that are one shared special are held once."""
    for fighter in fighters:
        rules: list[dict[str, str]] = []
        for special in [_shared_rule(special, fighter, name, shared) for special in fighter["specials"]]:
            if special["name"] not in [rule["name"] for rule in rules]:
                rules.append(special)
        fighter["specials"] = rules
    for upgrade in upgrades:
        found = shared.rule("warband", f"{name}: {upgrade['group']}", upgrade["special"]["name"])
        if found is not None and found[0] == "shared":
            entry = found[1]
            shared.sold_by(name, entry, upgrade["special"]["description"], upgrade["cost"])
            upgrade["special"] = {"name": entry["name"], "type": entry["type"]}


def _specials_once(fighters: list[dict[str, Any]], upgrades: list[dict[str, Any]], slug: str, log: TemplateLog) -> None:
    """One special per rule name in a template (the seeder makes one of each): a rule worded for another fighter only
    takes the first wording; one that really differs is named apart, "Cause Fear (Scarecrow)"."""
    first: dict[str, tuple[str, str]] = {}  # name -> (gist, wording)
    owned = [(entry, fighter["name"], fighter["plural"]) for fighter in fighters for entry in fighter["specials"]]
    owned += [(upgrade["special"], upgrade["group"], "") for upgrade in upgrades]
    for special, owner, plural in owned:
        if "description" not in special:
            continue
        name, gist = special["name"], _gist(special["description"], owner, plural)
        seen = first.setdefault(name, (gist, special["description"]))
        if seen[0] == gist:
            special["description"] = seen[1]
        else:
            special["name"] = f"{name} ({owner})"
            log.named_apart.append((slug, special["name"]))


def hero_skills(slug: str, fighters: list[dict[str, Any]], log: TemplateLog) -> None:
    """The skills a variant gives every hero (VARIANT_HERO_SKILLS: the Hung's Ride Warhorse), into each hero's
    `variant_changes` by name; the seeder links each to our skill."""
    for variant, names in VARIANT_HERO_SKILLS.get(slug, {}).items():
        for fighter in fighters:
            if fighter["kind"] == "hero":
                fighter["variant_changes"].setdefault(variant, {})["skills"] = list(names)
        log.hero_skills += [(slug, variant, name) for name in names]


def build_template(slug: str, snapshot: Snapshot, context: dict[str, Any], log: TemplateLog) -> dict[str, Any] | None:
    page = snapshot.pages[slug]
    types = page_types(slug, page, context["types"], context["resolver"])
    if not types:
        log.no_types.append(slug)
        return None
    name = page["name"]
    variants = VARIANTS.get(slug, [])
    owner = f"Warband - {name}"
    lists, list_keys = build_lists(slug, page, context["index"], log.lists)
    fighter_context = {**context, "variants": variants, "owner": owner}
    fighters = [
        build_fighter(slug, fighter, fighter_context, list_keys.get(fighter["name"], []), log.fighters)
        for fighter in page["fighters"]
    ]
    hero_skills(slug, fighters, log)
    upgrades, upgrade_rules = build_upgrades(slug, page, owner, log.upgrades)
    _share(fighters, upgrades, name, context["shared"])
    _specials_once(fighters, upgrades, slug, log)
    rules = build_rules(slug, page, variants, log.lists) + upgrade_rules
    book = page.get("warbandRules") or {}
    return {
        "slug": slugify(name),
        "name": name,
        "setting": context["settings"][types[0]["type"]],
        "source": clean_rule(page.get("source")),
        "link_url": context["urls"].get(types[0]["type"]) or snapshot.manifest.get(slug, ""),
        "starting_gold": book.get("startingGc"),
        "max_models": book.get("maxModels") or SIZES.get(slug),
        "variants": [
            {"key": variant["key"], "name": variant["name"], **VARIANT_TERMS.get(slug, {}).get(variant["key"], {})}
            for variant in variants
        ],
        "types": types,
        "rules": rules,
        "lists": lists,
        "fighters": fighters,
        "upgrades": upgrades,
    }


def build_templates(
    snapshot: Snapshot,
    types: list[dict[str, Any]],
    resolver: Resolver,
    items: list[dict[str, Any]],
    races: set[str],
    lores: set[str],
    log: TemplateLog,
    shared: SharedSpecials,
) -> list[dict[str, Any]]:
    """Every page's template, by name, its rules that are shared specials linked to them (`shared`); a type two pages
    claim is reported (the seeder keeps one template a type)."""
    context = {
        "shared": shared,
        "types": types,
        "resolver": resolver,
        "index": ItemIndex(items),
        "races": races,
        "lores": Lores(snapshot.magic, snapshot.pages, lores, log.fighters),
        "settings": {row["slug"]: row["setting"] for row in types},
        "urls": {row["slug"]: row["mordheimer_url"] for row in types},
    }
    templates = [
        template for slug in snapshot.pages if (template := build_template(slug, snapshot, context, log)) is not None
    ]
    claimed: dict[str, list[str]] = {}
    for template in templates:
        for link in template["types"]:
            claimed.setdefault(link["type"], []).append(template["name"])
    log.shared_types = [(type_slug, names) for type_slug, names in claimed.items() if len(names) > 1]
    return sorted(templates, key=lambda template: template["name"])


def our_races_and_lores() -> tuple[set[str], set[str]]:
    """The races we seed (apps/races/data/races.json) and our spells' lores (apps/spells/data/spells.json)."""
    races = {row["name"] for row in load_json(BACKEND / "apps" / "races" / "data" / "races.json")}
    lores = {row["type"] for row in load_json(BACKEND / "apps" / "spells" / "data" / "spells.json")}
    return races, lores
