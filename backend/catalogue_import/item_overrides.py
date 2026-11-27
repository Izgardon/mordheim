"""overrides.json's decisions on single items, applied once every item is made: a soft note on its price rows and
the rules William settles for it."""

from typing import Any


def add_notes(items: list[dict[str, Any]], notes: dict[str, str]) -> None:
    """overrides.json "item_notes": a soft note on every price row of the named item."""
    for item in items:
        note = notes.get(item["name"])
        if not note:
            continue
        for row in item["availabilities"]:
            row["note"] = "; ".join(filter(None, [row["note"], note]))


def set_own_rules(items: list[dict[str, Any]], decisions: dict[str, Any]) -> None:
    """overrides.json "item_own_rules": the rules William settles for one of our items, in place of its own (the
    Rain Coat, which mordheimer leaves to its flavour line while the Khemri page prints what it does). A name that
    is no item of ours stops the build."""
    by_name = {item["name"]: item for item in items}
    missing = sorted(set(decisions) - set(by_name))
    if missing:
        raise ValueError(f"overrides.json item_own_rules: no item {', '.join(missing)}")
    for name, decision in decisions.items():
        by_name[name]["rules"] = [
            {"name": rule.get("name", ""), "summary": rule.get("summary", ""), "text": rule["text"], "tables": []}
            for rule in decision["rules"]
        ]
