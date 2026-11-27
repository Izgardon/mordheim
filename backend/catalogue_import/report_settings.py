"""The import report's Settings for the catalogue we have section: how each of our skills, hired swords, dramatis
personae and lores got its setting (out/setting-assignments.json)."""

from typing import Any

from catalogue_import.report_skills import table

# how a row of setting-assignments.json got its setting -> the report's heading for it
HOW_HEADINGS = {
    "On mordheimer": "mordheimer",
    "Set in overrides.json": "overrides.json",
    "From a PDF page": "pdf-warbands",
    "From spells.json": "spells.json",
    "Earliest adopter": "earliest adopter",
    "Mordheim by default": "no match",
}


def assignments(data: Any) -> list[str]:
    """How each row of setting-assignments.json got its setting, and the names mordheimer leaves open."""
    log = data.assignment_log
    rows = [
        [
            kind.replace("_", " "),
            len(entries),
            *([entry["how"] for entry in entries].count(how) for how in HOW_HEADINGS.values()),
        ]
        for kind, entries in data.assignments.items()
    ]
    lines = [
        "## Settings for the catalogue we have",
        "",
        "`out/setting-assignments.json` gives each of our seeded skills, hired swords and dramatis personae the setting"
        " mordheimer tags its name with; a name mordheimer lacks is Mordheim's (1a), a PDF page's new skill its page's,"
        " and each lore of our spells its spells' (apps/spells/data/spells.json); a skill or lore whose earliest adopter"
        " is earlier sits there (Earliest adopters, below). Items get theirs in the items rebuild. A row is fixed in"
        ' overrides.json "setting_assignments" by kind and by the name shown here.',
        "",
        *table(["Kind", "Ours", *HOW_HEADINGS], rows),
        "",
    ]
    for kind, names in log.unmatched.items():
        lines.append(f"Not on mordheimer ({kind}), so Mordheim: {', '.join(names)}.")
    if log.unmatched:
        lines.append("")
    if log.ambiguous:
        intro = (
            "Names mordheimer gives more than one setting; the entry for our list's warband was taken, else the one"
            " of our type, else the lowest. One set in overrides.json is settled:"
        )
        found = [[kind, name, taken, ", ".join(others), _settled(how)] for kind, name, taken, others, how in log.ambiguous]  # fmt: skip
        lines += [intro, "", *table(["Kind", "Ours", "Setting taken", "Also on mordheimer", "Settled"], found), ""]
    for kind, name, settings, taken, how in log.multi_setting:
        where = f", settled in {_settled(how)}" if _settled(how) else ""
        lines.append(f"{name} ({kind}) is in {', '.join(settings)} on mordheimer; it lives in {taken}{where}.")
    return [*lines, ""] if log.multi_setting else lines


def _settled(how: str) -> str:
    return how if how in ("overrides.json", "pdf-warbands") else ""
