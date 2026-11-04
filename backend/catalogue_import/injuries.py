"""The book's serious injury table, from the snapshot's `serious-injuries.json` (its "serious injury" entries; the
file also holds the rules and psychology the pages link to): each result's D66 rolls, the book's name and its rule
text, cleaned as the warband templates' rules are (template_text.py), into `out/serious-injuries.json`. The server's
D66 table (apps/battles/services/injuries.py) follows it, and seed_spells_and_special gives the specials the injury
tables grant by name their text from it."""

import re
from typing import Any

from catalogue_import.template_text import clean_rule

SERIOUS_INJURY = "serious injury"
_ROLL = re.compile(r"^(\d{2})(?:-(\d{2}))?\s+(\S.*)$")  # "62-63 Hardened", "64 Horrible Scars"


def build_serious_injuries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Each serious injury in the file's order: `low` and `high` (its D66 rolls), `name` and `text`. An injury whose
    name doesn't start with its roll stops the build."""
    rows = []
    for entry in entries:
        if entry.get("type") != SERIOUS_INJURY:
            continue
        match = _ROLL.match(str(entry.get("name") or "").strip())
        if match is None:
            raise ValueError(f"serious-injuries.json: no D66 roll in {entry.get('name')!r}")
        low, high, name = match.groups()
        texts = [clean_rule(rule.get("ruleFull")) for rule in entry.get("Rules") or [] if isinstance(rule, dict)]
        rows.append({"low": int(low), "high": int(high or low), "name": name, "text": "\n\n".join(filter(None, texts))})
    return rows
