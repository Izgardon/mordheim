"""Items the warband templates bring into the catalogue (William, 4 Nov 2026): the Swivel Gun's three shots back from
our old seed, single use; the War Chain; and the warbands' special equipment we lack, each with one price row for its
warband at the book's price and rarity and its rules from mordheimer, cleaned.

overrides.json says which: ``seed_items_back`` (an old seed row's name -> its setting, source and why),
``extra_items`` (an item no source has; with no ``cost`` it gets no price row, so the store never offers it) and
``warband_items`` (an item's name -> the snapshot page and special equipment it comes from, the warband type that
buys it, its type and subtype)."""

import re
from collections.abc import Mapping
from typing import Any

from catalogue_import.groups import collapse
from catalogue_import.prices import mordheimer_cost, parse_rarity
from catalogue_import.rules import link_rule, parse_rule
from catalogue_import.text import clean_inline

FIGURES = {"range": "range", "strength": "strength"}  # special equipment "rules" that are the item's figures
LIST_OF_RULES = "special rules"  # "Requires two hands, Lock": the names of the rules that follow
_RARITY = re.compile(r"^(?:rare\s*(\d+)|common)?\s*(?:\((.*)\)|(.*))$", re.I)


def _item(name: str, kind: str, subtype: str, setting: str, source: str, **fields: Any) -> dict[str, Any]:
    """An entry in out/items.json's shape."""
    return {
        "slug": "",
        "name": name,
        "variant": "",
        "origin": "templates",
        "type": kind,
        "subtype": subtype,
        "setting": setting,
        "source": source,
        "link_url": fields.get("link_url", ""),
        "tags": fields.get("tags", [name.lower()]),
        "flavour": "",
        "range": fields.get("range", ""),
        "strength": fields.get("strength", ""),
        "save": "",
        "statblock": [],
        "notes": "",
        "needs_rules": False,
        "rules": fields.get("rules", []),
        "availabilities": fields.get("availabilities", []),
        **({"single_use": True} if fields.get("single_use") else {}),
    }


def _row(cost: Mapping[str, Any], rarity: int | None, warbands: list[dict[str, Any]], note: str) -> dict[str, Any]:
    everyone = not warbands
    return {"label": "", **cost, "rarity": rarity, "for_everyone": everyone, "warbands": warbands, "note": note}


def seed_items_back(
    decisions: dict[str, dict[str, str]], seed: list[dict[str, Any]], properties: dict[int, dict[str, Any]]
) -> list[dict[str, Any]]:
    """Old seed rows brought back as they were: their price rows (for everyone), their properties as rules."""
    rows = {row["name"]: row for row in seed}
    items = []
    for name, decision in decisions.items():
        if name not in rows:
            raise ValueError(f"overrides.json seed_items_back: no seed item {name!r}")
        row = rows[name]
        rules = [
            {"name": prop["name"], "summary": "", "text": clean_inline(prop.get("description")), "tables": []}
            for pid in row.get("properties") or []
            if (prop := properties.get(int(pid)))
        ]
        prices = [
            _row({"cost": price.get("cost"), "dice": None, "dice_multiplier": None, "cost_note": ""}, None, [], "")
            for price in row.get("availabilities") or []
        ]
        shot = name.rpartition(" - ")[2].lower()  # "ball shot": what a list calls it
        tags = [name.lower(), shot] if shot != name.lower() else [name.lower()]
        fields = {"strength": row.get("strength") or "", "rules": rules, "availabilities": prices, "tags": tags}
        kind = row.get("type") or "Miscellaneous"
        items.append(
            _item(
                name,
                kind,
                row.get("subtype") or "",
                decision["setting"],
                decision["source"],
                **fields,
                single_use=bool(row.get("single_use")),
            )
        )
    return items


def _extra_rules(entry: dict[str, Any], index: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """An extra item's rules as out/items.json holds them: `{"rule": slug}` for a shared rule (a slug no shared rule
    has stops the build), else the item's own `{name, summary, text}`."""
    slugs = {rule["slug"] for rule in index.values()}
    rules = []
    for rule in entry.get("rules", []):
        if "rule" in rule:
            if rule["rule"] not in slugs:
                raise ValueError(f"overrides.json extra_items {entry['name']!r}: no shared rule {rule['rule']!r}")
            rules.append({"rule": rule["rule"]})
        else:
            rules.append({**{"name": "", "summary": "", "text": "", "tables": []}, **rule})
    return rules


def extra_items(
    entries: list[dict[str, Any]], groups: list[dict[str, Any]], index: dict[str, dict[str, Any]]
) -> list[dict[str, Any]]:
    """Items no source has, with one price row each for the warbands named. An entry with no `cost` gets no price
    row at all, so nobody can buy it and the store never offers it (who_can.py: `offer`): what a named hired sword
    or dramatis persona carries and nothing else (William, 13 Nov 2026, of the Pox Staff)."""
    items = []
    for entry in entries:
        fields: dict[str, Any] = {
            "rules": _extra_rules(entry, index),
            **{key: entry[key] for key in ("range", "strength") if key in entry},
        }
        if entry.get("cost") is not None:
            cost = {"cost": entry["cost"], "dice": None, "dice_multiplier": None, "cost_note": ""}
            warbands = [{**line, "excluded": False} for line in collapse(entry.get("warbands", []), groups)]
            fields["availabilities"] = [_row(cost, entry.get("rarity"), warbands, entry.get("note", ""))]
        items.append(
            _item(
                entry["name"],
                entry["type"],
                entry.get("subtype", ""),
                entry["setting"],
                entry["source"],
                **fields,
            )
        )
    return items


def _equipment_fields(entry: dict[str, Any], name: str, index: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """A special equipment entry's figures (its "Range" and "Strength" rules) and its own rules."""
    fields: dict[str, Any] = {"rules": []}
    for raw in entry.get("specialRules") or []:
        rule_name = clean_inline(raw.get("rulename")).lower()
        if rule_name in FIGURES:
            fields[FIGURES[rule_name]] = clean_inline(raw.get("ruleFull"))
        elif rule_name != LIST_OF_RULES:
            fields["rules"].append(link_rule(parse_rule(raw, name), index))
    return fields


def special_equipment_items(
    decisions: dict[str, dict[str, str]],
    pages: dict[str, dict[str, Any]],
    types: list[dict[str, Any]],
    groups: list[dict[str, Any]],
    index: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """The special equipment we lack, each with one price row for its warband: the book's price and rarity, and who
    in the warband may buy it as the row's note ("Aristocrat only")."""
    by_slug = {row["slug"]: row for row in types}
    items = []
    for name, decision in decisions.items():
        page = pages[decision["page"]]
        title = decision.get("entry", name)
        found = [row for row in page.get("specialEquipment") or [] if clean_inline(row["title"]) == title]
        if not found or decision["warband"] not in by_slug:
            raise ValueError(f"overrides.json warband_items {name!r}: no {title!r} on {decision['page']}, or no type")
        entry, warband = found[0], by_slug[decision["warband"]]
        match = _RARITY.match(clean_inline(entry.get("availability")))
        rarity = int(match.group(1)) if match and match.group(1) else None
        note = clean_inline((match.group(2) or match.group(3)) if match else "").strip()
        lines = [{**line, "excluded": False} for line in collapse([warband["slug"]], groups)]
        row = _row(mordheimer_cost(entry.get("cost")), parse_rarity(rarity or 0)[0], lines, note)
        fields = {**_equipment_fields(entry, name, index), "availabilities": [row], "link_url": warband["link_url"]}
        items.append(
            _item(
                name,
                decision["type"],
                decision.get("subtype", ""),
                warband["setting"],
                clean_inline(page.get("source")),
                **fields,
            )
        )
    return items


def template_items(
    overrides: dict[str, Any],
    pages: dict[str, dict[str, Any]],
    seed: list[dict[str, Any]],
    properties: dict[int, dict[str, Any]],
    types: list[dict[str, Any]],
    groups: list[dict[str, Any]],
    index: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """Every item the templates bring in, as overrides.json names them."""
    return [
        *seed_items_back(overrides.get("seed_items_back", {}), seed, properties),
        *extra_items(overrides.get("extra_items", []), groups, index),
        *special_equipment_items(overrides.get("warband_items", {}), pages, types, groups, index),
    ]
