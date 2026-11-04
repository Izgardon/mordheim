"""Warband templates from mordheimer's New Warband Format snapshot (`sources/testwarbands-2026-10-31/`): one template
per page, linked to our warband types, with its variants, warband rules, equipment lists (their lines matched to our
items), fighters and upgrades, written to `out/warband-templates.json` for `seed_warband_templates`. William's
settled answers are `template_answers.py`; every doubt goes into the report's Warband templates section."""

import re
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import load_json, slugify
from catalogue_import.snapshot import Snapshot
from catalogue_import.sources import BACKEND
from catalogue_import.template_answers import SIZES, TEMPLATE_TYPES, VARIANT_TERMS, VARIANTS
from catalogue_import.template_fighters import FighterLog, Lores, build_fighter
from catalogue_import.template_lists import ItemIndex
from catalogue_import.template_parts import ListLog, build_lists, build_rules, build_upgrades
from catalogue_import.template_text import clean_rule
from catalogue_import.warbands import Resolver

# words a rule written for one fighter or another shares ("Pursuers have", "An Ogre has")
FILLER = frozenset({"a", "an", "the", "has", "have", "is", "are", "and", "so", "follow", "follows", "cause", "causes"})


@dataclass
class TemplateLog:
    fighters: FighterLog = field(default_factory=FighterLog)
    lists: ListLog = field(default_factory=ListLog)
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
    upgrades, upgrade_rules = build_upgrades(page, owner)
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
) -> list[dict[str, Any]]:
    """Every page's template, by name; a type two pages claim is reported (the seeder keeps one template a type)."""
    context = {
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
