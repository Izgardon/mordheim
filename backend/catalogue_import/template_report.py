"""The import report's Warband templates section: the counts, then each doubt the build met, short and scannable."""

from collections.abc import Sequence
from typing import Any

from catalogue_import.template_answers import NOT_APPLIED
from catalogue_import.templates import TemplateLog


def _cell(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def _table(header: list[str], rows: Sequence[Sequence[object]]) -> list[str]:
    lines = ["| " + " | ".join(header) + " |", "| " + " | ".join("---" for _ in header) + " |"]
    return [*lines, *("| " + " | ".join(_cell(value) for value in row) + " |" for row in rows), ""]


def _counts(templates: list[dict[str, Any]]) -> list[str]:
    fighters = [fighter for template in templates for fighter in template["fighters"]]
    lists = [entry for template in templates for entry in template["lists"]]
    specials = {
        (special["name"], special["type"])
        for template in templates
        for special in [s for fighter in template["fighters"] for s in fighter["specials"]]
        + [upgrade["special"] for upgrade in template["upgrades"]]
        if "description" in special
    }
    henchmen = [fighter for fighter in fighters if fighter["kind"] == "henchman"]
    rows: list[list[object]] = [
        ["templates", len(templates)],
        ["warband types linked", sum(len(template["types"]) for template in templates)],
        ["fighters (heroes, henchmen)", f"{len(fighters)} ({len(fighters) - len(henchmen)}, {len(henchmen)})"],
        ["henchmen that gain no XP", sum(1 for fighter in henchmen if not fighter["gains_xp"])],
        ["henchmen that can't be promoted", sum(1 for fighter in henchmen if not fighter["promotable"])],
        ["equipment lists", len(lists)],
        ["list lines", sum(len(entry["lines"]) for entry in lists)],
        ["warband rules", sum(len(template["rules"]) for template in templates)],
        ["upgrades", sum(len(template["upgrades"]) for template in templates)],
        ["the templates' own specials", len(specials)],
    ]
    return ["### Counts", "", *_table(["What", "Rows"], rows)]


def _lines(log: TemplateLog) -> list[str]:
    lists = log.lists
    out = ["### List lines", ""]
    if lists.unmatched:
        out += ["Lines that name no item of ours, left out:", "", *_table(["Page", "List", "Line"], lists.unmatched)]
    else:
        out += ["Every line names one of our items.", ""]
    if lists.found_by:
        out += ["Lines found other than by name or tag:", "", *_table(["Page", "Line", "Item", "How"], lists.found_by)]
    out += [
        f"{lists.shown_as} lines show the list's own name for their item. {lists.markers} notes were only an errata or"
        " FAQ marker and are dropped (the price already carries the fix).",
        "",
    ]
    if lists.unread:
        out += [
            "Notes it couldn't read, kept as the line's note:",
            "",
            *_table(["Page", "List", "Line", "Note"], lists.unread),
        ]
    else:
        out += ["Every note was read into who may take the line, a limit or a brace price.", ""]
    return out


def _fighters(log: TemplateLog) -> list[str]:
    fighters = log.fighters
    out = ["### Fighters", ""]
    if fighters.unknown_races:
        out += ["Races we don't have:", "", *_table(["Page", "Fighter", "Race"], fighters.unknown_races)]
    out += ["Fighters with no race:", "", *_table(["Page", "Fighter", "mordheimer's race"], fighters.no_race)]
    creatures = sorted({race for _page, _fighter, race in fighters.creatures})
    out += [f"{len(fighters.creatures)} creatures come in with no race: {', '.join(creatures)}.", ""]
    several = [[page, fighter, " | ".join(names)] for page, fighter, names in fighters.several_profiles]
    out += ["Several profiles, the first kept:", "", *_table(["Page", "Fighter", "Profiles"], several)]
    written = [
        [page, fighter, ", ".join(f"{key} {value}" for key, value in stats.items())]
        for page, fighter, stats in fighters.written
    ]
    out += ["Written values, kept as written:", "", *_table(["Page", "Fighter", "Stats"], written)]
    if fighters.no_special_group:
        names = ", ".join(f"{page}: {fighter}" for page, fighter in fighters.no_special_group)
        out += [f"Ticked for special skills with no group to name, the tick left out: {names}.", ""]
    return out


def learns(group: dict[str, Any], type_slug: str, members: dict[str, set[str]]) -> bool:
    """Whether a warband type learns from a skill group: it is for everyone or a line names the type or a warband
    group holding it, and no exclusion names either."""

    def names(line: dict[str, Any]) -> bool:
        return line.get("type") == type_slug or type_slug in members.get(line.get("group") or "", set())

    lines = group.get("warbands") or []
    if any(names(line) for line in lines if line.get("excluded")):
        return False
    return bool(group.get("for_everyone")) or any(names(line) for line in lines if not line.get("excluded"))


def skill_group_misses(
    templates: list[dict[str, Any]], skill_groups: list[dict[str, Any]], warband_groups: list[dict[str, Any]]
) -> tuple[dict[str, list[str]], dict[tuple[str, str], list[str]]]:
    """The names in fighters' skill access that are no skill group (-> "template: fighter"), and the groups not for
    everyone whose learners leave out a type the template serves ((group, type) -> fighters)."""
    by_name = {group["name"]: group for group in skill_groups}
    members = {group["slug"]: set(group["members"]) for group in warband_groups}
    unknown: dict[str, list[str]] = {}
    unlearned: dict[tuple[str, str], list[str]] = {}
    for template in templates:
        for fighter in template["fighters"]:
            changed = [name for change in fighter["variant_changes"].values() for name in change.get("skill_types", [])]
            for name in dict.fromkeys([*fighter["skill_types"], *changed]):
                group = by_name.get(name)
                if group is None:
                    unknown.setdefault(name, []).append(f"{template['name']}: {fighter['name']}")
                    continue
                for link in template["types"]:
                    if not learns(group, link["type"], members):
                        unlearned.setdefault((name, link["type"]), []).append(f"{template['name']}: {fighter['name']}")
    return unknown, unlearned


def _groups(
    templates: list[dict[str, Any]], skill_groups: list[dict[str, Any]], warbands: list[dict[str, Any]]
) -> list[str]:
    unknown, unlearned = skill_group_misses(templates, skill_groups, warbands)
    out = ["### Skill groups", ""]
    if unknown:
        rows = [[name, ", ".join(fighters)] for name, fighters in sorted(unknown.items())]
        out += ["Names in fighters' skill access that are no skill group:", "", *_table(["Name", "Fighters"], rows)]
    else:
        out += ["Every name in the fighters' skill access is a skill group (out/skill-groups.json).", ""]
    if unlearned:
        rows = [[name, slug, ", ".join(fighters)] for (name, slug), fighters in sorted(unlearned.items())]
        out += [
            "Groups the fighters name whose learners (skill_group_learners) leave out a warband type the template"
            " serves:",
            "",
            *_table(["Group", "Warband type", "Fighters"], rows),
        ]
    else:
        out += ["Each of those groups is for everyone or names every warband type its fighters' template serves.", ""]
    return out


def _casters(log: TemplateLog) -> list[str]:
    fighters = log.fighters
    out = ["### Casters", ""]
    rows = [[page, fighter, caster, ", ".join(lores)] for page, fighter, caster, lores in fighters.casters]
    out += _table(["Page", "Fighter", "Caster", "Lores"], rows)
    if fighters.lores:
        renamed = "; ".join(f"{theirs} -> {ours}" for theirs, ours in fighters.lores.items())
        out += [f"mordheimer's lore names that differ from ours: {renamed}.", ""]
    if fighters.unplaced_casters:
        out += [f"Caster lines no page fighter matches: {'; '.join(fighters.unplaced_casters)}.", ""]
    return out


def _upgrades(log: TemplateLog) -> list[str]:
    """What the import set for each upgrade group (template_answers.UPGRADE_TERMS), the entries made warband rules,
    and the variants' own lines and skills."""
    upgrades = log.upgrades
    out = ["### Upgrades and variants", "", *_table(["Page", "Group", "Set"], upgrades.terms)]
    out += [f"{page}: {name} is a warband rule, not an upgrade." for page, name in upgrades.as_rules]
    out += [f"{page}: no terms for the group {group}." for page, group in upgrades.no_terms]
    out += [f"{page}: {owner} names {key}, no fighter of the page." for page, owner, key in upgrades.unknown_keys]
    lines = [[page, variant, name, line] for page, variant, name, line in log.lists.variant_lines]
    out += ["", "Lines for one variant only:", "", *_table(["Page", "Variant", "List", "Line"], lines)]
    out += [f"{page}: every {variant} hero has {skill}." for page, variant, skill in log.hero_skills]
    return [*out, ""]


def _rules(log: TemplateLog) -> list[str]:
    lists = log.lists
    out = ["### Warband rules", "", *NOT_APPLIED]
    for page, heading, title, rule_type in lists.rule_only:
        out.append(f"{page}: {title!r} (heading {heading}) is for the {rule_type} type only.")
    for page, heading in lists.headings:
        out.append(f"{page}: the heading {heading!r} is no variant; its rule is for every variant.")
    for page, position in lists.untitled:
        out.append(f"{page}: rule {position + 1} has no title.")
    if log.named_apart:
        named = "; ".join(f"{page}: {name}" for page, name in log.named_apart)
        out.append(
            'A rule worded for another fighter only ("Pit Veterans have") takes the first fighter\'s wording; one'
            f" that really differs is named apart, with its fighter or upgrade group: {named}."
        )
    if log.no_types:
        out.append(f"Pages that map to no type, left out: {', '.join(log.no_types)}.")
    for type_slug, names in log.shared_types:
        out.append(f"{type_slug} is claimed by {', '.join(names)}.")
    return [*out[:2], *(f"- {line}" for line in out[2:]), ""]


def render_templates(
    templates: list[dict[str, Any]],
    log: TemplateLog,
    skill_groups: list[dict[str, Any]],
    warband_groups: list[dict[str, Any]],
) -> str:
    lines = [
        "## Warband templates",
        "",
        "mordheimer's New Warband Format snapshot (31 Oct 2026) as `out/warband-templates.json`; William's settled answers"
        " are `template_answers.py`.",
        "",
        *_counts(templates),
        *_lines(log),
        *_fighters(log),
        *_groups(templates, skill_groups, warband_groups),
        *_casters(log),
        *_upgrades(log),
        *_rules(log),
    ]
    return "\n".join(lines).rstrip() + "\n"
