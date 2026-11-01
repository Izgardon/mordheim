"""Settings for the catalogue rows we already have (grading phase 1): our skills, hired swords and dramatis personae,
matched by name against mordheimer's, which tags each entry with a setting and a grade. A row with no match is
Mordheim's (1a). Items are left out: the items rebuild seeds them from ``out/items.json``, which carries its own.

mordheimer repeats a special skill's name for each warband that takes it ("Hide in Shadows" for the Hochland
Bandits, the Horned Hunters, the Shadow Warriors and the Night Goblins), at different settings. Our skills table
types a special skill by its warband's list ("Hochland Bandits"), so the entry whose warbands name that list wins;
then one whose subtype is ours ("Academic" and "Academic Skill"); then the lowest setting. Each such choice is
listed in the report.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import loose_key, norm_name
from catalogue_import.grading import SETTING_ORDER, _named_settings

MORDHEIM = "mordheim"


@dataclass
class AssignmentLog:
    """What the report lists: names matched more than once (and the one taken), and entries in several settings,
    each with how its setting was decided (mordheimer, or overrides.json, which settles it)."""

    # kind, name, taken, others, how
    ambiguous: list[tuple[str, str, str, list[str], str]] = field(default_factory=list)
    # kind, name, settings, taken, how
    multi_setting: list[tuple[str, str, list[str], str, str]] = field(default_factory=list)
    unmatched: dict[str, list[str]] = field(default_factory=dict)  # kind -> our names


def _stem(word: str) -> str:
    """A word without its plural: "Elves" is elf, "Bandits" bandit."""
    key = loose_key(word)
    if key.endswith("ves"):
        return key[:-3] + "f"
    return key.removesuffix("s")


def _words(text: str) -> set[str]:
    return {_stem(word) for word in text.split() if loose_key(word)}


def _score(ours_type: str, entry: dict[str, Any]) -> int:
    """How well a mordheimer entry fits our row's type: 2 names its warband list, 1 shares its subtype, 0 neither."""
    warbands = entry.get("permittedWarbands")
    names = [warbands] if isinstance(warbands, str) else warbands if isinstance(warbands, list) else []
    wanted = _words(ours_type)
    for name in names:
        if not isinstance(name, str) or name == "all":
            continue
        if wanted and wanted <= _words(name):  # each word of ours is one of theirs: "Dark Elf" in "Dark Elves"
            return 2
    subtype = norm_name(str(entry.get("subtype") or "")).removesuffix(" skill")
    return 1 if ours_type and subtype == norm_name(ours_type) else 0


def _home(entry: dict[str, Any]) -> list[str]:
    return _named_settings(entry)


def _order(slug: str) -> int:
    return SETTING_ORDER.index(slug) if slug in SETTING_ORDER else len(SETTING_ORDER)


def label(row: dict[str, Any]) -> str:
    """How the report and overrides.json name one of our rows: "Sniper (Hochland Bandits)" for a skill."""
    return f"{row['name']} ({row['type']})" if row.get("type") else str(row["name"])


def best_entry(ours_type: str, found: list[dict[str, Any]]) -> dict[str, Any]:
    """The best-fitting entry among `found` (all of one name) for our row of `ours_type`: the one naming our list's
    warband, else the one of our subtype, else the lowest setting's."""
    return min(found, key=lambda entry: (-_score(ours_type, entry), _order(_home(entry)[0])))


def _pick(
    kind: str, row: dict[str, Any], found: list[dict[str, Any]], log: AssignmentLog, chosen: str | None = None
) -> str:
    """The setting of the best-fitting entry among `found` (all of one name), or overrides.json's (`chosen`); either
    way the report hears when mordheimer gives the name more than one."""
    taken = best_entry(str(row.get("type") or ""), found)
    settings = _home(taken)
    setting, how = (chosen, "overrides.json") if chosen else (settings[0], "mordheimer")
    homes = {_home(entry)[0] for entry in found}
    if len(homes) > 1:
        others = sorted(homes - {setting}, key=_order)
        log.ambiguous.append((kind, label(row), setting, others, how))
    if len(settings) > 1:
        log.multi_setting.append((kind, row["name"], settings, setting, how))
    return setting


def assign(
    kind: str,
    ours: list[dict[str, Any]],
    theirs: list[dict[str, Any]],
    log: AssignmentLog,
    chosen: dict[str, str] | None = None,
) -> list[Any]:
    """Each of our rows with its setting: overrides.json's (`chosen`, by label), else mordheimer's for its name, else
    Mordheim's."""
    by_name: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for entry in theirs:
        by_name[norm_name(str(entry.get("name") or ""))].append(entry)
    rows = []
    for row in ours:
        name = str(row.get("name") or "").strip()
        if not name:
            continue
        # a skill is one of a name and type (our skills table's key); a hired sword or persona is one of a name
        typed = kind == "skills" and "type" in row
        assigned: dict[str, Any] = {"name": name, **({"type": row["type"]} if typed else {})}
        found = by_name.get(norm_name(name), [])
        picked = (chosen or {}).get(label(assigned))
        if found:
            setting = _pick(kind, assigned, found, log, picked)
            how = "overrides.json" if picked else "mordheimer"
        elif picked:
            setting, how = picked, "overrides.json"
        else:
            setting, how = MORDHEIM, "no match"
            log.unmatched.setdefault(kind, []).append(name)
        rows.append({**assigned, "setting": setting, "how": how})
    return rows


def build_assignments(sources: Any, log: AssignmentLog) -> dict[str, list[dict[str, Any]]]:
    """``out/setting-assignments.json``: our skills, hired swords and dramatis personae with their settings."""
    chosen = sources.overrides.get("setting_assignments", {})
    return {
        "skills": assign("skills", sources.our_skills, sources.skills, log, chosen.get("skills")),
        "hired_swords": assign(
            "hired swords", sources.our_hired_swords, sources.hired_swords, log, chosen.get("hired_swords")
        ),
        "dramatis_personae": assign(
            "dramatis personae", sources.our_personae, sources.personae, log, chosen.get("dramatis_personae")
        ),
    }
