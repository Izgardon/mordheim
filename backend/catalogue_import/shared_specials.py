"""Shared specials (William, 5 Nov 2026): one general special for a rule many owners hold under names of their own, from
William's list `apps/special/data/shared-specials.json`, into `out/shared-specials.json` for seed_spells_and_special:

- Fear, Stupidity and Immune to Psychology (typed Psychology) and Immune to Poison (Trait): the snapshot's psychology
  entry of its `psychology` name, cleaned as the templates' rules are and after its `first_line`, else the list's
  `text`;
- a special an upgrade sells: the upgrade of its name on the template that sells it (`upgrade_of`), its `subject`
  made general ("The Tainted One" -> "The model").

A template fighter's rule or an upgrade of a shared name or alias links it (templates.py); a rule the list keeps
`apart` stays its owner's own, named for him, with his own text. The hired swords', dramatis personae's and beasts'
rules are linked by name by their seeders' book lookups (apps/core/book_lookups.py), which read the names and the
rules kept apart from the output; the report lists every rule merged and kept apart, for every owner."""

import re
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import load_json
from catalogue_import.sources import BACKEND
from catalogue_import.template_text import clean_rule

SHARED_DATA = BACKEND / "apps" / "special" / "data" / "shared-specials.json"
BEASTS = [BACKEND / "apps" / "bestiary" / "data" / name for name in ("bestiary.json", "mim-bestiary.json")]
PSYCHOLOGY = "psychology"
OWNER_KINDS = {
    "warband": "warband",
    "hired_sword": "hired sword",
    "dramatis_persona": "dramatis persona",
    "beast": "beast",
}
_BOLD = re.compile(r"\*\*(.+?)\*\*")  # the psychology entries' markdown: "**a) If the model is charged ...**"
_ITALIC = re.compile(r"(?<!\w)_([^_\n]+)_(?!\w)")  # "_fear_-causing"


def key(name: str) -> str:
    """A rule's name as the seeders' book lookups match it: apostrophes straightened, spacing and case ignored."""
    return " ".join(re.sub(r"[`‘’]", "'", name).split()).casefold()


def owner_label(owner: dict[str, str]) -> str:
    """An `apart` owner as the build names it: "Skaven: Rat Ogre" for a template's fighter, else his name."""
    if "warband" in owner:
        return f"{owner['warband']}: {owner['fighter']}"
    return next(iter(owner.values()))


@dataclass
class SharedLog:
    merged: list[tuple[str, str, str, str]] = field(default_factory=list)  # shared special, owner kind, owner, his rule
    apart: list[tuple[str, str, str]] = field(default_factory=list)  # the rule kept his own, owner kind, owner


class SharedSpecials:
    """William's list: the shared specials by name and alias and the rules kept apart by owner, the wordings the build
    finds on the pages, and what each owner's rule became."""

    def __init__(self, data: dict[str, Any]) -> None:
        self.entries: list[dict[str, Any]] = data["shared"]
        self.lines: list[dict[str, Any]] = data["apart"]
        self.names = {key(name): entry for entry in self.entries for name in (entry["name"], *entry["aliases"])}
        self.apart = {(owner_label(owner), key(line["rule"])): line for line in self.lines for owner in line["owners"]}
        self.unused = set(self.apart)
        self.wordings: dict[str, str] = {}  # an upgrade_of special -> the wording on its page
        self.kept: dict[str, tuple[str, str, str]] = {}  # a rule kept apart -> its first owner's type, text and gist
        self.log = SharedLog()

    def rule(self, kind: str, owner: str, name: str) -> tuple[str, dict[str, Any]] | None:
        """What an owner's rule of the name is, logged: ("apart", the line keeping it his) or ("shared", the shared
        special); None for a rule of his own."""
        found = (owner, key(name))
        if found in self.apart:
            self.unused.discard(found)
            line = self.apart[found]
            self.log.apart.append((line["name"], kind, owner))
            return "apart", line
        entry = self.names.get(key(name))
        if entry is None:
            return None
        self.log.merged.append((entry["name"], kind, owner, name))
        return "shared", entry

    def sold_by(self, template: str, entry: dict[str, Any], text: str) -> None:
        """The wording of a mutation its template sells, its subject made general."""
        if entry.get("upgrade_of") != template:
            return
        for old, new in (entry.get("subject") or {}).items():
            text = text.replace(old, new).replace(old[0].lower() + old[1:], new[0].lower() + new[1:])
        self.wordings.setdefault(entry["name"], text)

    def scan(self, kind: str, rows: list[dict[str, Any]]) -> None:
        """What each hired sword's, dramatis persona's or beast's rules become (their seeders link them by name)."""
        for row in rows:
            for special in row.get("specials") or []:
                name = special if isinstance(special, str) else special.get("name", "")
                if name:
                    self.rule(OWNER_KINDS[kind], row["name"], name)

    def output(self, injuries: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
        """out/shared-specials.json: each shared special with its wording and aliases, and the rules kept apart that the
        seeders' book lookups name (the templates' are named here). A line naming no owner's rule stops the build."""
        if self.unused:
            missing = [
                f"{owner} has no rule {self.apart[(owner, rule)]['rule']!r}" for owner, rule in sorted(self.unused)
            ]
            raise ValueError(f"shared-specials.json apart: {'; '.join(missing)}")
        psychology = {row["name"]: row for row in injuries if row.get("type") == PSYCHOLOGY}
        specials = [
            {
                "name": entry["name"],
                "type": entry["type"],
                "description": self._wording(entry, psychology),
                "aliases": entry["aliases"],
            }
            for entry in self.entries
        ]
        apart = [
            {"owner": owner_label(owner), "rule": line["rule"], "name": line["name"]}
            for line in self.lines
            for owner in line["owners"]
            if "warband" not in owner
        ]
        return {"specials": specials, "apart": apart}

    def _wording(self, entry: dict[str, Any], psychology: dict[str, dict[str, Any]]) -> str:
        if "text" in entry:
            return str(entry["text"])
        if PSYCHOLOGY in entry:
            found = psychology.get(entry[PSYCHOLOGY])
            if found is None:
                raise ValueError(f"shared-specials.json: the snapshot has no psychology entry {entry[PSYCHOLOGY]!r}")
            rules = [rule for rule in found.get("Rules") or [] if isinstance(rule, dict)]
            texts = [_ITALIC.sub(r"\1", _BOLD.sub(r"\1", clean_rule(rule.get("ruleFull")))) for rule in rules]
            return "\n\n".join(filter(None, [entry.get("first_line", ""), *texts]))
        if entry["name"] not in self.wordings:
            raise ValueError(f"shared-specials.json: {entry.get('upgrade_of')} sells no {entry['name']}")
        return self.wordings[entry["name"]]


def load_shared() -> SharedSpecials:
    return SharedSpecials(load_json(SHARED_DATA))


def _source(entry: dict[str, Any]) -> str:
    if "text" in entry:
        return "the list's text"
    if PSYCHOLOGY in entry:
        return f"the rulebook's {entry[PSYCHOLOGY]} (snapshot)" + (
            ", after a first line" if "first_line" in entry else ""
        )
    subject = "; subject made general" if entry.get("subject") else ""
    return f"{entry['upgrade_of']}'s upgrade{subject}"


def render_shared(shared: SharedSpecials) -> str:
    """The report's Shared specials section: each special, its wording and how many rules link it by owner kind, the
    rules merged into it, and the rules kept apart with William's reasons."""
    kinds = list(OWNER_KINDS.values())
    counts = {(entry["name"], kind): 0 for entry in shared.entries for kind in kinds}
    merged: dict[str, list[str]] = {entry["name"]: [] for entry in shared.entries}
    for name, kind, owner, rule in shared.log.merged:
        counts[(name, kind)] += 1
        merged[name].append(owner if key(rule) == key(name) else f"{owner} ({rule})")
    header = "| Special | Type | Wording | " + " | ".join(kind.capitalize() for kind in kinds) + " |"
    lines = [
        "## Shared specials",
        "",
        "`apps/special/data/shared-specials.json` (William, 5 Nov 2026) as `out/shared-specials.json`: one general"
        " special for each rule below, which every owner's rule of its name or an alias links instead of a copy of its"
        " own (the templates' in `out/warband-templates.json`; the hired swords', dramatis personae's and beasts' by"
        " their seeders, by name). Rules linked, by owner kind:",
        "",
        header,
        "| " + " | ".join("---" for _ in range(3 + len(kinds))) + " |",
    ]
    for entry in shared.entries:
        row = [entry["name"], entry["type"], _source(entry), *(str(counts[(entry["name"], kind)]) for kind in kinds)]
        lines.append("| " + " | ".join(row) + " |")
    lines += ["", "### Merged", ""]
    lines += [f"- {name}: {'; '.join(owners)}." for name, owners in merged.items() if owners]
    lines += ["", "### Kept apart", "", "| Rule | Owners | Why |", "| --- | --- | --- |"]
    owners: dict[str, list[str]] = {}
    for name, _kind, owner in shared.log.apart:
        owners.setdefault(name, []).append(owner)
    for line in shared.lines:
        why = str(line["why"]).replace("|", "\\|")
        lines.append(f"| {line['name']} | {'; '.join(owners.get(line['name'], []))} | {why} |")
    return "\n".join(lines) + "\n"


def build_shared(
    shared: SharedSpecials,
    hired_swords: list[dict[str, Any]],
    personae: list[dict[str, Any]],
    injuries: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """The output, once the templates linked theirs: our hired swords', dramatis personae's and beasts' rules read for
    the report and to check the list's owners."""
    beasts = [row for path in BEASTS for row in load_json(path) if isinstance(row, dict)]
    for kind, rows in (("hired_sword", hired_swords), ("dramatis_persona", personae), ("beast", beasts)):
        shared.scan(kind, rows)
    return shared.output(injuries)
