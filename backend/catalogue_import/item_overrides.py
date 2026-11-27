"""overrides.json's decisions on single items, applied once every item is made: a soft note on its price rows, its
buying notes in place of the source's, and the rules William settles for it."""

from typing import Any


def add_notes(items: list[dict[str, Any]], notes: dict[str, str]) -> None:
    """overrides.json "item_notes": a soft note on every price row of the named item."""
    for item in items:
        note = notes.get(item["name"])
        if not note:
            continue
        for row in item["availabilities"]:
            row["note"] = "; ".join(filter(None, [row["note"], note]))


def set_row_notes(items: list[dict[str, Any]], decisions: dict[str, Any]) -> None:
    """overrides.json "item_row_notes": an item's buying note and cost note on every price row, in place of the
    source's (the Familiar's terms were a stray "All warbands*" and a cost note that was a rule). A name that is no
    item of ours stops the build."""
    by_name = {item["name"]: item for item in items}
    missing = sorted(set(decisions) - set(by_name))
    if missing:
        raise ValueError(f"overrides.json item_row_notes: no item {', '.join(missing)}")
    for name, decision in decisions.items():
        for row in by_name[name]["availabilities"]:
            row.update({key: decision[key] for key in ("note", "cost_note")})


def set_row_prices(items: list[dict[str, Any]], decisions: dict[str, Any]) -> None:
    """overrides.json "item_row_prices": the price William settles for one price row of an item, in place of the
    source's (William, 27 Nov 2026: the Double-barrelled Pistol's brace is 50+2D6, twice the single's 25+D6). A row is
    found by its label ("" for none) and, where the decision names one, the warband type its lines name; a name that
    is no item of ours, or a row that matches none or several, stops the build."""
    by_name = {item["name"]: item for item in items}
    missing = sorted(set(decisions) - set(by_name))
    if missing:
        raise ValueError(f"overrides.json item_row_prices: no item {', '.join(missing)}")
    for name, rows in decisions.items():
        for decision in rows:
            label, slug = decision.get("label", ""), decision.get("type")
            found = [
                row
                for row in by_name[name]["availabilities"]
                if row["label"] == label and (slug is None or {"type": slug, "excluded": False} in row["warbands"])
            ]
            if len(found) != 1:
                raise ValueError(f"overrides.json item_row_prices {name!r}: {len(found)} rows match, not one")
            found[0].update({key: decision[key] for key in ("cost", "dice", "dice_multiplier") if key in decision})


def set_own_rules(items: list[dict[str, Any]], decisions: dict[str, Any]) -> None:
    """overrides.json "item_own_rules": the rules William settles for one of our items, in place of its own (the
    Rain Coat, which mordheimer leaves to its flavour line while the Khemri page prints what it does); a rule may be a
    shared one by its slug (the Mechanical Suit keeps Chaos armour's), in the item's own words where it gives them. A
    name that is no item of ours stops the build."""
    by_name = {item["name"]: item for item in items}
    missing = sorted(set(decisions) - set(by_name))
    if missing:
        raise ValueError(f"overrides.json item_own_rules: no item {', '.join(missing)}")
    for name, decision in decisions.items():
        by_name[name]["needs_rules"] = False
        by_name[name]["rules"] = [
            {"rule": rule["rule"], **{key: rule[key] for key in ("summary", "text") if rule.get(key)}}
            if "rule" in rule
            else {"name": rule.get("name", ""), "summary": rule.get("summary", ""), "text": rule["text"], "tables": []}
            for rule in decision["rules"]
        ]


UNWRITTEN = "Rules not written yet: check the book."


def _has_rules(item: dict[str, Any]) -> bool:
    return any(rule.get("rule") or rule.get("text") for rule in item["rules"])


def mark_unwritten(items: list[dict[str, Any]], decisions: dict[str, Any]) -> None:
    """overrides.json "rules_unwritten": an item whose rules no book of ours prints (William, 27 Nov 2026: the items
    audit's question 2, D) warns of it on every price row, so a player knows to check his book. A name that is no item
    of ours, or one that has rules, stops the build."""
    by_name = {item["name"]: item for item in items}
    missing = sorted(set(decisions) - set(by_name))
    if missing:
        raise ValueError(f"overrides.json rules_unwritten: no item {', '.join(missing)}")
    written = sorted(name for name in decisions if _has_rules(by_name[name]))
    if written:
        raise ValueError(f"overrides.json rules_unwritten: {', '.join(written)} has rules")
    for name in decisions:
        for row in by_name[name]["availabilities"]:
            row["note"] = "; ".join(filter(None, [row["note"], UNWRITTEN]))
