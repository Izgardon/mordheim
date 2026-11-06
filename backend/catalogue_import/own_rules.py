"""The hired swords' and dramatis personae's own rules (the coordinator, 5 Nov 2026: two owners share a rule only
through the shared specials list): an owner's rule that is no shared special, kept apart by William's list or one of
the book's general specials (`apps/special/data/special.json`: Large, Wizard, a mount's rules) is his own, a row of
his own that his seeder creates (apps/core/book_lookups.py), never another owner's of the name.

A name two or more owners' own rules hold, worded differently, is named for each owner, as the rules kept apart are:
"Hiring Fee (Johann the Knife)", his name as the app shows it. Owners who word it alike keep its name, each with a row
of his own. `own_names` in out/shared-specials.json gives the seeders those names; the report lists both."""

import re
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import load_json
from catalogue_import.shared_specials import SharedSpecials, key
from catalogue_import.sources import BACKEND

GENERAL_DATA = BACKEND / "apps" / "special" / "data" / "special.json"
Use = tuple[str, str, str]  # an owner, his rule's name as his seeder stores it, its text


def _plain(name: str) -> str:
    """A name as the hireling seeders store it: apostrophes straightened (core/book_lookups.py)."""
    return re.sub(r"[`‘’]", "'", name).strip()


def _wording(text: str) -> str:
    return " ".join(text.casefold().split())


@dataclass
class OwnRules:
    """Each own rule's name (its key) -> its owners in order, once each."""

    held: dict[str, list[Use]] = field(default_factory=dict)

    def add(self, owner: str, name: str, text: str) -> None:
        uses, owner = self.held.setdefault(key(name), []), _plain(owner)
        if owner not in [held_by for held_by, _rule, _text in uses]:
            uses.append((owner, _plain(name), text))

    def collisions(self) -> list[list[Use]]:
        """Each name two or more owners' own rules hold, worded alike or not."""
        return [uses for uses in self.held.values() if len(uses) > 1]

    def differing(self) -> list[list[Use]]:
        return [uses for uses in self.collisions() if len({_wording(text) for _owner, _rule, text in uses}) > 1]

    def names(self) -> list[dict[str, str]]:
        """out/shared-specials.json's `own_names`: each owner's rule of a name others word otherwise, named for him."""
        return [
            {"owner": owner, "rule": rule, "name": f"{rule} ({owner})"}
            for uses in self.differing()
            for owner, rule, _text in uses
        ]

    def render(self) -> str:
        """The report's part of the Shared specials section: the rules named for their owners, and those worded
        alike, which the shared list could merge."""
        differing = self.differing()
        alike = [uses for uses in self.collisions() if uses not in differing]
        lines = [
            "",
            "### Own rules of one name",
            "",
            "A hired sword's or dramatis persona's own rule is a row of his own (two owners share one only through the"
            " shared list). Where other owners' rules of its name are worded otherwise, it is named for him:",
            "",
        ]
        lines += [_listed(uses) for uses in differing] or ["- none"]
        lines += ["", "Worded alike, each owner's own row under the name (the shared list could merge them):", ""]
        lines += [_listed(uses) for uses in alike] or ["- none"]
        return "\n".join(lines) + "\n"


def _listed(uses: list[Use]) -> str:
    return f"- {uses[0][1]}: {'; '.join(owner for owner, _rule, _text in uses)}."


def own_rules(shared: SharedSpecials, hired_swords: list[dict[str, Any]], personae: list[dict[str, Any]]) -> OwnRules:
    """What the hired swords' and dramatis personae's own rules are, by name, in their order."""
    general = {key(row["name"]) for row in load_json(GENERAL_DATA) if isinstance(row, dict)}
    rules = OwnRules()
    for row in [*hired_swords, *personae]:
        for special in row.get("specials") or []:
            plain = isinstance(special, str)
            name, text = (special, "") if plain else (special.get("name", ""), special.get("description", ""))
            found = key(name)
            if (
                found
                and found not in general
                and found not in shared.names
                and (row["name"], found) not in shared.apart
            ):
                rules.add(row["name"], name, str(text))
    return rules
