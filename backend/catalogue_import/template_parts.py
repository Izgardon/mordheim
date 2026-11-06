"""A warband template's warband rules and equipment lists (the special equipment as one more list, the Pit Fighters'
four plain lists, and a variant's own lines), from a snapshot page."""

import re
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import loose_key, slugify
from catalogue_import.template_answers import (
    PIT_FIGHTER_LISTS,
    PIT_FIGHTERS,
    RULE_TITLES,
    RULE_TYPES,
    SPECIAL_EQUIPMENT_ITEMS,
    STYLE_NOTES,
    STYLES_AFTER,
    VARIANT_LINES,
    VARIANT_ONLY,
)
from catalogue_import.template_lists import TAG, Fighter, ItemIndex, Price, Who, line_price, plain, read_note
from catalogue_import.template_text import clean_rule, clean_title

SPECIAL_LIST = {"key": "special-equipment", "name": "Special equipment"}
_RARITY = re.compile(r"^(?:rare\s*(\d+)|common)\s*", re.I)
NO_PRICE = "No price in the source"


@dataclass
class ListLog:
    unmatched: list[tuple[str, str, str]] = field(default_factory=list)  # page, list, line
    found_by: list[tuple[str, str, str, str]] = field(default_factory=list)  # page, line, item, how
    unread: list[tuple[str, str, str, str]] = field(default_factory=list)  # page, list, line, note
    read: list[tuple[str, str, str]] = field(default_factory=list)  # page, line, note: each note read into fields
    markers: int = 0  # notes that were an errata or FAQ marker only, dropped
    shown_as: int = 0
    headings: list[tuple[str, str]] = field(default_factory=list)  # page, a rule heading matching nothing
    rule_only: list[tuple[str, str, str, str]] = field(
        default_factory=list
    )  # page, heading, title, type: a type's rule
    untitled: list[tuple[str, int]] = field(default_factory=list)
    variant_lines: list[tuple[str, str, str, str]] = field(default_factory=list)  # page, variant, list, line


def _same_name(alias: str, *names: str) -> bool:
    """A list's name for an item that only respells it ("Shortbow", "Javelin", "Ball & chain"), or names one half of
    it ("Throwing Knives" for Throwing Knives/Stars)."""

    def key(name: str) -> str:
        return loose_key(name.replace("&", " and ")).removesuffix("s")

    return any(key(part) == key(alias) for name in names for part in [name, *name.split("/")])


def _shown_as(alias: str, line: str, item: dict[str, Any], how: str) -> str:
    """The list's own name for its item: its alias ("Jambiya"), or the name of a line found by a tag ("Mace" for
    Club, Mace or Hammer); none where it only respells the item's name."""
    named = alias or (line[:1].upper() + line[1:] if how == TAG else "")
    return "" if not named or _same_name(named, item["name"]) else named


def _fighters(page: dict[str, Any]) -> list[Fighter]:
    return [
        Fighter(slugify(row["id"]), row["type"], plain(row["name"]), plain(row.get("plural")), plain(row.get("race")))
        for row in page["fighters"]
    ]


def _line(
    item: dict[str, Any], price: Price, who: Who, shown_as: str = "", variant: str = "", note: str = ""
) -> dict[str, Any]:
    return {
        "item": {"name": item["name"], "variant": item["variant"]},
        "shown_as": shown_as,
        "cost": price.cost,
        "cost_note": price.cost_note,
        "first_free": price.first_free,
        "brace_cost": price.brace_cost or who.brace_cost,
        "who": who.who,
        "warband_max": who.warband_max,
        "note": "; ".join(filter(None, [who.note, note])),
        "variant": variant,
    }


def _lines(
    slug: str, page: dict[str, Any], raw: dict[str, Any], index: ItemIndex, log: ListLog
) -> list[dict[str, Any]]:
    """A mordheimer list's lines: each matched to an item, its price and its note read; unmatched ones are left out."""
    fighters, warband = _fighters(page), [page["name"]]
    lines = []
    for entry in raw["items"]:
        item, how = index.find(entry["name"], warband)
        if item is None:
            log.unmatched.append((slug, plain(raw["title"]), plain(entry["name"])))
            continue
        if how and how != TAG:
            log.found_by.append((slug, plain(entry["name"]), item["name"], how))
        note = (entry.get("cost") or {}).get("costSuffix")
        who = read_note(note, fighters)
        if note and not plain(note):
            log.markers += 1  # an errata or FAQ marker only: the price already carries the fix
        elif note and who.read:
            log.read.append((slug, plain(entry["name"]), plain(note)))
        elif note:
            log.unread.append((slug, plain(raw["title"]), plain(entry["name"]), who.note))
        if entry.get("note"):  # a PDF line's own note: a price for the starting warband only (pdf_warbands.py)
            who.note = "; ".join(filter(None, [who.note, entry["note"]]))
        shown_as = _shown_as(plain(entry.get("alias")), plain(entry["name"]), item, how)
        log.shown_as += bool(shown_as)
        # a PDF line's own note, said with it (the Militant Mootlanders' Magic Acorn: its price before the first battle)
        own_note = plain(entry.get("note") or "")
        lines.append(_line(item, line_price(entry.get("cost")), who, shown_as, note=own_note))
    return lines


def _special_lines(slug: str, page: dict[str, Any], index: ItemIndex, log: ListLog) -> list[dict[str, Any]]:
    """The special equipment as list lines, at the book's price, with who may take each, its limit and the PDF's
    name for its item where it is ours by another (`alias`: the Snotlings' Power Squig, our Familiar)."""
    fighters, warband = _fighters(page), [page["name"]]
    lines = []
    for entry in page.get("specialEquipment") or []:
        title = plain(entry["title"])
        item, how = index.find(SPECIAL_EQUIPMENT_ITEMS.get((slug, title), title), warband)
        if item is None:
            log.unmatched.append((slug, SPECIAL_LIST["name"], title))
            continue
        if how and how != TAG:
            log.found_by.append((slug, title, item["name"], how))
        price = line_price(entry.get("cost"))
        if price.cost == 0 and not price.cost_note:
            price.cost, price.cost_note = None, NO_PRICE
        who = read_note(_RARITY.sub("", plain(entry.get("availability"))), fighters)
        if not who.read:
            log.unread.append((slug, SPECIAL_LIST["name"], title, who.note))
        who.warband_max = entry.get("maxQty") or who.warband_max
        lines.append(_line(item, price, who, _shown_as(plain(entry.get("alias")), title, item, how)))
    return lines


def _pit_fighter_lists(
    page: dict[str, Any], index: ItemIndex, log: ListLog
) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    """William's four plain lists, every item at its usual price, the dagger "1st free" (question 28)."""
    lists: list[dict[str, Any]] = []
    keys: dict[str, list[str]] = {}
    for spec in PIT_FIGHTER_LISTS:
        lines = []
        for name, cost in spec["lines"]:  # type: ignore[attr-defined]
            item, how = index.find(name, [page["name"]])
            if item is None:
                log.unmatched.append((PIT_FIGHTERS, str(spec["name"]), name))
                continue
            price = (
                Price(2, first_free=True)
                if cost == "1st free"
                else Price(cost)
                if isinstance(cost, int)
                else Price(None, cost_note=str(cost))
            )
            lines.append(_line(item, price, Who(), _shown_as("", name, item, how)))
        lists.append({"key": spec["key"], "name": spec["name"], "note": "", "lines": lines})
        for fighter in spec["fighters"]:  # type: ignore[attr-defined]
            keys.setdefault(fighter, []).append(str(spec["key"]))
    return lists, keys


def _variant_lines(
    slug: str, page: dict[str, Any], lists: list[dict[str, Any]], index: ItemIndex, log: ListLog
) -> None:
    """William's lines for one variant (VARIANT_LINES: the Kurgan's bows, the Hung's warhorses), each at the end of
    its list, for that variant only, and the book's lines only one variant may buy (VARIANT_ONLY: the Mercenaries'
    Wolfcloak, Middenheim's)."""
    by_key = {entry["key"]: entry for entry in lists}
    for variant, list_key, name, cost in VARIANT_LINES.get(slug, []):
        item, _how = index.find(name, [page["name"]])
        if item is None or list_key not in by_key:
            log.unmatched.append((slug, list_key, name))
            continue
        by_key[list_key]["lines"].append(_line(item, Price(cost), Who(), variant=variant))
        log.variant_lines.append((slug, variant, by_key[list_key]["name"], f"{item['name']} {cost} gc"))
    for variant, list_key, name in VARIANT_ONLY.get(slug, []):  # a book line one variant only may buy (W11)
        found = [line for line in by_key.get(list_key, {}).get("lines", []) if line["item"]["name"] == name]
        if not found:
            log.unmatched.append((slug, list_key, name))
        for line in found:
            line["variant"] = variant
            log.variant_lines.append((slug, variant, by_key[list_key]["name"], f"{name} {line['cost']} gc"))


def build_lists(
    slug: str, page: dict[str, Any], index: ItemIndex, log: ListLog
) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    """The page's lists, and each fighter's list keys by his name: the special equipment list is every buyer's."""
    if slug == PIT_FIGHTERS:
        lists, keys = _pit_fighter_lists(page, index, log)
    else:
        lists = [
            {
                "key": slugify(raw["id"]),
                "name": plain(raw["title"]),
                "note": clean_rule(raw.get("caveat")),
                "lines": _lines(slug, page, raw, index, log),
            }
            for raw in page["equipmentLists"]
        ]
        keys = {row["name"]: [slugify(key) for key in row.get("equipmentLists") or []] for row in page["fighters"]}
    _variant_lines(slug, page, lists, index, log)
    special = _special_lines(slug, page, index, log)
    if special:
        lists.append({**SPECIAL_LIST, "note": "", "lines": special})
        keys = {name: [*found, SPECIAL_LIST["key"]] if found else found for name, found in keys.items()}
    return lists, keys


def _style_notes(page: dict[str, Any]) -> list[dict[str, str]]:
    """The Pit Fighters' styles as two warband notes, each style with its price and kit, as the book gives them."""
    raw_lists = {raw["id"]: raw for raw in page["equipmentLists"]}
    notes = []
    for list_id, title in STYLE_NOTES:
        lines = [
            f"{plain(entry['name']).capitalize()}, {entry['cost']['cost']} gc: {plain(entry.get('loadout')).replace('; ', ', ')}"
            for entry in raw_lists[list_id]["items"]
        ]
        notes.append({"title": title, "description": "\n".join(lines), "variant": "", "type": ""})
    return notes


def build_rules(slug: str, page: dict[str, Any], variants: list[dict[str, str]], log: ListLog) -> list[dict[str, str]]:
    """The warband rules in the book's order, each for every variant or for its heading's, and for every type or for
    its heading's (the Ostermarkers'); the untitled take William's titles, or their variant's name."""
    headings = {variant["heading"]: variant["key"] for variant in variants}
    types = RULE_TYPES.get(slug, {})
    names = {variant["key"]: variant["name"] for variant in variants}
    rules = []
    for position, raw in enumerate(page.get("specialRules") or []):
        heading = plain(raw.get("heading"))
        variant, rule_type = headings.get(heading, ""), types.get(heading, "")
        if heading and heading not in headings and not rule_type:
            log.headings.append((slug, heading))
        title = clean_title(raw.get("rulename")) or RULE_TITLES.get((slug, position)) or names.get(variant, "")
        if not title:
            log.untitled.append((slug, position))
            title = f"Rule {position + 1}"
        if rule_type:
            log.rule_only.append((slug, heading, title, rule_type))
        description = clean_rule(raw.get("ruleFull"))
        rules.append({"title": title, "description": description, "variant": variant, "type": rule_type})
        if slug == PIT_FIGHTERS and title == STYLES_AFTER:
            rules += _style_notes(page)
    return rules
