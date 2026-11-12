"""Skill groups (phase 1a; William, 4 Nov 2026: "skills exist as they are without a skill group column. we than have a
skill group table and a pivot table linking them, so a single skill can be owned by multiple skill groups"): our skill
rows (a name and its list) become one skill per name, linked into every group that had a row of it, and each list
becomes a group that says who learns from it.

- Rows merge by name, in any case, under the title-case spelling ("Battle Tongue"). A merged skill takes
  overrides.json's ``skill_wordings`` (its ``text``, or the row it is ``from``), else the longest description; the
  report lists every wording dropped. Its setting is the lowest of its rows' (so it is in play wherever one was).
- ``skill_splits``: a row whose rule differs stays a skill of its own, renamed after its group ("Sniper (Shadow
  Warriors)"), in that group alone.
- Who learns from a group: ``skill_group_learners`` (William settling a flagged group), else its list's decision
  (``skill_lists``, with ``large_only`` and the learning ``note``), else the warbands that may learn every skill in it
  (the intersection of its rows' who-can). A group whose intersection is empty (the union is taken) or differs from
  the union is flagged with both.
- ``new_skill_groups`` (new_groups.py): groups our rows lack, each open to its warband type only.
- A group's ``setting`` (grading phase 1) is the setting every warband that may learn from it sits in, when each of
  them is graded 3; every other group's is null, which counts as Mordheim's and is in play everywhere.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.assignments import label
from catalogue_import.common import norm_name
from catalogue_import.grading import SETTING_ORDER
from catalogue_import.groups import collapse
from catalogue_import.skill_lists import SkillLists
from catalogue_import.text import same_text

CORE_GROUPS = ("Combat", "Shooting", "Academic", "Strength", "Speed")  # listed first, in the book's order
SMALL_WORDS = {"a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"}


def title_case(name: str) -> str:
    """Each word capitalised but the small ones inside: "Hide in shadows" is "Hide in Shadows"."""
    words = name.split(" ")
    return " ".join(
        word.lower() if index and word.lower() in SMALL_WORDS else word[:1].upper() + word[1:]
        for index, word in enumerate(words)
    )


def group_rank(name: str) -> tuple[int, str]:
    """The five core groups first, in the book's order, then the rest by name."""
    return (CORE_GROUPS.index(name) if name in CORE_GROUPS else len(CORE_GROUPS), name.lower())


@dataclass
class Merge:
    name: str
    labels: list[str]  # the rows merged
    how: str  # "longest", or "overrides.json"
    dropped: list[tuple[str, str]]  # each wording not taken: the row's label, its text


@dataclass
class Flag:
    group: str
    intersection: list[str]  # type slugs that may learn every skill of it
    union: list[str]  # type slugs that may learn one
    taken: str  # "intersection", or "union" when the intersection is empty
    named: list[dict[str, Any]]  # the warband type or group the list is named after (hiring.named_after), if any


@dataclass
class SkillGroupLog:
    """What the report's Skill groups section lists."""

    merges: list[Merge] = field(default_factory=list)
    splits: list[tuple[str, str, str]] = field(default_factory=list)  # label, its own name, why
    settings: list[tuple[str, list[str], str]] = field(default_factory=list)  # skill, its rows' settings, taken
    flagged: list[Flag] = field(default_factory=list)
    new_skills: list[tuple[str, str, str, str]] = field(default_factory=list)  # name, group, setting, source
    collisions: list[tuple[str, str, str]] = field(default_factory=list)  # name, group, what holds the name already
    left_out: list[tuple[str, str]] = field(default_factory=list)  # group, a mordheimer skill naming it, not in it
    reused: list[tuple[str, list[str], list[str]]] = field(default_factory=list)  # skill, learners before, after


@dataclass
class Skill:
    name: str
    description: str = ""
    rows: list[dict[str, Any]] = field(default_factory=list)


def setting_order(slug: str) -> int:
    return SETTING_ORDER.index(slug) if slug in SETTING_ORDER else len(SETTING_ORDER)


class SkillGroupBuild:
    """One build's skills and list groups from our rows, their who-can and settings, and overrides.json's decisions."""

    def __init__(
        self,
        overrides: dict[str, Any],
        types: list[dict[str, Any]],
        groups: list[dict[str, Any]],
        lists: SkillLists,
        named_after: Callable[[str], list[dict[str, Any]]] = lambda name: [],
    ) -> None:
        self.named_after = named_after
        self.order = {row["slug"]: index for index, row in enumerate(types)}
        self.type_rows = {row["slug"]: row for row in types}
        self.everyone = frozenset(self.order)
        self.members = {group["slug"]: frozenset(group["members"]) for group in groups}
        self.groups = groups
        self.lists = lists
        self.splits: dict[str, dict[str, str]] = dict(overrides.get("skill_splits", {}))
        self.wording_names = list(overrides.get("skill_wordings", {}))
        self.wordings = {norm_name(name): entry for name, entry in overrides.get("skill_wordings", {}).items()}
        self.learners = {norm_name(name): entry for name, entry in overrides.get("skill_group_learners", {}).items()}
        self.skills: dict[str, Skill] = {}  # norm_name -> skill
        self.row_skill: dict[str, str] = {}  # a row's label -> its skill's name
        self.row_access: dict[str, dict[str, Any]] = {}  # a row's label -> its who-can (hiring.py)
        self.log = SkillGroupLog()

    def merge(self, rows: list[dict[str, Any]]) -> None:
        """Our rows as skills by name (any case; a split row under its own name), first seen first."""
        for row in rows:
            row_label = label(row)
            split = self.splits.get(row_label)
            if split:
                self.log.splits.append((row_label, split["name"], split.get("why", "")))
            name = split["name"] if split else str(row["name"]).strip()
            self.skills.setdefault(norm_name(name), Skill(name)).rows.append(row)
        missing = sorted(set(self.splits) - {row_label for row_label, _name, _why in self.log.splits})
        if missing:
            raise ValueError(f"overrides.json skill_splits names rows we don't have: {', '.join(missing)}")
        merged = {key for key, skill in self.skills.items() if len(skill.rows) > 1}
        unknown = sorted(name for name in self.wording_names if norm_name(name) not in merged)
        if unknown:
            raise ValueError(f"overrides.json skill_wordings names no merged skill: {', '.join(unknown)}")
        for key, skill in self.skills.items():
            if key in merged:
                skill.name = title_case(skill.name)
            skill.description = self._wording(skill)
            self.row_skill.update({label(row): skill.name for row in skill.rows})

    def _unknown_learners(self) -> list[str]:
        """skill_group_learners lines naming a warband type or group the build doesn't have."""
        known = {("type", slug) for slug in self.order} | {("group", slug) for slug in self.members}
        lines = [line for entry in self.learners.values() for line in entry.get("warbands", [])]
        return [f"{kind} {line[kind]}" for line in lines for kind in ("type", "group") if kind in line and (kind, line[kind]) not in known]  # fmt: skip

    def _wording(self, skill: Skill) -> str:
        texts = [(label(row), str(row.get("description") or "")) for row in skill.rows]
        if len(texts) == 1:
            return str(texts[0][1])
        chosen = self.wordings.get(norm_name(skill.name))
        if chosen and "text" in chosen:
            text, how = chosen["text"], "overrides.json"
        elif chosen:
            found = [row_text for row_label, row_text in texts if row_label == chosen.get("from")]
            if not found:
                raise ValueError(f"overrides.json skill_wordings {skill.name!r}: no row {chosen.get('from')!r}")
            text, how = found[0], "overrides.json"
        else:
            text, how = max(texts, key=lambda pair: len(pair[1]))[1], "longest"
        dropped: list[tuple[str, str]] = []
        for row_label, other in texts:
            if not same_text(other, text) and not any(same_text(other, kept) for _label, kept in dropped):
                dropped.append((row_label, other))
        self.log.merges.append(Merge(skill.name, [row_label for row_label, _text in texts], how, dropped))
        return str(text)

    def settings(self, assigned: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Each skill's setting: the lowest of its rows' (setting-assignments.json's, by name and list)."""
        by_row = {label(row): row for row in assigned}
        rows = []
        for skill in self.skills.values():
            found = [by_row[label(row)] for row in skill.rows if label(row) in by_row]
            if not found:
                rows.append({"name": skill.name, "setting": "mordheim", "how": "no match"})
                continue
            taken = min(found, key=lambda row: setting_order(row["setting"]))
            settings = sorted({row["setting"] for row in found}, key=setting_order)
            if len(settings) > 1:
                self.log.settings.append((skill.name, settings, taken["setting"]))
            rows.append({"name": skill.name, "setting": taken["setting"], "how": taken["how"]})
        return rows

    def list_groups(self, rows: list[dict[str, Any]], who_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """A group per list, in the order the lists are first seen: its skills in row order and who learns from it."""
        self.row_access = {label(row): row for row in who_rows}
        lists: dict[str, list[dict[str, Any]]] = {}
        for row in rows:
            lists.setdefault(str(row["type"]).strip(), []).append(row)
        groups = []
        for name, members in lists.items():
            skills = list(dict.fromkeys(self.row_skill[label(row)] for row in members))
            known = [label(row) for row in members if label(row) in self.row_access]
            access = self.group_access(name, [self.row_access[key] for key in known])
            groups.append({"name": name, "setting": self.setting_of(access), **access, "skills": skills})
        unknown = self._unknown_learners() + sorted(set(self.learners) - {norm_name(name) for name in lists})
        if unknown:
            raise ValueError(f"overrides.json skill_group_learners names what we lack: {', '.join(unknown)}")
        return groups

    def setting_of(self, access: dict[str, Any]) -> str | None:
        """The setting a group belongs to: the one every warband that may learn from it sits in, when each of them
        is graded 3. Grade 3 is the content a lower-grade campaign must not see at all — the reason Khemri splits
        (William, 11 Nov 2026) — so its groups carry a setting and go out of play with it, instead of showing as a
        row with every skill inside it filtered out. Giving the other settings' groups theirs is a job of its own."""
        lines = access.get("warbands") or []
        if access.get("for_everyone") or not lines:
            return None
        if any(line.get("excluded") or "type" not in line for line in lines):
            return None
        rows = [self.type_rows.get(str(line["type"])) for line in lines]
        if any(row is None or row.get("broheim_grade") != "3" for row in rows):
            return None
        settings = {str(row["setting"]) for row in rows if row}
        return settings.pop() if len(settings) == 1 else None

    def type_set(self, access: dict[str, Any]) -> frozenset[str]:
        """The type slugs a who-can list lets in (everyone: every type but those it shuts out)."""

        def named(excluded: bool) -> frozenset[str]:
            lines = [line for line in access.get("warbands", []) if bool(line.get("excluded")) == excluded]
            found: set[str] = set()
            for line in lines:
                found |= {line["type"]} if "type" in line else self.members.get(line["group"], frozenset())
            return frozenset(found)

        return self.everyone - named(True) if access.get("for_everyone") else named(False)

    def access_of(self, slugs: frozenset[str]) -> dict[str, Any]:
        """A who-can list letting `slugs` in: everyone, a group they make up, or the types."""
        if slugs >= self.everyone:
            return {"for_everyone": True, "warbands": []}
        lines = collapse(self.ordered(slugs), self.groups)
        return {"for_everyone": False, "warbands": [{**line, "excluded": False} for line in lines]}

    def ordered(self, slugs: frozenset[str]) -> list[str]:
        return sorted(slugs, key=self.order.__getitem__)

    def group_access(self, name: str, row_access: list[dict[str, Any]]) -> dict[str, Any]:
        """Who learns from a list's group and how that was decided, with its Large-only flag and learning note (the
        list's decision's)."""
        extras = self.lists.extras_of(name)
        flags = {"large_only": bool(extras.get("large_only")), "note": extras.get("note", "")}
        settled = self.learners.get(norm_name(name))
        decision = settled or self.lists.decision(name)
        if decision is not None:
            lines = [{**line, "excluded": False} for line in decision.get("warbands", [])]
            how = "skill_group_learners" if settled else "skill_lists"
            return {"for_everyone": not lines, "warbands": lines, **flags, "how": how}
        sets = [self.type_set(access) for access in row_access] or [self.everyone]
        inter, union = frozenset.intersection(*sets), frozenset.union(*sets)
        if not inter or inter != union:
            taken = "intersection" if inter else "union"
            flag = Flag(name, self.ordered(inter), self.ordered(union), taken, self.named_after(name))
            self.log.flagged.append(flag)
        return {**self.access_of(inter or union), **flags, "how": "intersection" if inter else "union"}

    def check_reused(self, skill_names: list[str], groups: list[dict[str, Any]]) -> None:
        """Our skills a new group reuses: who could learn each before (its rows' who-can) and who can now (every group
        holding it), when they differ."""
        for name in skill_names:
            skill = self.skills.get(norm_name(name))
            if skill is None:  # a skill another new group made, which has no rows of ours to compare (Savage Fury)
                continue
            accesses = [self.row_access[label(row)] for row in skill.rows if label(row) in self.row_access]
            before = frozenset().union(*(self.type_set(access) for access in accesses))
            after = frozenset().union(*(self.type_set(group) for group in groups if name in group["skills"]))
            if before != after:
                self.log.reused.append((name, self.ordered(before), self.ordered(after)))
