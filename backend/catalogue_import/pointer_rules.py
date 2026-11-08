"""Rules whose text only points elsewhere (William, 7 Nov 2026, of the Gunnery School of Nuln's Senior Gunnery Officer,
whose Hunter read "See Shooting Skills.": "the unit has the hunter skill and we just reference the skills page, it
should just say the rule there!").

A warband template fighter's or a dramatis persona's own rule whose whole text is a pointer takes the rule it points
to: to a skill ("See Shooting Skills.", "See Strength Skill section.", "As the skill of the same name.", "A Pit King
has the Pit Fighter skill.") our skill of the rule's name (the Pit Fighters' Arms Master is ours too); to another
fighter's entry ("See Goblin Warriors entry for rules.") that fighter's rule of the name, which the fighter then holds
(one row in the template). A text that says more than the pointer, or points to a list of choices ("See the Mutations
list for costs"), is left alone. A pointer we can't resolve stays as it is, listed in the report. The hired swords'
rules are our own data (apps/hirelings/data/hired-swords.json), worded there.
"""

import re
from dataclasses import dataclass, field
from typing import Any

SKILL_POINTER = re.compile(
    r"^(?:see (?:the )?[\w' -]*?\bskills?(?: section| list)?|as the skill of the same name)\.?$", re.I
)
ENTRY_POINTER = re.compile(r"^see (?:the )?(?P<fighter>[\w' -]+?) entry(?: for (?:its |the )?rules)?\.?$", re.I)
HAS_SKILL = re.compile(r"^[\w' -]+? (?:has|have) the (?P<skill>[\w' -]+?) skill\.?$", re.I)  # "A Pit King has the ..."
OWNER_SUFFIX = re.compile(r"\s*\([^)]*\)$")  # "Not Orcs (Cave Squig)": the rule's name for one fighter


def points_to_skill(name: str, text: str) -> bool:
    """A rule's whole text is a pointer to the skill of its name: "See Shooting Skills.", "As the skill of the same
    name.", "A Pit King has the Pit Fighter skill."."""
    named = HAS_SKILL.match(text)
    return bool(SKILL_POINTER.match(text)) or (
        named is not None and named.group("skill").casefold() == _base(name).casefold()
    )


@dataclass
class PointerLog:
    resolved: list[tuple[str, str, str]] = field(default_factory=list)  # owner, rule, where its text is from
    unresolved: list[tuple[str, str, str]] = field(default_factory=list)  # owner, rule, its pointer


def _base(name: str) -> str:
    return OWNER_SUFFIX.sub("", name).strip()


def _skill_text(name: str, skills: dict[str, str], log: PointerLog, owner: str, text: str) -> str | None:
    found = skills.get(_base(name).casefold())
    if found:
        log.resolved.append((owner, name, f"our {_base(name)} skill"))
        return found
    log.unresolved.append((owner, name, text))
    return None


def _entry_rule(template: dict[str, Any], fighter: str, name: str) -> dict[str, Any] | None:
    """The rule of the name (less its fighter's suffix) on the fighter an entry pointer names, by name or plural."""
    wanted = fighter.casefold()
    for other in template["fighters"]:
        if wanted in (other["name"].casefold(), str(other.get("plural") or "").casefold()):
            for special in other["specials"]:
                if _base(special["name"]) == _base(name) and "description" in special:
                    found: dict[str, Any] = special
                    return found
    return None


def _fighter_rules(template: dict[str, Any], fighter: dict[str, Any], skills: dict[str, str], log: PointerLog) -> None:
    owner = f"{template['name']}: {fighter['name']}"
    rules: list[dict[str, Any]] = []
    for special in fighter["specials"]:
        text = str(special.get("description") or "").strip()
        if points_to_skill(special["name"], text):
            found = _skill_text(special["name"], skills, log, owner, text)
            # the skill under its own name: every fighter of the template holds one row ("Pit Fighter (Pit Fighter)" too)
            special = {**special, "name": _base(special["name"]), "description": found} if found else special
        elif (entry := ENTRY_POINTER.match(text)) is not None:
            target = _entry_rule(template, entry.group("fighter"), special["name"])
            if target is None:
                log.unresolved.append((owner, special["name"], text))
            else:
                log.resolved.append((owner, special["name"], f"the {entry.group('fighter')} entry's {target['name']}"))
                special = dict(target)
        if special["name"] not in [rule["name"] for rule in rules]:
            rules.append(special)
    fighter["specials"] = rules


def resolve_pointers(
    templates: list[dict[str, Any]], personae: list[dict[str, Any]], skills: list[dict[str, Any]]
) -> PointerLog:
    """Every template fighter's and dramatis persona's pointer rule given the rule it points to, in place."""
    by_name = {str(row["name"]).casefold(): str(row.get("description") or "") for row in skills}
    log = PointerLog()
    for template in templates:
        for fighter in template["fighters"]:
            _fighter_rules(template, fighter, by_name, log)
    for persona in personae:
        for special in persona.get("specials") or []:
            text = str(special.get("description") or "").strip() if isinstance(special, dict) else ""
            if text and points_to_skill(special["name"], text):
                found = _skill_text(special["name"], by_name, log, persona["name"], text)
                if found:
                    special["description"] = found
    return log


def render_pointers(log: PointerLog) -> str:
    """The report's Pointer rules section: each rule given the text it pointed to, and those left pointing."""
    lines = [
        "## Pointer rules",
        "",
        "A fighter's or dramatis persona's own rule whose whole text pointed elsewhere takes the rule it points to"
        ' (William, 7 Nov 2026: "it should just say the rule there!"; catalogue_import/pointer_rules.py):',
        "",
    ]
    lines += [f"- {owner}: {rule}, from {source}." for owner, rule, source in log.resolved] or ["- none"]
    lines += ["", "Left pointing (nothing to take the rule from):", ""]
    lines += [f'- {owner}: {rule}, "{text}"' for owner, rule, text in log.unresolved] or ["- none"]
    return "\n".join(lines) + "\n"
