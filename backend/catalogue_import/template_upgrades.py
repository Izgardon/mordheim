"""A warband template's upgrades (the Mutations, Marks and Blessings bought onto a fighter), each with the special it
gives and its group's terms read from the group's text (`template_answers.UPGRADE_TERMS`): who may take one, the most
of the group a fighter may have, whether the second and later cost double, whether they are bought only when he is
recruited. Each group's own text is a warband rule of its name, and an entry that is no upgrade (the Lizardmen's
Poisoned Weapons) is a warband rule instead."""

import string
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import slugify
from catalogue_import.template_answers import UPGRADE_TERMS, UPGRADE_WHO, UPGRADES_AS_RULES
from catalogue_import.template_text import clean_rule, clean_title


@dataclass
class UpgradeLog:
    terms: list[tuple[str, str, str]] = field(default_factory=list)  # page, group, the terms set
    as_rules: list[tuple[str, str]] = field(default_factory=list)  # page, an entry made a warband rule
    unknown_keys: list[tuple[str, str, str]] = field(
        default_factory=list
    )  # page, group or upgrade, a key no fighter has
    no_terms: list[tuple[str, str]] = field(default_factory=list)  # page, a group no answer covers


def _upgrade_text(entry: dict[str, Any]) -> str:
    text = clean_rule(entry.get("ruleFull"))
    parts = [
        f"{clean_title(rule.get('rulename'))}: {clean_rule(rule.get('ruleFull'))}" for rule in entry.get("rules") or []
    ]
    return "\n\n".join(filter(None, [text, *parts]))


def terms_text(terms: dict[str, Any]) -> str:
    """The terms as the report lists them: "who fighters the-possessed, mutants; later double; at recruit"."""
    who = terms.get("who") or {}
    named = (["heroes"] if who.get("heroes") else []) + list(who.get("fighters") or [])
    parts = [f"who {', '.join(named)}" if named else "who anyone"]
    if terms.get("max_per_fighter"):
        parts.append(f"at most {terms['max_per_fighter']} each")
    parts += [
        label for key, label in (("later_double", "later double"), ("at_recruit", "at recruit")) if terms.get(key)
    ]
    if "cost" in terms:
        parts.append(f"cost {terms['cost']}")
    return "; ".join(parts)


def _check_keys(slug: str, owner: str, who: dict[str, Any], keys: set[str], log: UpgradeLog) -> None:
    for key in [*(who.get("fighters") or []), *(who.get("except") or [])]:
        if key not in keys:
            log.unknown_keys.append((slug, owner, key))


def build_upgrades(
    slug: str, page: dict[str, Any], owner: str, log: UpgradeLog | None = None
) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    """The page's upgrades, each with the special it gives and its group's terms, and the warband rules: each group's
    own text under its name, and each entry William made a rule (UPGRADES_AS_RULES) under its own."""
    log = log if log is not None else UpgradeLog()
    keys = {slugify(row["id"]) for row in page.get("fighters") or [] if row.get("id")}
    upgrades, rules = [], []
    for group in page.get("mutations") or []:
        name = clean_title(group.get("mutationName"))
        terms = dict(UPGRADE_TERMS.get((slug, name), {}))
        text = clean_rule(group.get("mutationflavour"))
        if text:
            rules.append({"title": name, "description": text, "variant": "", "type": ""})
        added = 0
        for entry in group.get("items") or []:
            heading = clean_title(entry.get("heading"))
            heading = string.capwords(heading) if heading == heading.lower() else heading
            if heading in UPGRADES_AS_RULES.get(slug, frozenset()):
                rules.append({"title": heading, "description": _upgrade_text(entry), "variant": "", "type": ""})
                log.as_rules.append((slug, heading))
                continue
            cost = str(entry.get("cost") or "").strip()
            who = dict(UPGRADE_WHO.get((slug, heading), terms.get("who") or {}))
            _check_keys(slug, heading, who, keys, log)
            upgrades.append(
                {
                    "group": name,
                    "special": {"name": heading, "type": owner, "description": _upgrade_text(entry)},
                    "cost": int(cost) if cost.isdigit() else terms.get("cost"),
                    "cost_note": "" if cost.isdigit() or not cost else cost,
                    "note": "",
                    "who": who,
                    "max_per_fighter": terms.get("max_per_fighter"),
                    "later_double": bool(terms.get("later_double")),
                    "at_recruit": bool(terms.get("at_recruit")),
                }
            )
            added += 1
        if added and (slug, name) in UPGRADE_TERMS:
            log.terms.append((slug, name, terms_text(terms)))
        elif added:
            log.no_terms.append((slug, name))
    return upgrades, rules
