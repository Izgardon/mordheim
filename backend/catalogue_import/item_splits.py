"""overrides.json "item_splits": a book item William splits into items of their own (26 Nov 2026, of Club, Mace or
Hammer: "Split into 3 items and go through the warband lists that had the original and only give them 1 appropriate
option").

Each new item is the original under its own name and tags (`items`): its price rows, rarity, who may buy it, rules,
setting and everything else are the original's. The original leaves the catalogue, so the seeder archives it as it
does any book item the import drops. The warband templates are read against the items as the books print them
(`as_printed`), so their lines still find the original by any of its names; then every line that sold it sells the one
item chosen for its template (`templates`, else `default`). The name a list gave the line goes when it names any of the
split items ("Hammer/Mace", "Mace/Staff"), since the one item it sells now goes by its own name; a name that names none
stays ("Quarterstaff", "Stone Axe"). A list left holding the chosen item twice under one name keeps one line, the one
its list printed under the chosen name (the Strigoi's Mace at 3 gc, not their Hammer at 5). An item, template or choice
that matches nothing stops the build.
"""

import copy
import re
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import slugify

_PARTS = re.compile(r"\s*(?:/|,|\bor\b)\s*", re.I)
_WORDS = re.compile(r"[a-z]+")


@dataclass
class Choice:
    """What one template's lists sell in place of the original, and what they printed."""

    template: str
    name: str
    item: str
    why: str  # "" where the default stands
    printed: list[str] = field(default_factory=list)  # the names its lines had ("" for the original's own)
    kept_names: list[str] = field(default_factory=list)  # the names that stay on the chosen item
    dropped: list[str] = field(default_factory=list)  # lines collapsed into another line of the same list


@dataclass
class Split:
    original: dict[str, Any]
    copies: list[dict[str, Any]]
    default: str
    templates: dict[str, dict[str, str]]
    why: str
    chosen: list[Choice] = field(default_factory=list)

    @property
    def names(self) -> list[str]:
        return [row["name"] for row in self.copies]


def _singular(word: str) -> str:
    return word.strip().lower().removesuffix("s")


def read_splits(items: list[dict[str, Any]], decisions: dict[str, Any]) -> list[Split]:
    """The splits overrides.json asks for, each checked against our items: the original is one item of ours, and the
    new names are no item's yet."""
    names = {item["name"] for item in items}
    splits = []
    for name, decision in decisions.items():
        found = [item for item in items if item["name"] == name]
        if len(found) != 1:
            raise ValueError(f"overrides.json item_splits: {len(found)} items named {name!r}, not one")
        into = decision["items"]
        taken = sorted(set(into) & names)
        if taken:
            raise ValueError(f"overrides.json item_splits {name!r}: already an item {', '.join(taken)}")
        choices = [decision["default"], *(entry["item"] for entry in decision.get("templates", {}).values())]
        unknown = sorted(set(choices) - set(into))
        if unknown:
            raise ValueError(f"overrides.json item_splits {name!r}: chooses {', '.join(unknown)}, not one it makes")
        original = found[0]
        original["slug"] = slugify(name)  # as the template lines find it by (assign_slugs no longer sees it)
        copies = [
            {**copy.deepcopy(original), "slug": "", "name": new, "tags": list(entry.get("tags", []))}
            for new, entry in into.items()
        ]
        splits.append(
            Split(original, copies, decision["default"], dict(decision.get("templates", {})), decision["why"])
        )
    return splits


def split_rows(rows: list[dict[str, Any]], splits: list[Split]) -> list[dict[str, Any]]:
    """The rows with each split original replaced, where it stood, by its new items."""
    by_id = {id(split.original): split.copies for split in splits}
    return [new for row in rows for new in by_id.get(id(row), [row])]


def as_printed(rows: list[dict[str, Any]], splits: list[Split]) -> list[dict[str, Any]]:
    """The rows with each split's new items back as the one original the books print, where the first stood."""
    first = {id(split.copies[0]): split.original for split in splits}
    rest = {id(row) for split in splits for row in split.copies[1:]}
    return [first.get(id(row), row) for row in rows if id(row) not in rest]


def printed_items(items: list[dict[str, Any]], decisions: dict[str, Any]) -> list[dict[str, Any]]:
    """out/items.json's items as the books print them, each split's new items back as the one original (with all
    their tags) where the first stood: what the PDF pages' lines, which name the original, are checked against."""
    first: dict[int, dict[str, Any]] = {}
    for name, decision in decisions.items():
        rows = [item for item in items if item["name"] in decision["items"]]
        tags = [tag for row in rows for tag in row["tags"]]
        first[id(rows[0])] = {**rows[0], "name": name, "slug": slugify(name), "tags": tags}
    rest = {new for decision in decisions.values() for new in decision["items"]}
    return [first.get(id(item), item) for item in items if id(item) in first or item["name"] not in rest]


def _new_name(printed: str, names: list[str]) -> str:
    """The name a line keeps on the chosen item: none where one of its parts names a split item."""
    parts = {_singular(part) for part in _PARTS.split(printed) if part.strip()}
    return "" if parts & {name.lower() for name in names} else printed


def _names_it(printed: str, item: str) -> bool:
    return item.lower() in {_singular(word) for word in _WORDS.findall(printed.lower())}


def _same_line(line: dict[str, Any]) -> str:
    """What two lines must share to be one line once both sell the same item: all but the price."""
    keep = {key: value for key, value in line.items() if key not in ("cost", "cost_note")}
    return repr(sorted(keep.items(), key=lambda pair: pair[0]))


def _choose_list(lines: list[dict[str, Any]], split: Split, item: str, choice: Choice) -> list[dict[str, Any]]:
    original = split.original
    picked: dict[str, int] = {}  # a line's shape -> the index of the line kept for it
    kept: list[dict[str, Any]] = []
    for line in lines:
        if line["item"] != {"name": original["name"], "variant": original["variant"]}:
            kept.append(line)
            continue
        printed = line["shown_as"]
        choice.printed.append(printed)
        new = {**line, "item": {"name": item, "variant": original["variant"]}, "shown_as": _new_name(printed, split.names)}  # fmt: skip
        if new["shown_as"]:
            choice.kept_names.append(new["shown_as"])
        shape = _same_line(new)
        if shape not in picked:
            picked[shape] = len(kept)
            kept.append({**new, "_printed": printed})
            continue
        held = kept[picked[shape]]
        if _names_it(printed, item) and not _names_it(held["_printed"], item):
            choice.dropped.append(_label(held["_printed"], held, original["name"]))
            kept[picked[shape]] = {**new, "_printed": printed}
        else:
            choice.dropped.append(_label(printed, line, original["name"]))
    return [{key: value for key, value in line.items() if key != "_printed"} for line in kept]


def _label(printed: str, line: dict[str, Any], original: str) -> str:
    cost = f"{line['cost']} gc" if line["cost"] is not None else line["cost_note"]
    return f"{printed or original} {cost}".strip()


def choose_items(templates: list[dict[str, Any]], splits: list[Split]) -> None:
    """Every template line that sells a split original sells its template's one choice instead."""
    slugs = {template["slug"] for template in templates}
    for split in splits:
        unknown = sorted(set(split.templates) - slugs)
        if unknown:
            raise ValueError(f"overrides.json item_splits {split.original['name']!r}: no template {', '.join(unknown)}")
        for template in templates:
            decision = split.templates.get(template["slug"], {})
            item = decision.get("item", split.default)
            choice = Choice(template["slug"], template["name"], item, decision.get("why", ""))
            for entry in template["lists"]:
                entry["lines"] = _choose_list(entry["lines"], split, item, choice)
            if choice.printed:
                split.chosen.append(choice)
            elif decision:
                raise ValueError(f"overrides.json item_splits: {template['slug']} sells no {split.original['name']}")


def _cell(value: str) -> str:
    return value.replace("|", "\\|")


def render_splits(splits: list[Split]) -> str:
    """The report's section: each split's new items, then each template's choice, so William can review them."""
    lines = []
    for split in splits:
        name = split.original["name"]
        counts = {item: sum(choice.item == item for choice in split.chosen) for item in split.names}
        lines += [
            f"## {name}",
            "",
            f"Split into {', '.join(split.names)} (overrides.json `item_splits`): {split.why}",
            "",
            *(f"- {row['name']}: tags {', '.join(row['tags']) or 'none'}" for row in split.copies),
            "",
            f"{len(split.chosen)} templates sold it; each now sells one: "
            + ", ".join(f"{item} {count}" for item, count in counts.items())
            + f". The default is {split.default}; a reason marks each exception.",
            "",
            "| Template | Sells | Why | Its lines printed | Names kept | Lines folded into another |",
            "| --- | --- | --- | --- | --- | --- |",
        ]
        for choice in split.chosen:
            printed = ", ".join(dict.fromkeys(text or name for text in choice.printed))
            row = [choice.name, choice.item, choice.why, printed, ", ".join(dict.fromkeys(choice.kept_names)), ", ".join(choice.dropped)]  # fmt: skip
            lines.append("| " + " | ".join(_cell(value) for value in row) + " |")
        lines.append("")
    return "\n".join(lines)
