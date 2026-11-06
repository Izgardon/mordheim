"""The skill groups our rows lack (phase 1a, overrides.json ``new_skill_groups``) and the build of every group.

A new group is open to its warband type only (``type``), or to the types it names (``types``; a list that is exactly a
group's members is stored as that group), with the note shown when learning from it (``note``: who of the warband may
take its shared skills, "Gnoblars only: Infiltration"). Its skills are ours by name (``skills``) and new ones
(``new_skills``, title-cased; ``{"name", "rule"}`` names a new skill apart from the mordheimer skill whose rules it
takes, "Pathfinder (Horned Hunters)") whose rules come from mordheimer's ``Rules`` (the entry naming the group's
warband) or from a source file in ``sources/`` (``source``), each given a setting the way our rows are (assignments.py:
mordheimer's for its name, else overrides.json's ``setting_assignments`` by "Name (Group)", else Mordheim's). A new
name that a skill we have already holds (one of ours, or a hired sword's or dramatis persona's own special skill, which
their seeder makes) is left out of the group and reported, never merged. mordheimer skills naming the group's warband
that the group leaves out are reported too.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from catalogue_import.assignments import best_entry
from catalogue_import.common import as_list, norm_name
from catalogue_import.hiring import named_after
from catalogue_import.skill_groups import Skill, SkillGroupBuild, SkillGroupLog, group_rank, title_case
from catalogue_import.skill_lists import SkillLists
from catalogue_import.text import clean_inline
from catalogue_import.warbands import Resolver

Assign = Callable[[list[dict[str, Any]]], list[dict[str, Any]]]  # rows (name, type) -> their settings (assignments.py)


@dataclass
class SkillGroups:
    skills: list[dict[str, Any]]  # out/skills.json: name, description
    groups: list[dict[str, Any]]  # out/skill-groups.json, the core groups first
    settings: list[dict[str, Any]]  # setting-assignments.json's skills: name, setting, how
    log: SkillGroupLog


def rules_text(entry: dict[str, Any]) -> str:
    """A mordheimer skill's rules, cleaned as the import cleans its other text."""
    parts = [clean_inline(rule.get("ruleFull")) for rule in entry.get("Rules") or [] if isinstance(rule, dict)]
    return "\n\n".join(part for part in parts if part)


def _named(raw: str | dict[str, str]) -> tuple[str, str]:
    """A new skill's name and the name of the skill whose rules it takes: a bare name (title-cased) is both."""
    if isinstance(raw, dict):
        return raw["name"], raw.get("rule", raw["name"])
    return title_case(raw), title_case(raw)


def hireling_skill_names(*profiles: list[dict[str, Any]]) -> dict[str, str]:
    """The special skills our hired swords and dramatis personae bring (their seeder makes each its own): name ->
    whose."""
    found: dict[str, str] = {}
    for rows in profiles:
        for row in rows:
            for terms in (row.get("hired_sword"), row.get("dramatis_persona")):
                for skill in (terms or {}).get("available_special_skills") or []:
                    name = skill if isinstance(skill, str) else skill.get("name", "")
                    found.setdefault(norm_name(name), str(row.get("name")))
    return found


class NewGroups:
    """overrides.json's new groups, built against the merged skills (`build.skills`)."""

    def __init__(
        self,
        build: SkillGroupBuild,
        decisions: dict[str, dict[str, Any]],
        theirs: list[dict[str, Any]],
        files: dict[str, list[dict[str, Any]]],
        taken: dict[str, str],
        resolver: Resolver,
    ) -> None:
        self.build = build
        self.decisions = decisions
        self.theirs: dict[str, list[dict[str, Any]]] = {}
        for entry in theirs:
            self.theirs.setdefault(norm_name(str(entry.get("name") or "")), []).append(entry)
        self.files = {name: {norm_name(row["name"]): row for row in rows} for name, rows in files.items()}
        self.taken = taken
        self.resolver = resolver
        self.made: dict[str, Skill] = {}  # the new skills, by norm_name
        self.settings: list[dict[str, Any]] = []  # theirs: name, setting, how
        self.reused: list[str] = []  # our skills the new groups hold

    def groups(self, assign: Assign) -> list[dict[str, Any]]:
        groups = []
        for name, decision in self.decisions.items():
            slugs = list(decision.get("types") or [decision["type"]])
            unknown = [slug for slug in slugs if slug not in self.build.order]
            if unknown:
                raise ValueError(f"overrides.json new_skill_groups {name!r}: no warband type {unknown[0]!r}")
            skills = [self._ours(name, skill) for skill in decision.get("skills", [])]
            self.reused += [skill for skill in skills if skill not in self.reused]
            wanted = [_named(raw) for raw in decision.get("new_skills", [])]
            made = [self._new(name, skill, rule, decision.get("source"), assign) for skill, rule in wanted]
            skills += [skill for skill in made if skill is not None]
            self._left_out(name, slugs, [*skills, *(rule for _skill, rule in wanted)])
            groups.append(
                {
                    "name": name,
                    **self.build.access_of(frozenset(slugs)),
                    "large_only": False,
                    "note": str(decision.get("note") or ""),
                    "how": "new group",
                    "skills": skills,
                }
            )
        return groups

    def _ours(self, group: str, name: str) -> str:
        skill = self.build.skills.get(norm_name(name))
        if skill is None:
            raise ValueError(f"overrides.json new_skill_groups {group!r}: no skill {name!r}")
        return skill.name

    def _new(self, group: str, name: str, rule: str, source: str | None, assign: Assign) -> str | None:
        """A new skill of the group (made once for every group listing it), with the rules (and setting) of `rule`;
        None when a skill we have holds its name."""
        key = norm_name(name)
        if key in self.made:
            return self.made[key].name
        held = self._held(key)
        if held:
            self.build.log.collisions.append((name, group, held))
            return None
        text, origin = self._rule(group, rule, source)
        self.made[key] = Skill(name, text)
        assigned = assign([{"name": rule, "type": group}])[0]
        self.settings.append({"name": name, "setting": assigned["setting"], "how": assigned["how"]})
        self.build.log.new_skills.append((name, group, assigned["setting"], origin))
        return name

    def _held(self, key: str) -> str:
        """What already holds a name: one of our skills, or a hired sword's own; "" when nothing does."""
        ours = self.build.skills.get(key)
        if ours is not None:
            return f"our skill {ours.name}"
        return f"{self.taken[key]}'s own skill" if key in self.taken else ""

    def _rule(self, group: str, name: str, source: str | None) -> tuple[str, str]:
        """A new skill's rules and where they come from."""
        if source:
            row = self.files.get(source, {}).get(norm_name(name))
            if row is None:
                raise ValueError(f"overrides.json new_skill_groups {group!r}: {source} has no {name!r}")
            return str(row["description"]), str(row.get("source") or source)
        found = self.theirs.get(norm_name(name))
        if not found:
            raise ValueError(f"overrides.json new_skill_groups {group!r}: mordheimer has no skill {name!r}")
        entry = best_entry(group, found)
        return rules_text(entry), f"mordheimer ({entry.get('source')})"

    def _left_out(self, group: str, slugs: list[str], names: list[str]) -> None:
        """mordheimer's skills naming the group's warbands that the group doesn't hold."""
        listed = {norm_name(name) for name in names}
        for key, entries in self.theirs.items():
            permitted = [name for entry in entries for name in as_list(entry.get("permittedWarbands"))]
            if key not in listed and any(set(slugs) & set(self.resolver.find(name)) for name in permitted):
                self.build.log.left_out.append((group, title_case(str(entries[0]["name"]))))


def build_skill_groups(
    sources: Any,
    types: list[dict[str, Any]],
    groups: list[dict[str, Any]],
    lists: SkillLists,
    resolver: Resolver,
    who_rows: list[dict[str, Any]],
    assigned: list[dict[str, Any]],
    assign: Assign,
) -> SkillGroups:
    """The skills (one per name), every group (our lists', then the new ones; the core five first) and each skill's
    setting, from our rows (`sources.our_skills`), their who-can (`who_rows`) and settings (`assigned`)."""
    overrides = sources.overrides
    build = SkillGroupBuild(overrides, types, groups, lists, lambda name: named_after(name, resolver, groups))
    build.merge(sources.our_skills)
    settings = build.settings(assigned)
    built = build.list_groups(sources.our_skills, who_rows)
    taken = hireling_skill_names(sources.our_hired_swords, sources.our_personae)
    files = getattr(sources, "skill_files", {})
    new = NewGroups(build, overrides.get("new_skill_groups", {}), sources.skills, files, taken, resolver)
    built += new.groups(assign)
    build.check_reused(new.reused, built)
    settings += new.settings
    skills = [{"name": skill.name, "description": skill.description} for skill in build.skills.values()]
    skills += [{"name": skill.name, "description": skill.description} for skill in new.made.values()]
    return SkillGroups(skills, sorted(built, key=lambda group: group_rank(group["name"])), settings, build.log)
