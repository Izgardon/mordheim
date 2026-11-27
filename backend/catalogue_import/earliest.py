"""An entry sits in the setting of its earliest adopter (William, 27 Nov 2026: "Yes, always move skills, lores, items
down to the earliest adopter").

A skill, a skill group, a spell lore (its spells with it) and an item take the setting of the earliest graded setting
among everyone the book data has using them, where that is earlier than their own: the lowest grade
(`CampaignType.grade`), then the setting's order. So the one Seeker skill, Mordheim 2a's for the Wood Elves, is 1b's,
since the Kislev Ranger (1b) learns it. Who uses what:

- a skill group: the warband types its who-can lines name, the template fighters who learn from it (their types'
  settings, each type read with its preset variant, or every variant where the player picks one) and the hired swords
  and dramatis personae who learn from it;
- a skill: everyone using a group that holds it, the template fighters, hired swords and dramatis personae who start
  with it, and those hirelings who learn it as one of their own special skills;
- a lore: the template fighters, hired swords and dramatis personae who cast from it (`spell_types`, and the lores of
  the spells a hireling knows);
- an item: the warband types its price rows name (a row in a setting of its own counts there at the earliest), the
  template lists that sell it and the hirelings whose kit carries it.

An entry open to everyone (a group for everyone, a skill one of them holds, an item with a price row for everyone)
and one nobody uses keep their own setting. A skill whose setting overrides.json states (``setting_assignments``)
keeps it; one whose earliest adopter is earlier still is listed in the report for William, never moved.
"""

from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import GRADE_RANK, load_json, norm_name
from catalogue_import.grading import SETTING_ORDER
from catalogue_import.sources import BACKEND

SPELL_DATA = BACKEND / "apps" / "spells" / "data"

MORDHEIM = "mordheim"  # a setting of none counts as Mordheim's (1a)


def setting_rank(slug: str, grades: Mapping[str, str]) -> tuple[int, int]:
    """How early a setting is: its grade's rank, then its place in the settings' order."""
    order = SETTING_ORDER.index(slug) if slug in SETTING_ORDER else len(SETTING_ORDER)
    return GRADE_RANK.get(grades.get(slug, ""), 0), order


def earliest(slugs: Iterable[str], grades: Mapping[str, str]) -> str:
    """The earliest of the settings: the lowest graded, then the first in order."""
    return min(slugs, key=lambda slug: setting_rank(slug, grades))


@dataclass(frozen=True)
class Use:
    setting: str
    who: str  # for the report: "Kislev Ranger (hired sword)", "Adventurers: Elf"


@dataclass
class Moves:
    """What the report lists: each entry moved down (kind, name, was, now, who), and each whose override stands
    though an adopter is earlier (kind, name, its override, the earlier setting, who)."""

    moved: list[tuple[str, str, str, str, str]] = field(default_factory=list)
    kept: list[tuple[str, str, str, str, str]] = field(default_factory=list)


def _names(values: Iterable[Any], key: str = "name") -> list[str]:
    """Names from a list of strings or of dicts holding them under `key`."""
    found = [value.get(key) if isinstance(value, dict) else value for value in values or []]
    return [str(name) for name in found if name]


class Adopters:
    """Who uses each skill group, skill, lore and item, as `Use`s, read from the built warband types and groups, the
    templates and our hired swords and dramatis personae (with their settings)."""

    def __init__(
        self,
        types: list[dict[str, Any]],
        warband_groups: list[dict[str, Any]],
        templates: list[dict[str, Any]],
        hirelings: list[tuple[dict[str, Any], str, str]],  # row, its setting, "hired sword" or "dramatis persona"
    ) -> None:
        self.types = {row["slug"]: row for row in types}
        self.members = {row["slug"]: list(row["members"]) for row in warband_groups}
        self.groups: dict[str, list[Use]] = {}  # by norm_name, beside their who-can lines
        self.skills: dict[str, list[Use]] = {}  # started with, or learned as a hireling's own special skill
        self.lores: dict[str, list[Use]] = {}
        self.items: dict[tuple[str, str], list[Use]] = {}  # by name and variant (a kit by name: variant "")
        for template in templates:
            self._template(template)
        for row, setting, kind in hirelings:
            self._hireling(row, Use(setting, f"{row['name']} ({kind})"))

    def _add(self, found: dict[Any, list[Use]], key: Any, use: Use) -> None:
        found.setdefault(key, []).append(use)

    def _template(self, template: dict[str, Any]) -> None:
        variants = [str(row["key"]) for row in template.get("variants") or []]
        for served in template.get("types") or []:
            row = self.types.get(served["type"])
            if row is None or not row.get("setting"):
                continue
            preset = str(served.get("variant") or "")
            read = [preset] if preset else variants  # the player picks one where the type presets none
            for fighter in template.get("fighters") or []:
                use = Use(str(row["setting"]), f"{row['name']}: {fighter['name']}")
                changes = [fighter.get("variant_changes", {}).get(key, {}) for key in read] or [{}]
                for change in changes:
                    for group in change.get("skill_types", fighter.get("skill_types") or []):
                        self._add(self.groups, norm_name(group), use)
                    for skill in _names([*fighter.get("skills", []), *change.get("skills", [])]):
                        self._add(self.skills, norm_name(skill), use)
                for lore in _names(fighter.get("spell_types", [])):
                    self._add(self.lores, norm_name(lore), use)
            for shown in template.get("lists") or []:
                use = Use(str(row["setting"]), f"{row['name']}: {shown['name']}")
                for line in shown.get("lines") or []:
                    if not preset or line.get("variant") in ("", None, preset):
                        item = line["item"]
                        self._add(self.items, (norm_name(item["name"]), item.get("variant") or ""), use)

    def _hireling(self, row: dict[str, Any], use: Use) -> None:
        terms = row.get("hired_sword") or row.get("dramatis_persona") or {}
        for group in terms.get("available_skill_types") or []:
            self._add(self.groups, norm_name(group), use)
        for skill in _names([*row.get("skills", []), *terms.get("available_special_skills", [])]):
            self._add(self.skills, norm_name(skill), use)
        lores = [*_names(row.get("spell_types", [])), *_names(row.get("spells", []), "lore")]
        for lore in dict.fromkeys(lores):
            self._add(self.lores, norm_name(lore), use)
        for item in _names(row.get("equipment", []), "item"):
            self._add(self.items, (norm_name(item), ""), use)

    def lines(self, lines: list[dict[str, Any]]) -> list[Use]:
        """The warband types a who-can list lets in, at their settings."""
        uses = []
        for line in lines:
            if line.get("excluded"):
                continue
            slugs = [line["type"]] if "type" in line else self.members.get(line.get("group", ""), [])
            for slug in slugs:
                row = self.types.get(slug)
                if row and row.get("setting"):
                    uses.append(Use(str(row["setting"]), str(row["name"])))
        return uses


class EarliestAdopter:
    """Moves each entry down to its earliest adopter's setting (`move`), logging what moved and what an override
    kept."""

    def __init__(self, grades: Mapping[str, str], adopters: Adopters) -> None:
        self.grades = grades
        self.adopters = adopters
        self.moves = Moves()

    def rank(self, slug: str) -> tuple[int, int]:
        return setting_rank(slug, self.grades)

    def no_earlier(self, use: Use, floor: str | None) -> Use:
        """A use in `floor`'s setting where that is later: a price row of a setting of its own (a Mutiny in Marienburg
        price on our item) counts only there."""
        return Use(floor, use.who) if floor and self.rank(floor) > self.rank(use.setting) else use

    def move(
        self,
        kind: str,
        rows: list[dict[str, Any]],
        uses_of: Callable[[dict[str, Any]], list[Use] | None],
        overridden: Callable[[dict[str, Any]], bool] = lambda row: False,
    ) -> None:
        """Each row's setting, moved down to the earliest of `uses_of(row)` (None: open to everyone, kept) where that
        is earlier than its own; a row `overridden` keeps its own and is logged."""
        for row in rows:
            uses = uses_of(row)
            if not uses:
                continue
            own = str(row.get("setting") or MORDHEIM)
            first = min(uses, key=lambda use: self.rank(use.setting))
            if self.rank(first.setting) >= self.rank(own):
                continue
            if overridden(row):
                self.moves.kept.append((kind, str(row["name"]), own, first.setting, first.who))
                continue
            self.moves.moved.append((kind, str(row["name"]), own, first.setting, first.who))
            row["setting"] = first.setting
            if "how" in row:
                row["how"] = "earliest adopter"

    def groups(self, groups: list[dict[str, Any]]) -> None:
        self.move("skill groups", groups, self.group_uses)

    def group_uses(self, group: dict[str, Any]) -> list[Use] | None:
        if group.get("for_everyone"):
            return None
        return [
            *self.adopters.lines(group.get("warbands") or []),
            *self.adopters.groups.get(norm_name(group["name"]), []),
        ]

    def skills(self, skills: list[dict[str, Any]], groups: list[dict[str, Any]]) -> None:
        """Our skills (setting-assignments.json's), by the groups holding them (before the groups move: their uses
        are what count)."""
        holding: dict[str, list[dict[str, Any]]] = {}
        for group in groups:
            for name in group["skills"]:
                holding.setdefault(norm_name(name), []).append(group)

        def uses_of(skill: dict[str, Any]) -> list[Use] | None:
            key = norm_name(skill["name"])
            uses = []
            for group in holding.get(key, []):
                found = self.group_uses(group)
                if found is None:
                    return None
                uses += found
            return uses + self.adopters.skills.get(key, [])

        self.move("skills", skills, uses_of, lambda skill: skill.get("how") == "overrides.json")

    def lores(self, lores: list[dict[str, Any]]) -> None:
        self.move("lores", lores, lambda lore: self.adopters.lores.get(norm_name(lore["name"]), []))

    def items(self, items: list[dict[str, Any]]) -> None:
        def uses_of(item: dict[str, Any]) -> list[Use] | None:
            rows = item.get("availabilities") or []
            if any(row.get("for_everyone") for row in rows):
                return None
            uses = [
                self.no_earlier(use, row.get("setting")) for row in rows for use in self.adopters.lines(row["warbands"])
            ]
            key = (norm_name(item["name"]), item.get("variant") or "")
            return uses + self.adopters.items.get(key, [])

        self.move("items", items, uses_of)


def move_to_earliest(
    settings: list[dict[str, Any]],
    types: list[dict[str, Any]],
    warband_groups: list[dict[str, Any]],
    templates: list[dict[str, Any]],
    sources: Any,
    assignments: dict[str, list[dict[str, Any]]],
    skill_groups: list[dict[str, Any]],
    items: list[dict[str, Any]],
) -> Moves:
    """Every skill group, skill (setting-assignments.json's), lore (added there as `lores`, from our spells) and item
    moved down to its earliest adopter, in place; what moved, for the report."""
    hirelings = []
    for kind, rows, label in (
        ("hired_swords", sources.our_hired_swords, "hired sword"),
        ("dramatis_personae", sources.our_personae, "dramatis persona"),
    ):
        setting_of = {row["name"]: row["setting"] for row in assignments[kind]}
        hirelings += [(row, setting_of[row["name"]], label) for row in rows if setting_of.get(row["name"])]
    grades = {row["slug"]: row["grade"] for row in settings}
    move = EarliestAdopter(grades, Adopters(types, warband_groups, templates, hirelings))
    move.skills(assignments["skills"], skill_groups)  # by the groups' uses, before they move
    move.groups(skill_groups)
    assignments["lores"] = lore_rows(load_json(SPELL_DATA / "spells.json"))
    move.lores(assignments["lores"])
    move.items(items)
    return move.moves


def lore_rows(spells: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Each lore of our spells (apps/spells/data/spells.json) with the setting its spells give it (none: Mordheim's),
    in the file's order."""
    lores: dict[str, dict[str, Any]] = {}
    for spell in spells:
        lores.setdefault(
            str(spell["type"]), {"name": str(spell["type"]), "setting": spell.get("setting"), "how": "spells.json"}
        )
    return list(lores.values())


def render_earliest(moves: Moves) -> str:
    """The report's Earliest adopters section: every entry moved, by kind, and each override that stands."""
    lines = [
        "## Earliest adopters",
        "",
        "A skill, skill group, lore (its spells with it) or item sits in the setting of the earliest graded setting"
        ' among those who use it, where that is earlier than its own (William, 27 Nov 2026: "Yes, always move skills,'
        ' lores, items down to the earliest adopter"; catalogue_import/earliest.py). Moved:',
        "",
    ]
    for kind in ("skill groups", "skills", "lores", "items"):
        rows = sorted((row for row in moves.moved if row[0] == kind), key=lambda row: row[1].lower())
        lines += [f"### {kind.capitalize()} ({len(rows)})", ""]
        lines += [f"- {name}: {was} -> {now} ({who})" for _kind, name, was, now, who in rows] or ["- none"]
        lines.append("")
    lines += ["Set in overrides.json and kept there, though an adopter is earlier still (William's call):", ""]
    lines += [
        f"- {name} ({kind}): {own}, while {who} is {earlier}" for kind, name, own, earlier, who in moves.kept
    ] or ["- none"]
    return "\n".join(lines) + "\n"
