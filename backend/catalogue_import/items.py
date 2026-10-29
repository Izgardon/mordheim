"""mordheimer's items in the plan's shape: identity, text, rules in order and price rows."""

from dataclasses import dataclass, field
from typing import Any

from catalogue_import.availability import Context, mordheimer_rows
from catalogue_import.common import unique
from catalogue_import.grading import content_setting
from catalogue_import.rules import link_rule, parse_rule
from catalogue_import.text import clean_inline

MORDHEIMER = "https://mordheimer.net"
TYPES = {
    "melee": ("Weapon", "Melee"),
    "missile": ("Weapon", "Ranged"),
    "blackpowder": ("Weapon", "Blackpowder"),
    "armour": ("Armour", ""),
    "misc": ("Miscellaneous", ""),
    "animal": ("Animal", ""),
}
STAT_KEYS = ("profile", "m", "ws", "bs", "s", "t", "w", "i", "a", "ld")


@dataclass
class ItemLog:
    """What the report needs from the item pass."""

    hidden: list[str] = field(default_factory=list)
    shortened: list[tuple[str, str, str]] = field(default_factory=list)


def short_stat(value: object, item: str, field_name: str, log: ItemLog) -> str:
    """Range, strength and save hold short values; a condition ("when charging on horseback") belongs in the rules."""
    text = clean_inline(value) if isinstance(value, str) else ""
    short = text.split(" when ")[0].strip()
    if short != text:
        log.shortened.append((item, field_name, text))
    return short


def statblock(rows: object) -> list[dict[str, str]]:
    if not isinstance(rows, list):
        return []
    return [{key: clean_inline(str(row.get(key, ""))) for key in STAT_KEYS} for row in rows if isinstance(row, dict)]


def _tags(item: dict[str, Any]) -> list[str]:
    tags = [clean_inline(tag).lower() for tag in item.get("tags") or [] if isinstance(tag, str)]
    return unique([tag for tag in tags if tag])


def mordheimer_item(
    item: dict[str, Any], index: dict[str, dict[str, Any]], ctx: Context, log: ItemLog
) -> dict[str, Any]:
    name = item["name"]
    kind, subtype = TYPES.get(item.get("type", ""), ("Miscellaneous", ""))
    return {
        "slug": "",
        "name": name,
        "variant": "",
        "origin": "mordheimer",
        "type": kind,
        "subtype": clean_inline(item.get("group")) or subtype,
        "setting": content_setting(item.get("campaignSetting"), item.get("grade")),
        "source": clean_inline(item.get("source")),
        "link_url": MORDHEIMER + item["link"] if item.get("link") else "",
        "tags": _tags(item),
        "flavour": clean_inline(item.get("flavour")),
        "range": short_stat(item.get("range"), name, "range", log),
        "strength": short_stat(item.get("strength"), name, "strength", log),
        "save": short_stat(item.get("save"), name, "save", log),
        "statblock": statblock(item.get("statblock")),
        "notes": clean_inline(item.get("admonitions")),
        "needs_rules": False,
        "rules": [link_rule(parse_rule(entry, name), index) for entry in item.get("specialRules") or []],
        "availabilities": mordheimer_rows(item, ctx),
    }


def mordheimer_items(
    items: list[dict[str, Any]], keep_hidden: list[str], index: dict[str, dict[str, Any]], ctx: Context, log: ItemLog
) -> list[dict[str, Any]]:
    """Every mordheimer item except the ones it hides (Club, Mace, Hammer, Staff: aliases of "Club, Mace or Hammer")."""
    converted = []
    for item in items:
        if item.get("hideFromContent") and item["name"] not in keep_hidden:
            log.hidden.append(item["name"])
            continue
        converted.append(mordheimer_item(item, index, ctx, log))
    return converted
