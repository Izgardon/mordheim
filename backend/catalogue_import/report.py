"""The import report: what William needs to decide, short and scannable."""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from catalogue_import.common import GRADE_RANK, normalise_grade


@dataclass
class ReportData:
    counts: dict[str, int]
    settings: list[dict[str, Any]]
    types: list[dict[str, Any]]
    groups: list[dict[str, Any]]
    group_questions: dict[str, list[str]]
    name_uses: list[Any]
    conflicts: list[dict[str, str]]
    same_names: list[list[dict[str, Any]]]
    mim_items: list[dict[str, Any]]
    mim_log: Any
    item_log: Any
    seed_changes: tuple[list[tuple[str, list[str]]], list[str]]
    shared_rules: list[dict[str, Any]]
    odd_grades: list[tuple[str, str, str]]
    names: dict[str, str]
    assignments: dict[str, list[dict[str, Any]]]
    assignment_log: Any


def _cell(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def _table(header: list[str], rows: Sequence[Sequence[object]]) -> list[str]:
    lines = ["| " + " | ".join(header) + " |", "| " + " | ".join("---" for _ in header) + " |"]
    return lines + ["| " + " | ".join(_cell(value) for value in row) + " |" for row in rows]


def _counts(data: ReportData) -> list[str]:
    rows = [[label, count] for label, count in data.counts.items()]
    return ["## Counts", "", *_table(["What", "Rows"], rows), ""]


def _not_on_mordheimer(data: ReportData) -> int:
    return sum(1 for row in data.types if not row["mordheimer_url"])


def _top(data: ReportData) -> list[str]:
    questions = sum(len(items) for items in data.group_questions.values())
    nobody = [c for c in data.conflicts if c["issue"].startswith("Its lists let no one buy it")]
    unmatched = [use for use in data.name_uses if use.how]
    return [
        "## Start here",
        "",
        f"1. **Same-name list:** {len(data.same_names)} names appear more than once across mordheimer and MiM. mordheimer's entry is the main one; the PDF pass settles each MiM twin (below).",
        f"2. **Warband groups:** {questions} membership questions left, each about types some mordheimer lists name or leave out. Good, Evil and Mercenaries come from mordheimer's hiring lists, so the {_not_on_mordheimer(data)} types mordheimer lacks get their sides in the hired-swords pass.",
        f"3. **Items no one may buy:** {len(nobody)} mordheimer items exclude every warband and permit none, mostly Khemri's. Defaults are in the contradictions table.",
        f"4. **mordheimer's contradictions:** {len(data.conflicts)} places where an item's lists and its own notes disagree, each with the default taken.",
        f'5. **Warband names:** {len(unmatched)} names in mordheimer\'s data match no warband type, or more than one. "Chaos Dwarfs" is mapped to Black Dwarfs and Wolfcloak\'s "Mercenaries" is left out; please check.',
        f"6. **Settings for our skills and hired swords:** {len(data.assignment_log.ambiguous)} names mordheimer gives more than one setting; check the one taken for each.",
        "",
        "Answers go into `overrides.json`; the next build applies them.",
        "",
    ]


def _conflicts(data: ReportData) -> list[str]:
    rows = [[c["item"], c["issue"], c["default"]] for c in data.conflicts]
    return ["## mordheimer's contradictions", "", *_table(["Item", "What disagrees", "Default taken"], rows), ""]


def _names(data: ReportData) -> list[str]:
    names = data.names
    rows = []
    for use in sorted(data.name_uses, key=lambda use: use.name.lower()):
        mapped = ", ".join(names.get(slug, slug) for slug in use.slugs) or "left out"
        rows.append([use.name, ", ".join(sorted(use.where)), mapped, use.how])
    intro = "Names in item, skill, hired-sword or dramatis data that match no warband type exactly, or match several."
    return [
        "## Warband names that need a mapping",
        "",
        intro,
        "",
        *_table(["Name", "Where", "Mapped to", "Why"], rows),
        "",
    ]


def _same_names(data: ReportData) -> list[str]:
    rows = []
    for cluster in data.same_names:
        entries = "; ".join(f"{item['name']} ({item['origin']}, `{item['slug']}`)" for item in cluster)
        main = next((item["slug"] for item in cluster if not item["variant"]), "")
        rows.append([cluster[0]["name"], entries, f"`{main}`" if main else ""])
    intro = (
        'mordheimer\'s entry is the main one. The MiM one keeps the variant "Mutiny in Marienburg" until the PDF pass '
        "shows whether it is the same item at another price (a price row) or a different item."
    )
    return ["## Same-name list", "", intro, "", *_table(["Name", "Entries", "Main"], rows), ""]


def _groups(data: ReportData) -> list[str]:
    lines = ["## Warband group questions", ""]
    lines.append(
        f"Good, Evil and Mercenaries come from mordheimer's hiring lists, so the {_not_on_mordheimer(data)} warband types mordheimer lacks are in no side group yet; the hired-swords pass fills them in."
    )
    lines.append("")
    for group in data.groups:
        questions = data.group_questions.get(group["slug"], [])
        if questions:
            lines.append(f"**{group['name']}** ({len(group['members'])} types)")
            lines.extend(f"- {question}" for question in questions)
            lines.append("")
    return lines


def _settings(data: ReportData) -> list[str]:
    rows = []
    for row in data.settings:
        seen = ", ".join(f"{grade}: {count}" for grade, count in row["grades_seen"].items())
        rows.append([row["name"], row["grade"], row["grade_basis"], seen])
    mixed = [
        row["name"]
        for row in data.settings
        if len(row["grades_seen"]) > 1 and row["grade_basis"].startswith("majority")
    ]
    assumed = [row["name"] for row in data.types if row["setting_assumed"]]
    added = [row["name"] for row in data.types if not row["broheim_url"] and not row["mordheimer_url"]]
    lines = ["## Settings and grades", "", *_table(["Setting", "Grade", "How", "Grades of its contents"], rows), ""]
    lines.append(f"Named settings that mix grades, kept whole at the majority grade: {', '.join(mixed) or 'none'}.")
    lines.append(
        f"Warband types with no setting in either source, placed in Mordheim's part for their grade: {', '.join(assumed)}."
    )
    if added:
        lines.append(f"Warband types on neither site, added in overrides.json: {', '.join(added)}.")
    odd = sorted({grade for _setting, _name, grade in data.odd_grades if grade not in ("None", "")})
    if odd:
        lines.append(f"Grades not counted (not 1a to 3): {', '.join(odd)}, all on MiM items.")
    return [*lines, ""]


def _grade_conflicts(data: ReportData) -> list[str]:
    clashes = []
    for row in data.types:
        broheim, mordheimer = normalise_grade(row["broheim_grade"]), normalise_grade(row["mordheimer_grade"])
        if broheim and mordheimer and GRADE_RANK[broheim] != GRADE_RANK[mordheimer]:
            clashes.append([row["name"], row["broheim_grade"], row["mordheimer_grade"]])
    lines = ["## Broheim and mordheimer grades", ""]
    if not clashes:
        lines.append(
            'No conflicts: wherever both sites grade a warband they agree (mordheimer\'s "core" is 1a). Note that Norse Explorers appears twice in Broheim (Town Cryer 13, 1b; Border Town Burning, 1c) and both rows point at one mordheimer page.'
        )
        return [*lines, ""]
    return [*lines, *_table(["Warband", "Broheim", "mordheimer"], clashes), ""]


def _assignments(data: ReportData) -> list[str]:
    log = data.assignment_log
    rows = []
    for kind, entries in data.assignments.items():
        how = [entry["how"] for entry in entries]
        rows.append(
            [
                kind.replace("_", " "),
                len(entries),
                how.count("mordheimer"),
                how.count("overrides.json"),
                how.count("no match"),
            ]
        )
    lines = [
        "## Settings for the catalogue we have",
        "",
        "`out/setting-assignments.json` gives each of our seeded skills, hired swords and dramatis personae the setting"
        " mordheimer tags its name with; a name mordheimer lacks is Mordheim's (1a). Items get theirs in the items"
        ' rebuild. A row is fixed in overrides.json "setting_assignments" by kind and by the name shown here.',
        "",
        *_table(["Kind", "Ours", "On mordheimer", "Set in overrides.json", "Mordheim by default"], rows),
        "",
    ]
    for kind, names in log.unmatched.items():
        lines.append(f"Not on mordheimer ({kind}), so Mordheim: {', '.join(names)}.")
    if log.unmatched:
        lines.append("")
    if log.ambiguous:
        intro = (
            "Names mordheimer gives more than one setting; the entry for our list's warband was taken, else the one"
            " of our type, else the lowest:"
        )
        table = [[kind, name, taken, ", ".join(others)] for kind, name, taken, others in log.ambiguous]
        lines += [intro, "", *_table(["Kind", "Ours", "Setting taken", "Also on mordheimer"], table), ""]
    for kind, name, settings in log.multi_setting:
        lines.append(f"{name} ({kind}) is in {', '.join(settings)} on mordheimer; it lives in {settings[0]}.")
    return [*lines, ""] if log.multi_setting else lines


def _mim(data: ReportData) -> list[str]:
    names = ", ".join(item["name"] for item in data.mim_items)
    lines = [
        "## MiM items that need rules (PDF pass)",
        "",
        f"All {len(data.mim_items)} keep their one-line text as the summary of an unnamed rule: {names}.",
        "",
    ]
    if data.mim_log.as_notes:
        rows = [[item, text] for item, text in data.mim_log.as_notes]
        lines += [
            "Restrictions that name no warband type or group, kept as notes on a row open to everyone (most limit which unit may carry the item):",
            "",
            *_table(["Item", "Restriction"], rows),
            "",
        ]
    return lines


def _dropped(data: ReportData) -> list[str]:
    lines = ["## Dropped by the first pass", ""]
    renamed, dropped = data.seed_changes
    lines.append(f"In our current seed but on neither mordheimer nor the MiM list: {', '.join(dropped) or 'none'}.")
    if renamed:
        moved = "; ".join(f"{old} -> {', '.join(new)}" for old, new in renamed)
        lines.append(f"In our current seed under another name (not dropped): {moved}.")
    if data.item_log.dropped:
        lines.append(f"mordheimer items dropped in overrides.json: {', '.join(data.item_log.dropped)}.")
    if data.item_log.hidden:
        lines.append(
            f'mordheimer items it hides as aliases of "Club, Mace or Hammer" (their names are its tags), not imported: {", ".join(data.item_log.hidden)}. List any in `keep_hidden_items` to import it.'
        )
    for item, field_name, text in data.item_log.shortened:
        lines.append(f'{item}\'s {field_name} "{text}" is cut to the part before "when"; its rules already say when.')
    return [*lines, ""]


def render_report(data: ReportData) -> str:
    worded = sum(1 for rule in data.shared_rules if rule["wordings"] > 1)
    lines = [
        "# Catalogue import report, first pass",
        "",
        "mordheimer's items plus our MiM list, cleaned into `out/`. Generated by `build.py`; do not edit by hand.",
        f"{len(data.shared_rules)} shared rules, {worded} of them worded differently on some items (those items keep their wording as a text override).",
        "",
    ]
    for section in (
        _top,
        _counts,
        _conflicts,
        _names,
        _same_names,
        _groups,
        _settings,
        _grade_conflicts,
        _assignments,
        _mim,
        _dropped,
    ):
        lines += section(data)
    return "\n".join(lines).rstrip() + "\n"
