"""Our 62 Mutiny in Marienburg items: their current thin text kept, their restrictions read as warband lists where
they name warbands, and every one flagged for the PDF pass but those whose rules William has given (`needs_rules`
false: the Armour of the Wildwood and The Oaken Armour, 6 Nov 2026)."""

import re
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import norm_name
from catalogue_import.groups import collapse
from catalogue_import.prices import mim_cost, parse_rarity
from catalogue_import.statements import SHORT_FORMS
from catalogue_import.text import clean_inline
from catalogue_import.warbands import ALIASES, Resolver

SETTING = "mutiny-in-marienburg"


@dataclass
class MimLog:
    as_notes: list[tuple[str, str]] = field(default_factory=list)  # (item, restriction kept as a note)
    as_lists: list[tuple[str, str, str]] = field(default_factory=list)  # (item, restriction, warbands)
    missing_properties: list[tuple[str, int]] = field(default_factory=list)


class MimReader:
    """Reads "Elves & Dark Elves only" against every warband type and the full groups."""

    def __init__(self, resolver: Resolver, groups: list[dict[str, Any]]) -> None:
        self.resolver = resolver
        self.groups = groups
        self.by_group = {norm_name(group["name"]): group for group in groups}

    def _part(self, text: str) -> list[str] | None:
        key = norm_name(text).removeprefix("the ")
        for form in (key, key + "s", key.removesuffix("s")):
            if form in self.by_group:
                return list(self.by_group[form]["members"])
            form = SHORT_FORMS.get(form, form)
            known = self.resolver.overrides.get(form) or self.resolver.by_name.get(form)
            slugs = known or (ALIASES[form][0] if form in ALIASES else None)
            if slugs:
                return list(slugs)
        return None

    def warbands(self, restriction: str) -> list[dict[str, Any]] | None:
        match = re.match(r"^(.+?)\s+only$", restriction.strip(), re.I)
        if not match:
            return None
        parts = [self._part(piece) for piece in re.split(r"\s*&\s*|,\s*|\s+and\s+", match.group(1)) if piece.strip()]
        if not parts or any(part is None for part in parts):
            return None
        slugs = sorted({slug for part in parts if part for slug in part}, key=self.resolver.order.__getitem__)
        return [{**entry, "excluded": False} for entry in collapse(slugs, self.groups)]


def _rules(
    item: dict[str, Any], properties: dict[int, dict[str, Any]], index: dict[str, dict[str, Any]], log: MimLog
) -> list[dict[str, Any]]:
    rules: list[dict[str, Any]] = [
        {"name": "", "summary": clean_inline(item.get("description")), "text": "", "tables": []}
    ]
    for pid in item.get("properties") or []:
        prop = properties.get(int(pid))
        if prop is None:
            log.missing_properties.append((item["name"], int(pid)))
            continue
        shared = index.get(norm_name(prop["name"]))
        if shared:
            rules.append({"rule": shared["slug"]})
        else:
            rules.append(
                {"name": prop["name"], "summary": "", "text": clean_inline(prop.get("description")), "tables": []}
            )
    return rules


def _availability(item: dict[str, Any], row: dict[str, Any], reader: MimReader, log: MimLog) -> dict[str, Any]:
    restriction = clean_inline(row.get("unique_to"))
    rarity, rarity_note = parse_rarity(row.get("rarity"))
    warbands = reader.warbands(restriction) if restriction else None
    note = rarity_note
    if warbands is not None:
        names = ", ".join(entry.get("group") or entry.get("type") or "" for entry in warbands)
        log.as_lists.append((item["name"], restriction, names))
    elif restriction:
        log.as_notes.append((item["name"], restriction))
        note = "; ".join(filter(None, [restriction, rarity_note]))
    return {
        "label": "",
        **mim_cost(row.get("cost"), row.get("variable_cost")),
        "rarity": rarity,
        "for_everyone": warbands is None,
        "warbands": warbands or [],
        "note": note,
    }


def mim_item(
    item: dict[str, Any],
    properties: dict[int, dict[str, Any]],
    index: dict[str, dict[str, Any]],
    reader: MimReader,
    log: MimLog,
) -> dict[str, Any]:
    name = item["name"]
    return {
        "slug": "",
        "name": name,
        "variant": "",
        "origin": "mim",
        "type": item.get("type") or "Miscellaneous",
        "subtype": item.get("subtype") or "",
        "setting": SETTING,
        "source": "Mutiny in Marienburg",
        "link_url": "",
        "tags": [part.strip().lower() for part in name.split("/")] if "/" in name else [],
        "flavour": "",
        "range": clean_inline(item.get("range")),
        "strength": clean_inline(item.get("strength")),
        "save": clean_inline(item.get("save")),
        "statblock": item.get("statblock") or [],
        "notes": "",
        "needs_rules": item.get("needs_rules", True),  # false once its rules are in (William, 6 Nov 2026)
        "rules": _rules(item, properties, index, log),
        "availabilities": [_availability(item, row, reader, log) for row in item.get("availabilities") or []],
    }
