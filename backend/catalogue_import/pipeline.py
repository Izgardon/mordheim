"""Runs every step in order and returns the files to write. Same inputs, same bytes."""

import re
from collections import Counter
from collections.abc import Collection
from pathlib import Path
from typing import Any

from catalogue_import.assignments import AssignmentLog, assign, build_assignments
from catalogue_import.availability import Context, Decisions
from catalogue_import.common import as_list, dump_json, load_json, loose_key, slugify
from catalogue_import.grading import build_settings, collect_evidence
from catalogue_import.groups import build_groups
from catalogue_import.hiring import HiringLog, build_who_can
from catalogue_import.injuries import build_serious_injuries
from catalogue_import.items import ItemLog, mordheimer_items
from catalogue_import.mim import MimLog, MimReader, mim_item
from catalogue_import.new_groups import SkillGroups, build_skill_groups
from catalogue_import.own_rules import own_rules
from catalogue_import.personae import Catalogue, build_personae, put_names_right
from catalogue_import.random_mutations import build_random_mutations, render_random
from catalogue_import.report import ReportData, render_report
from catalogue_import.rules import build_shared_rules, index_rules
from catalogue_import.shared_specials import build_shared, load_shared, render_shared
from catalogue_import.skill_lists import SkillLists
from catalogue_import.snapshot import SNAPSHOT, load_snapshot
from catalogue_import.sources import ITEM_DATA, PACKAGE, Sources, load_sources
from catalogue_import.statements import PhraseReader
from catalogue_import.template_report import render_templates
from catalogue_import.templates import TemplateLog, build_templates, our_races_and_lores
from catalogue_import.warband_items import template_items
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


class ItemDecisions:
    """overrides.json's decisions on who may buy mordheimer items, checked against the item names and the warband
    types: a name or slug that matches nothing stops the build rather than being skipped quietly."""

    def __init__(self, overrides: dict[str, Any], types: list[dict[str, Any]], items: list[dict[str, Any]]) -> None:
        self.overrides = overrides
        self.types = {row["slug"] for row in types}
        self.items = {item["name"] for item in items}

    def _check_item(self, key: str, name: str) -> None:
        if name not in self.items:
            raise ValueError(f"overrides.json {key}: no mordheimer item {name!r}")

    def warbands(self, key: str) -> Decisions:
        """An "item name -> {warbands, why}" key as item name -> (type slugs, why)."""
        decisions: Decisions = {}
        for name, entry in self.overrides.get(key, {}).items():
            self._check_item(key, name)
            unknown = [slug for slug in entry["warbands"] if slug not in self.types]
            if unknown:
                raise ValueError(f"overrides.json {key} {name!r}: no warband type {', '.join(unknown)}")
            decisions[name] = (list(entry["warbands"]), entry["why"])
        return decisions

    def kept(self, key: str) -> dict[str, str]:
        """An "item name -> why" key."""
        for name in self.overrides.get(key, {}):
            self._check_item(key, name)
        return dict(self.overrides.get(key, {}))


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


def _skill_groups(
    sources: Sources,
    types: list[dict[str, Any]],
    groups: list[dict[str, Any]],
    skill_lists: SkillLists,
    resolver: Resolver,
    who_can: dict[str, list[dict[str, Any]]],
    assignments: dict[str, list[dict[str, Any]]],
    log: AssignmentLog,
) -> SkillGroups:
    """Our skill rows as one skill per name in groups (new_groups.py): who-can.json keeps the hirelings (each group
    says who learns from it) and setting-assignments.json takes one row per skill."""
    chosen = sources.overrides.get("setting_assignments", {}).get("skills")
    grouped = build_skill_groups(
        sources,
        types,
        groups,
        skill_lists,
        resolver,
        who_can.pop("skills"),
        assignments["skills"],
        lambda rows: assign("skills", rows, sources.skills, log, chosen),
    )
    assignments["skills"] = grouped.settings
    return grouped


def build(package: Path = PACKAGE, item_data: Path = ITEM_DATA) -> dict[str, str]:
    sources = load_sources(package, item_data)
    overrides = sources.overrides
    put_names_right(sources.personae, overrides.get("persona_names", {}))
    rows = sources.warbands + extra_rows(overrides.get("extra_warband_types", []))
    types = build_warband_types(rows, overrides.get("warband_type_names"))
    resolver = Resolver(types, overrides.get("warband_aliases"))
    evidence = collect_evidence(types, sources)
    settings = build_settings(evidence, overrides.get("setting_grades", {}))
    groups, group_questions, group_answers = build_groups(types, sources, resolver)
    skill_lists = SkillLists(overrides, types, groups)
    sources.our_skills = skill_lists.apply(sources.our_skills)  # William's drops, additions and rewordings first
    shared = build_shared_rules(sources.items)
    index = index_rules(shared)
    names = display_names(types)
    decide = ItemDecisions(overrides, types, sources.items)
    ctx = Context(
        PhraseReader(resolver, groups),
        groups,
        names,
        chosen=decide.warbands("item_warbands"),
        added=decide.warbands("item_warbands_add"),
        exclusions=decide.warbands("item_exclusions"),
        kept=decide.kept("item_defaults_kept"),
    )
    item_log, mim_log = ItemLog(), MimLog()
    items = mordheimer_items(
        sources.items, overrides.get("keep_hidden_items", []), overrides.get("drop_items", []), index, ctx, item_log
    )
    reader = MimReader(resolver, groups)
    mim = [mim_item(item, sources.properties, index, reader, mim_log) for item in sources.mim_items]
    snapshot = load_snapshot(package / "sources" / SNAPSHOT.name)
    seed = [row for row in load_json(item_data / "standard-items.json") if isinstance(row, dict)]
    added = template_items(overrides, snapshot.pages, seed, sources.properties, types, groups, index)
    everything = items + mim + added
    add_notes(everything, overrides.get("item_notes", {}))
    same_names = assign_slugs(everything, overrides.get("whole_names", []))
    names_we_have = Catalogue([item["name"] for item in everything], [row["name"] for row in sources.our_skills])
    sources.our_personae = build_personae(sources.personae, names_we_have, overrides.get("fees_in_rules", {}))
    _resolve_everything(sources, resolver)
    assignment_log = AssignmentLog()
    assignments = build_assignments(sources, assignment_log)
    hiring_log = HiringLog()
    who_can = build_who_can(sources, resolver, groups, hiring_log, skill_lists)
    grouped = _skill_groups(sources, types, groups, skill_lists, resolver, who_can, assignments, assignment_log)
    template_log = TemplateLog()
    one_rule = load_shared()  # the shared specials (William, 5 Nov 2026)
    templates = build_templates(snapshot, types, resolver, everything, *our_races_and_lores(), template_log, one_rule)
    shared_specials = build_shared(one_rule, sources.our_hired_swords, sources.our_personae, snapshot.injuries)
    own = own_rules(one_rule, sources.our_hired_swords, sources.our_personae)  # each owner's own (5 Nov 2026)
    shared_specials["own_names"] = own.names()
    random_mutations = build_random_mutations(one_rule)  # the random mutation table (William, 5 Nov 2026)
    injuries = build_serious_injuries(snapshot.injuries)
    counts = {
        "settings": len(settings),
        "warband types": len(types),
        "warband groups": len(groups),
        "shared item rules": len(shared),
        "items (mordheimer)": len(items),
        "items (MiM)": len(mim),
        "items (warband templates)": len(added),
        "price rows": sum(len(item["availabilities"]) for item in everything),
        "skills": len(grouped.skills),
        "skill groups": len(grouped.groups),
        "skill group links": sum(len(group["skills"]) for group in grouped.groups),
        "serious injuries (D66)": len(injuries),
        "shared specials": len(shared_specials["specials"]),
        "random mutation results (D66)": len(random_mutations),
    }
    report = ReportData(
        counts,
        settings,
        types,
        groups,
        group_questions,
        group_answers,
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
        skill_lists.log,
        grouped,
        {
            "warband type": overrides.get("warband_type_names", {}),
            "dramatis persona": overrides.get("persona_names", {}),
        },
    )
    return {
        "settings.json": dump_json(settings),
        "warband-types.json": dump_json(types),
        "warband-groups.json": dump_json(groups),
        "item-rules.json": dump_json(shared),
        "items.json": dump_json(everything),
        "setting-assignments.json": dump_json(assignments),
        "who-can.json": dump_json(who_can),
        "skills.json": dump_json(grouped.skills),
        "skill-groups.json": dump_json(grouped.groups),
        "dramatis-personae.json": dump_json(sources.our_personae),
        "warband-templates.json": dump_json(templates),
        "serious-injuries.json": dump_json(injuries),
        "shared-specials.json": dump_json(shared_specials),
        "random-mutations.json": dump_json(random_mutations),
        "import-report.md": render_report(report)
        + "\n"
        + render_templates(templates, template_log, grouped.groups, groups)
        + "\n"
        + render_shared(one_rule)
        + own.render()
        + "\n"
        + render_random(random_mutations, one_rule),
    }
