"""Equipment list lines for warband templates: the item a line names (as the plan matches them: an item named for the
warband first, "Pike (Merchant Caravans)", then the name or a tag, the slug, a loose match), its price, and who may
take it, read from mordheimer's note ("Gaolers only", "Not Questing Knight", "Max 3 per warband")."""

import re
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import loose_key
from catalogue_import.text import clean_inline

MIM_VARIANT = "Mutiny in Marienburg"
TAG = "a tag"  # found by one of its tags: the line names it its own way ("mace" for Club, Mace or Hammer)
_BRACKETED = re.compile(r"^(.*)\s+\((.+)\)$")
_TIMES = re.compile(r"(\d+)\s*(?:x|×|times)\s*(?:the\s*)?(?:cost|price)", re.I)
_PLUS = re.compile(r"^\+\s*(\d+)\s*gc$", re.I)
_LIMIT = re.compile(r"^(?:max(?:imum)?\s+)?(one|\d+)\s+per\s+warband$", re.I)
_BRACE = re.compile(r"^\(?\s*(\d+)\s+for\s+a\s+brace\s*\)?$", re.I)
_ONLY = re.compile(r"^(?:available to\s+)?(?:the\s+)?(.+?)\s+only\.?$", re.I)
_ONLY_FIRST = re.compile(r"^only available to\s+(?:the\s+)?(.+?)\.?$", re.I)
_NOT = re.compile(r"^not\s+(.+)$", re.I)
_MARKERS = re.compile(r"[❓✏️️]")


def plain(text: str | None) -> str:
    """mordheimer's escapes and markers gone: "gromril weapon\\" is "gromril weapon"."""
    return _MARKERS.sub("", clean_inline(text or "")).replace("\\", "").replace("*", "").strip()


class ItemIndex:
    """Our items (out/items.json's entries) by name, tag, slug and loose key. A name or tag several items share
    prefers mordheimer's entry to a MiM one."""

    def __init__(self, items: Iterable[dict[str, Any]]) -> None:
        self.items = list(items)
        self.by_name: dict[str, list[dict[str, Any]]] = {}
        self.by_tag: dict[str, list[dict[str, Any]]] = {}
        self.by_loose: dict[str, list[dict[str, Any]]] = {}
        self.by_slug = {item["slug"]: item for item in self.items if item.get("slug")}
        for item in self.items:
            self.by_name.setdefault(item["name"].lower(), []).append(item)
            self.by_loose.setdefault(loose_key(item["name"]), []).append(item)
            for tag in item.get("tags") or []:
                self.by_tag.setdefault(tag.lower(), []).append(item)
                self.by_loose.setdefault(loose_key(tag), []).append(item)

    @staticmethod
    def _best(found: list[dict[str, Any]]) -> dict[str, Any] | None:
        return min(found, key=lambda item: item.get("variant") == MIM_VARIANT) if found else None

    def named_for(self, name: str, warband: Iterable[str]) -> dict[str, Any] | None:
        """An item named for the warband: "Pike (Merchant Caravans)" for the Merchant Caravans' pike."""
        wanted = {loose_key(part.removeprefix("The ").removeprefix("the ")) for part in warband}
        for item in self.items:
            match = _BRACKETED.match(item["name"])
            if match and loose_key(match.group(1)) == loose_key(name) and loose_key(match.group(2)) in wanted:
                return item
        return None

    def find(self, name: str, warband: Iterable[str] = ()) -> tuple[dict[str, Any] | None, str]:
        """The item a line names, and how it was found ("" for its name, "a tag" for one of its tags)."""
        key = plain(name).lower()
        named = self.named_for(key, warband)
        if named:
            return named, "named for the warband"
        for found, how in (
            (self.by_name.get(key, []), ""),
            (self.by_tag.get(key, []), TAG),
            ([self.by_slug[key]] if key in self.by_slug else [], "its slug"),
            (self.by_loose.get(loose_key(key), []), "a loose match"),
        ):
            best = self._best(found)
            if best:
                return best, how
        return None, ""


@dataclass
class Price:
    cost: int | None
    cost_note: str = ""
    first_free: bool = False
    brace_cost: int | None = None


def line_price(cost: dict[str, Any] | None) -> Price:
    """A line's price: "1st free/2 gc", a brace price, "3 × price" (no cost of its own), "+15 gc" on the item."""
    cost = cost or {}
    words = " ".join(plain(str(cost.get(key) or "")) for key in ("costPrefix", "costMod"))
    base = cost.get("cost")
    price = Price(base if isinstance(base, int) and not isinstance(base, bool) else None)
    price.first_free = words.lower().startswith("1st free")
    price.brace_cost = cost.get("braceCost") if isinstance(cost.get("braceCost"), int) else None
    times, plus = _TIMES.search(words), _PLUS.match(words.strip())
    if times:
        price.cost, price.cost_note = None, f"{times.group(1)} × price"
    elif plus:
        price.cost, price.cost_note = None, f"+{plus.group(1)} gc"
    if cost.get("numD6"):
        price.cost_note = f"+{cost['numD6']}D6"
    return price


@dataclass
class Fighter:
    """What a note's names are matched against: a template fighter's key, kind, names and mordheimer race."""

    key: str
    kind: str
    name: str
    plural: str
    race: str


@dataclass
class Who:
    who: dict[str, Any] = field(default_factory=dict)
    warband_max: int | None = None
    brace_cost: int | None = None
    note: str = ""  # what wasn't read
    read: bool = True


def _fighters_named(part: str, fighters: list[Fighter]) -> list[str]:
    """The fighters a note's name means: by name or plural, a name it ends ("Whipmaster": the Slaaneshi
    Whipmaster), else by race ("Ogres")."""
    key = loose_key(part)
    forms = {key, key.removesuffix("s"), key.removesuffix("es")}
    found = [
        fighter.key
        for fighter in fighters
        if {loose_key(fighter.name), loose_key(fighter.plural)} & forms
        or any(loose_key(fighter.name).endswith(form) for form in forms if len(form) > 3)
        or loose_key(fighter.plural).endswith(key)
    ]
    return found or [fighter.key for fighter in fighters if loose_key(fighter.race) in forms]


def _named(text: str, fighters: list[Fighter]) -> dict[str, Any] | None:
    """`{"heroes": True}` and/or `{"fighters": [...]}` for "Heroes and Corsairs"; None when a name matches nobody."""
    who: dict[str, Any] = {}
    keys: list[str] = []
    for part in re.split(r"\s*(?:,|&|\band\b)\s*", text):
        if not part:
            continue
        if loose_key(part) in ("hero", "heroes"):
            who["heroes"] = True
            continue
        named = _fighters_named(part, fighters)
        if not named:
            return None
        keys += [key for key in named if key not in keys]
    if keys:
        who["fighters"] = keys
    return who


def read_note(note: str | None, fighters: list[Fighter]) -> Who:
    """Who may take a line, its limit per warband or its brace price, from mordheimer's note."""
    text = plain(note).strip()
    inner = text[1:-1].strip() if text.startswith("(") and text.endswith(")") else text
    if not inner:
        return Who()
    if limit := _LIMIT.match(inner):
        return Who(warband_max=1 if limit.group(1).lower() == "one" else int(limit.group(1)))
    if brace := _BRACE.match(inner):
        return Who(brace_cost=int(brace.group(1)))
    if negative := _NOT.match(inner):
        named = _named(negative.group(1), fighters)
        if named and named.get("fighters") and not named.get("heroes"):
            return Who(who={"except": named["fighters"]})
    elif only := _ONLY_FIRST.match(inner) or _ONLY.match(inner):
        named = _named(only.group(1), fighters)
        if named:
            return Who(who=named)
    return Who(note=inner, read=False)
