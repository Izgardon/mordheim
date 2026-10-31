"""Item rules: a name used by two or more mordheimer items becomes a shared rule, kept in its most common wording.
Every other rule stays on its item."""

from dataclasses import dataclass
from typing import Any

from catalogue_import.common import majority, norm_name, slugify, unique
from catalogue_import.text import Table, clean_inline, clean_text, same_text


@dataclass
class Rule:
    item: str
    name: str
    summary: str
    text: str
    tables: list[Table]


def parse_rule(entry: dict[str, Any], item: str) -> Rule:
    text, tables = clean_text(entry.get("ruleFull"))
    return Rule(item, clean_inline(entry.get("rulename")), clean_inline(entry.get("ruleAbbreviated")), text, tables)


def _wording(rule: Rule) -> str:
    return " ".join(rule.text.lower().split())


def _shared_rule(uses: list[Rule]) -> dict[str, Any]:
    wordings = [_wording(rule) for rule in uses]
    canonical = uses[wordings.index(majority(wordings) or wordings[0])]
    name = majority([rule.name for rule in uses]) or canonical.name
    summary = majority([rule.summary for rule in uses if rule.summary]) or ""
    return {
        "slug": slugify(name),
        "name": name,
        "aliases": [other for other in unique([rule.name for rule in uses]) if other != name],
        "summary": summary,
        "text": canonical.text,
        "tables": canonical.tables,
        "used_by": len(unique([rule.item for rule in uses])),
        "wordings": len(set(wordings)),
    }


def build_shared_rules(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Shared rules, by slug. A name counts once per item however often the item repeats it."""
    by_name: dict[str, list[Rule]] = {}
    for item in items:
        for entry in item.get("specialRules") or []:
            rule = parse_rule(entry, item["name"])
            if rule.name:
                by_name.setdefault(norm_name(rule.name), []).append(rule)
    shared = [_shared_rule(uses) for uses in by_name.values() if len({rule.item for rule in uses}) > 1]
    return sorted(shared, key=lambda rule: rule["slug"])


def index_rules(shared: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Shared rules looked up by any spelling of their name."""
    index = {}
    for rule in shared:
        for name in [rule["name"], *rule["aliases"]]:
            index[norm_name(name)] = rule
    return index


def link_rule(rule: Rule, index: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """A reference to a shared rule (with the item's own wording only where it differs), or the item's own rule."""
    shared = index.get(norm_name(rule.name)) if rule.name else None
    if shared is None:
        return {"name": rule.name, "summary": rule.summary, "text": rule.text, "tables": rule.tables}
    link: dict[str, Any] = {"rule": shared["slug"]}
    if rule.summary and not same_text(rule.summary, shared["summary"]):
        link["summary"] = rule.summary
    if not same_text(rule.text, shared["text"]):
        link["text"] = rule.text
    if rule.tables != shared["tables"]:
        link["tables"] = rule.tables
    return link
