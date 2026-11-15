"""Our 61 Mutiny in Marienburg items: their current thin text kept, their restrictions read as warband lists where
they name warbands, and every one flagged for the PDF pass but those whose rules William has given (`needs_rules`
false: the Armour of the Wildwood and The Oaken Armour, 6 Nov 2026).

Each one sits in the setting of its own grade (William, 12 Nov 2026): the Mordheim part for a grade below the
supplement's own 2b (3 items in Mordheim 1a, 7 in 1b, 6 in 2a), and Mutiny in Marienburg itself for the rest, so a
2b campaign is still the one that sees the supplement. The grades above it were "2c" and "3a", which the system has
no part for, and they are 2b now too ("2c should move to 2b", "put all those 3a items in 2b MiM as well")."""

import re
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import norm_name, unique
from catalogue_import.grading import MIM, mim_setting
from catalogue_import.groups import collapse
from catalogue_import.prices import mim_cost, parse_rarity
from catalogue_import.statements import SHORT_FORMS
from catalogue_import.text import clean_inline
from catalogue_import.warbands import ALIASES, Resolver

SETTING = MIM
MERGE_LABEL = "Mutiny in Marienburg"  # the label a carried price row wears (William, 15 Nov 2026)


@dataclass
class MimLog:
    as_notes: list[tuple[str, str]] = field(default_factory=list)  # (item, restriction kept as a note)
    as_lists: list[tuple[str, str, str]] = field(default_factory=list)  # (item, restriction, warbands)
    missing_properties: list[tuple[str, int]] = field(default_factory=list)
    merged: list[tuple[str, str, str]] = field(default_factory=list)  # (stub, the item it joined, the price carried)


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
        "setting": mim_setting(item.get("grade")),
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


def _price(row: dict[str, Any]) -> str:
    """A carried price row as the report prints it: "100 gc, Rare 8", "50 + D6 gc, Rare 10"."""
    dice = f"{row['dice']}D6" if (row["dice"] or 0) > 1 else ("D6" if row["dice"] else "")
    if dice and row.get("dice_multiplier"):
        dice += f"x{row['dice_multiplier']}"
    cost = " + ".join(filter(None, [str(row["cost"]) if row["cost"] is not None else "", dice])) or "-"
    return f"{cost} gc, {'Rare ' + str(row['rarity']) if row['rarity'] else 'Common'}"


def merge_duplicates(
    stubs: list[dict[str, Any]], items: list[dict[str, Any]], decisions: dict[str, Any], log: MimLog
) -> list[dict[str, Any]]:
    """William's answers of 15 Nov 2026 (`mim_merges`): a Mutiny in Marienburg stub that duplicates a complete item of
    ours is left out, and the book's price it carried becomes a price row of that item labelled "Mutiny in Marienburg",
    since a price row has no setting of its own. The stub's name becomes a tag of that item, with any other name
    William gives it (`tags`), so a search and a warband list naming the stub still find it."""
    by_name = {item["name"]: item for item in items}
    kept = []
    for stub in stubs:
        decision = decisions.get(stub["name"])
        if decision is None:
            kept.append(stub)
            continue
        target = by_name.get(decision["item"])
        if target is None:
            raise ValueError(f"overrides.json mim_merges {stub['name']!r}: we hold no item {decision['item']!r}")
        for row in stub["availabilities"]:
            target["availabilities"].append({**row, "label": MERGE_LABEL})
            log.merged.append((stub["name"], target["name"], _price(row)))
        names = [stub["name"].lower(), *(tag.lower() for tag in decision.get("tags") or [])]
        target["tags"] = unique(target["tags"] + names)
    missing = sorted(set(decisions) - {name for name, _item, _price_text in log.merged})
    if missing:
        raise ValueError(f"overrides.json mim_merges names MiM items we don't have: {', '.join(missing)}")
    return kept
