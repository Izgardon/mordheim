"""William's decisions on our skill lists (overrides.json): who learns the skills of a list mordheimer lacks, the skills
left out of the catalogue, the skills added from a warband's PDF and the descriptions put right.

- ``skill_lists``: a list's name -> ``for_everyone`` or ``warbands`` (``{"type": slug}`` or ``{"group": slug}``), plus
  ``large_only`` (a Large unit's skill: the pages warn for any other, never block) and ``note`` (shown when learning,
  never checked: "Vampire only"). It places the list's skills mordheimer lacks, as a general list or a list named after
  a warband would.
- ``drop_skills``: our rows left out, by label ("Prize-fighter (Strigany)"), each with why.
- ``extra_skills``: rows our skills table lacks (``name``, ``type``, ``description``, ``source``).
- ``skill_descriptions``: a row's description put right, by label.

The build applies them to our rows before anything reads them, so the settings, who-can and ``out/skills.json`` (the
rows ``seed_skills`` reads) agree, and the report lists each.
"""

from dataclasses import dataclass, field
from typing import Any

from catalogue_import.assignments import label
from catalogue_import.common import norm_name


@dataclass
class SkillListLog:
    """What the report lists: each list decision with the skills it placed, and the rows dropped, added and reworded."""

    decisions: dict[str, dict[str, Any]] = field(default_factory=dict)  # list name -> William's decision
    placed: dict[str, list[str]] = field(default_factory=dict)  # list name -> our skills it placed
    dropped: list[tuple[str, str]] = field(default_factory=list)  # label, why
    added: list[tuple[str, str]] = field(default_factory=list)  # label, source
    reworded: list[str] = field(default_factory=list)  # labels


class SkillLists:
    """overrides.json's skill decisions, checked against the warband types and groups the build made."""

    def __init__(self, overrides: dict[str, Any], types: list[dict[str, Any]], groups: list[dict[str, Any]]) -> None:
        known = {("type", row["slug"]) for row in types} | {("group", row["slug"]) for row in groups}
        self.log = SkillListLog()
        self.lists: dict[str, dict[str, Any]] = {}
        for name, decision in overrides.get("skill_lists", {}).items():
            for line in decision.get("warbands", []):
                kind = "type" if "type" in line else "group"
                if (kind, line.get(kind)) not in known:
                    raise ValueError(f"overrides.json skill_lists {name!r}: no warband {kind} {line.get(kind)!r}")
            self.lists[norm_name(name)] = {**decision, "name": name}
            self.log.decisions[name] = decision
        self.drops: dict[str, str] = dict(overrides.get("drop_skills", {}))
        self.extras: list[dict[str, Any]] = list(overrides.get("extra_skills", []))
        self.descriptions: dict[str, str] = dict(overrides.get("skill_descriptions", {}))

    def apply(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Our skill rows with the drops left out, the descriptions put right and the extra rows added after them."""
        kept = []
        for row in rows:
            key = label(row)
            if key in self.drops:
                self.log.dropped.append((key, self.drops[key]))
                continue
            if key in self.descriptions:
                row = {**row, "description": self.descriptions[key]}
                self.log.reworded.append(key)
            kept.append(row)
        missing = sorted(set(self.drops) - {key for key, _why in self.log.dropped})
        missing += sorted(set(self.descriptions) - set(self.log.reworded))
        if missing:
            raise ValueError(f"overrides.json names skills we don't have: {', '.join(missing)}")
        for extra in self.extras:
            row = {"name": extra["name"], "type": extra["type"], "description": extra["description"]}
            self.log.added.append((label(row), extra.get("source", "")))
            kept.append(row)
        return kept

    def decision(self, list_name: str) -> dict[str, Any] | None:
        """William's decision for a skill list, or None."""
        return self.lists.get(norm_name(list_name))

    def access(self, list_name: str, skill: str) -> dict[str, Any] | None:
        """Who may learn a skill of the list mordheimer lacks, as the decision says (None: no decision)."""
        decision = self.decision(list_name)
        if decision is None:
            return None
        self.log.placed.setdefault(decision["name"], []).append(skill)
        warbands = [{**line, "excluded": False} for line in decision.get("warbands", [])]
        return {"for_everyone": not warbands, "warbands": warbands}

    def extras_of(self, list_name: str) -> dict[str, Any]:
        """What the list's decision adds to each of its skills: ``large_only`` and the learning ``note``."""
        decision = self.decision(list_name) or {}
        extra: dict[str, Any] = {}
        if decision.get("large_only"):
            extra["large_only"] = True
        if decision.get("note"):
            extra["note"] = decision["note"]
        return extra
