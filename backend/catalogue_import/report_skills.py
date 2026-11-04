"""The import report's skill sections: William's skill list decisions and the skill groups (phase 1a)."""

from collections.abc import Sequence
from typing import Any


def _cell(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def table(header: list[str], rows: Sequence[Sequence[object]]) -> list[str]:
    lines = ["| " + " | ".join(header) + " |", "| " + " | ".join("---" for _ in header) + " |"]
    return lines + ["| " + " | ".join(_cell(value) for value in row) + " |" for row in rows]


def _named(data: Any, slugs: list[str]) -> str:
    return ", ".join(data.names.get(slug, slug) for slug in slugs) or "nobody"


def learners(data: Any, decision: dict[str, Any]) -> str:
    """Who a who-can list lets learn, by type and group names: "Dwarf Treasure Hunters", "everyone"."""
    groups = {group["slug"]: group["name"] for group in data.groups}
    names = [data.names.get(line["type"], line["type"]) if "type" in line else f"{groups.get(line['group'], line['group'])} (group)" for line in decision.get("warbands", [])]  # fmt: skip
    found = ", ".join(names) or "everyone"
    return found + (", Large units only" if decision.get("large_only") else "")


def skill_lists(data: Any) -> list[str]:
    log = data.skill_lists
    rows = [[name, learners(data, decision), decision.get("note", ""), ", ".join(log.placed.get(name, []))] for name, decision in log.decisions.items()]  # fmt: skip
    lines = [
        "## Skill lists (William's decisions)",
        "",
        "`overrides.json` (`skill_lists`, `drop_skills`, `extra_skills`, `skill_descriptions`) applied to our skill"
        " rows before they become skill groups (below). A list's decision is its group's: who learns from it, its"
        " note shown when learning, and a Large unit's group warns for any other unit, never blocks.",
        "",
        *table(["List", "Learned by", "Note", "Skills it places"], rows),
        "",
    ]
    lines += [f"Left out: {name}, {why}" for name, why in log.dropped]
    lines += [f"Added: {name}, from {source}." for name, source in log.added]
    lines += [f"Description put right: {name}." for name in log.reworded]
    return [*lines, ""]


def _merges(data: Any) -> list[str]:
    log = data.skill_groups.log
    rows = [
        [
            merge.name,
            ", ".join(merge.labels),
            merge.how,
            " / ".join(f"{row}: {text}" for row, text in merge.dropped) or "-",
        ]
        for merge in log.merges
    ]
    lines = [
        "### Merged by name",
        "",
        f"{len(log.merges)} names sat in two or more lists; each is one skill now, in every group that had it, under"
        " the title-case spelling. The wording is overrides.json's (`skill_wordings`) or the longest; every other"
        " wording is dropped:",
        "",
        *table(["Skill", "Rows merged", "Wording", "Dropped wordings"], rows),
        "",
    ]
    if log.settings:
        settings = "; ".join(f"{name}: {', '.join(found)} -> {taken}" for name, found, taken in log.settings)
        lines += [f"Merged skills whose rows had different settings, given the lowest: {settings}.", ""]
    splits = [[row, name, why] for row, name, why in log.splits]
    return lines + [
        "### Kept apart (`skill_splits`)",
        "",
        *table(["Row", "Its own skill", "Why"], splits),
        "",
    ]


def _groups(data: Any) -> list[str]:
    grouped = data.skill_groups
    rows = [
        [group["name"], learners(data, group), group["how"], group["note"] or "-", ", ".join(group["skills"])]
        for group in grouped.groups
    ]
    lines = [
        "### Every group",
        "",
        "Who learns from a group: `skill_group_learners`, else its list's decision (`skill_lists`), else the warbands"
        " that may learn every skill in it (intersection; union when that is empty); a new group is its warband"
        " type's alone.",
        "",
        *table(["Group", "Who learns from it", "How", "Note", "Skills"], rows),
        "",
    ]
    flagged = [
        [
            flag.group,
            _named(data, flag.intersection),
            _named(data, flag.union),
            flag.taken,
            learners(data, {"warbands": flag.named}) if flag.named else "-",
        ]
        for flag in grouped.log.flagged
    ]
    if flagged:
        lines += [
            "### Flagged groups (settle in `skill_group_learners`)",
            "",
            "The warbands that may learn every skill of the group differ from those that may learn one of them (or"
            " none may learn all, so the union is taken). The last column is the warband the list is named after, a"
            " likely answer:",
            "",
            *table(["Group", "Intersection", "Union", "Taken", "Named after"], flagged),
            "",
        ]
    return lines


def _new(data: Any) -> list[str]:
    log = data.skill_groups.log
    rows = [[name, group, setting, source] for name, group, setting, source in log.new_skills]
    lines = [
        "### New groups and skills (`new_skill_groups`)",
        "",
        f"{len(log.new_skills)} new skills, each with the setting mordheimer gives its name (else overrides.json's,"
        ' by "Name (Group)"):',
        "",
        *table(["Skill", "Group", "Setting", "Rules from"], rows),
        "",
    ]
    for name, group, held in log.collisions:
        lines.append(f"Name collision, left out of {group} and not merged: {name} is already {held}.")
    for group, name in log.left_out:
        lines.append(f"mordheimer also lists {name} for {group}; left out of the group.")
    if log.collisions or log.left_out:
        lines.append("")
    reused = [[name, _named(data, before), _named(data, after)] for name, before, after in log.reused]
    if reused:
        lines += [
            "Our skills the new groups hold, whose learners change (a skill is learnable by whoever has a group"
            " holding it):",
            "",
            *table(["Skill", "Before (its rows' who-can)", "Now (its groups)"], reused),
            "",
        ]
    return lines


def skill_groups(data: Any) -> list[str]:
    grouped = data.skill_groups
    links = sum(len(group["skills"]) for group in grouped.groups)
    return [
        "## Skill groups",
        "",
        f"`out/skills.json` is {len(grouped.skills)} skills, one per name; `out/skill-groups.json` is"
        f" {len(grouped.groups)} groups holding them ({links} links), the five core groups first.",
        "",
        *_merges(data),
        *_groups(data),
        *_new(data),
    ]
