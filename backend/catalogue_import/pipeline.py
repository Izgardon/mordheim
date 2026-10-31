"""Runs every step in order and returns the files to write. Same inputs, same bytes."""

import re
from collections import Counter
from collections.abc import Collection
from pathlib import Path
from typing import Any

from catalogue_import.assignments import AssignmentLog, build_assignments
from catalogue_import.availability import Context
from catalogue_import.common import as_list, dump_json, loose_key, slugify
from catalogue_import.grading import build_settings, collect_evidence
from catalogue_import.groups import build_groups
from catalogue_import.hiring import HiringLog, build_who_can
from catalogue_import.items import ItemLog, mordheimer_items
from catalogue_import.mim import MimLog, MimReader, mim_item
from catalogue_import.personae import Catalogue, build_personae
from catalogue_import.report import ReportData, render_report
from catalogue_import.rules import build_shared_rules, index_rules
from catalogue_import.sources import ITEM_DATA, PACKAGE, Sources, load_sources
from catalogue_import.statements import PhraseReader
from catalogue_import.warbands import Resolver, build_warband_types, extra_rows

MIM_VARIANT = "Mutiny in Marienburg"


def name_keys(name: str) -> set[str]:
    """A name's loose key, plus each half of a "Trade Wagon/Stage Coach" style name."""
    parts = [name, *name.split("/")] if "/" in name else [name]
    return {loose_key(part) for part in parts if loose_key(part)}


def same_name_clusters(items: list[dict[str, Any]], whole: Collection[str] = ()) -> list[list[int]]:
    """Indexes of items that share a name once case, spacing and punctuation are ignored. A name in whole matches
    only as a whole ("Harpoon Gun/Crossbow" is not a Crossbow)."""
    parent = list(range(len(items)))

    def root(index: int) -> int:
        while parent[index] != index:
            index = parent[index]
        return index

    owner: dict[str, int] = {}
    for index, item in enumerate(items):
        keys = {loose_key(item["name"])} if item["name"] in whole else name_keys(item["name"])
        for key in sorted(keys):
            if key in owner:
                parent[root(index)] = root(owner[key])
            else:
                owner[key] = index
    clusters: dict[int, list[int]] = {}
    for index in range(len(items)):
        clusters.setdefault(root(index), []).append(index)
    return [members for members in clusters.values() if len(members) > 1]


def assign_slugs(items: list[dict[str, Any]], whole: Collection[str] = ()) -> list[list[dict[str, Any]]]:
    """Slugs from names. mordheimer's entry is the main one: a MiM item sharing its name gets the MiM variant and
    suffix."""
    clusters = same_name_clusters(items, whole)
    for members in clusters:
        if any(items[i]["origin"] == "mordheimer" for i in members):
            for i in members:
                if items[i]["origin"] == "mim":
                    items[i]["variant"] = MIM_VARIANT
    taken: set[str] = set()
    for item in items:
        base = slugify(item["name"]) + ("-mim" if item["variant"] == MIM_VARIANT else "")
        slug, count = base, 1
        while slug in taken:
            count += 1
            slug = f"{base}-{count}"
        item["slug"] = slug
        taken.add(slug)
    return [[items[i] for i in members] for members in clusters]


def add_notes(items: list[dict[str, Any]], notes: dict[str, str]) -> None:
    """overrides.json "item_notes": a soft note on every price row of the named item."""
    for item in items:
        note = notes.get(item["name"])
        if not note:
            continue
        for row in item["availabilities"]:
            row["note"] = "; ".join(filter(None, [row["note"], note]))


def _resolve_everything(sources: Sources, resolver: Resolver) -> None:
    """Runs every warband name through the resolver so the report lists all that needed help."""
    for kind, rows in (
        ("skills", sources.skills),
        ("hired swords", sources.hired_swords),
        ("dramatis personae", sources.personae),
    ):
        for row in rows:
            resolver.resolve_all(as_list(row.get("permittedWarbands")) + as_list(row.get("excludedWarbands")), kind)


def _base_key(name: str) -> str:
    """A name without its bracketed qualifier or a plural s: "Pike (Tileans)" and "Healing Herbs" give pike, healingherb."""
    return loose_key(re.sub(r"\(.*?\)", "", name)).removesuffix("s")


def display_names(types: list[dict[str, Any]]) -> dict[str, str]:
    """Type names for people, with the source code where several types share a name ("Night Goblins (WEB)")."""
    counts = Counter(row["name"] for row in types)
    return {
        row["slug"]: f"{row['name']} ({row['source_code']})" if counts[row["name"]] > 1 else row["name"]
        for row in types
    }


def seed_changes(
    seed_names: list[str], items: list[dict[str, Any]], dropped_on_purpose: Collection[str] = ()
) -> tuple[list[tuple[str, list[str]]], list[str]]:
    """Seed items found only under another name (with what they became), and seed items on neither list (the ones
    overrides.json drops are reported on their own)."""
    kept = set().union(*(name_keys(item["name"]) for item in items))
    renamed, dropped = [], []
    for name in seed_names:
        if name_keys(name) & kept or name in dropped_on_purpose:
            continue
        matches = [item["name"] for item in items if _base_key(item["name"]) == _base_key(name)]
        if matches:
            renamed.append((name, matches))
        else:
            dropped.append(name)
    return renamed, dropped


def build(package: Path = PACKAGE, item_data: Path = ITEM_DATA) -> dict[str, str]:
    sources = load_sources(package, item_data)
    overrides = sources.overrides
    types = build_warband_types(sources.warbands + extra_rows(overrides.get("extra_warband_types", [])))
    resolver = Resolver(types, overrides.get("warband_aliases"))
    evidence = collect_evidence(types, sources)
    settings = build_settings(evidence, overrides.get("setting_grades", {}))
    groups, group_questions = build_groups(types, sources, resolver)
    shared = build_shared_rules(sources.items)
    index = index_rules(shared)
    names = display_names(types)
    chosen = {name: (entry["warbands"], entry["why"]) for name, entry in overrides.get("item_warbands", {}).items()}
    ctx = Context(PhraseReader(resolver, groups), groups, names, chosen)
    item_log, mim_log = ItemLog(), MimLog()
    items = mordheimer_items(
        sources.items, overrides.get("keep_hidden_items", []), overrides.get("drop_items", []), index, ctx, item_log
    )
    reader = MimReader(resolver, groups)
    mim = [mim_item(item, sources.properties, index, reader, mim_log) for item in sources.mim_items]
    everything = items + mim
    add_notes(everything, overrides.get("item_notes", {}))
    same_names = assign_slugs(everything, overrides.get("whole_names", []))
    names_we_have = Catalogue([item["name"] for item in everything], [row["name"] for row in sources.our_skills])
    sources.our_personae = build_personae(sources.personae, names_we_have)
    _resolve_everything(sources, resolver)
    assignment_log = AssignmentLog()
    assignments = build_assignments(sources, assignment_log)
    hiring_log = HiringLog()
    who_can = build_who_can(sources, resolver, groups, hiring_log)
    counts = {
        "settings": len(settings),
        "warband types": len(types),
        "warband groups": len(groups),
        "shared item rules": len(shared),
        "items (mordheimer)": len(items),
        "items (MiM)": len(mim),
        "price rows": sum(len(item["availabilities"]) for item in everything),
    }
    report = ReportData(
        counts,
        settings,
        types,
        groups,
        group_questions,
        list(resolver.uses.values()),
        ctx.conflicts,
        same_names,
        mim,
        mim_log,
        item_log,
        seed_changes(sources.seed_names, everything, item_log.dropped),
        shared,
        evidence.odd_grades,
        names,
        assignments,
        assignment_log,
        who_can,
        hiring_log,
    )
    return {
        "settings.json": dump_json(settings),
        "warband-types.json": dump_json(types),
        "warband-groups.json": dump_json(groups),
        "item-rules.json": dump_json(shared),
        "items.json": dump_json(everything),
        "setting-assignments.json": dump_json(assignments),
        "who-can.json": dump_json(who_can),
        "dramatis-personae.json": dump_json(sources.our_personae),
        "import-report.md": render_report(report),
    }
