"""Reads mordheimer's free-text availability notes: who may buy ("Goblins only"), who may not ("Not available to
Skaven"), which price applies to whom ("Common for Forest Goblins"), and plain notes ("Heroes only")."""

import re
from dataclasses import dataclass, field
from typing import Any

from catalogue_import.common import norm_name
from catalogue_import.text import clean_inline
from catalogue_import.warbands import ALIASES, Resolver

NOTE_FIELDS = ("caveat", "Caveat", "modelCaveat", "modelcaveat", "rulesCaveat", "availabilitycaveat")

# Short forms the notes use for a warband (a demonym or a nickname).
SHORT_FORMS = {
    "norse": "norse explorers",
    "marauders": "marauders of chaos",
    "beastmen": "beastmen raiders",
    "possessed": "cult of the possessed",
    "battle monks": "battle monks of cathay",
    "bretonnian": "bretonnian knights",
    "carnival of chaos": "carnival of chaos",
}

_PRICE = re.compile(r"^(common|rare\s+(\d+))\s+(for|if)\s+(.+)$", re.I)
_SKINK = re.compile(r",?\s*(\d+)\s*gc and common for skink heroes", re.I)
_EXCLUDE = re.compile(r"^(?:not available to|may not be bought by)\s+(.+)$", re.I)
_EXCLUDE_AFTER = re.compile(r"^(.+?)\s+may not use this item$", re.I)
_ONLY = re.compile(r"^(.+?)\s+only$", re.I)
_SPLIT = re.compile(r",\s*|\s+and\s+|\s+or\s+|\s*&\s*")


@dataclass
class Readings:
    """A phrase read type-first ("Tileans" the warband) and group-first ("Tileans" the four city warbands)."""

    as_types: set[str]
    as_groups: set[str]

    def matches(self, slugs: set[str]) -> bool:
        return slugs in (self.as_types, self.as_groups)


@dataclass
class Statements:
    who: list[tuple[str, Readings]] = field(default_factory=list)
    excluded: list[tuple[str, Readings]] = field(default_factory=list)
    prices: list[tuple[str, int, Readings | None]] = field(default_factory=list)  # (text, rarity 0 = Common, readings)
    skink_cost: int | None = None
    notes: list[str] = field(default_factory=list)


class PhraseReader:
    """Resolves the warband names inside a note, against mordheimer's warband types and the groups."""

    def __init__(self, resolver: Resolver, groups: list[dict[str, Any]]) -> None:
        self.resolver = resolver
        known = resolver.mordheimer
        self.groups = {
            norm_name(group["name"]): {slug for slug in group["members"] if slug in known} for group in groups
        }

    def _type(self, key: str) -> set[str] | None:
        exact = [slug for slug in self.resolver.by_name.get(key, []) if slug in self.resolver.mordheimer]
        if exact:
            return set(exact)
        if key in ALIASES and ALIASES[key][0]:
            return set(ALIASES[key][0])
        if key in SHORT_FORMS:
            return self._type(SHORT_FORMS[key])
        return None

    def part(self, text: str) -> Readings | None:
        key = norm_name(text).removeprefix("the ").strip(" .,")
        for form in (key, key + "s", key + "es", key.removesuffix("s")):
            as_type, as_group = self._type(form), self.groups.get(form)
            if as_type or as_group:
                return Readings(as_type or as_group or set(), as_group or as_type or set())
        return None

    def phrase(self, text: str) -> Readings | None:
        pieces = [re.sub(r"^(and|or)\s+", "", piece.strip(), flags=re.I) for piece in _SPLIT.split(text)]
        readings = [self.part(piece) for piece in pieces if piece]
        if not readings or any(reading is None for reading in readings):
            return None
        found = [reading for reading in readings if reading is not None]
        return Readings(set().union(*(r.as_types for r in found)), set().union(*(r.as_groups for r in found)))

    def strip_owner(self, text: str) -> str | None:
        """A note that names its warband first, "Dark Elves Beastmaster only", keeps the rest: "Beastmaster only"."""
        if "," in text or " and " in text:
            return None
        words = text.split()
        for cut in range(len(words) - 1, 0, -1):
            if self.part(" ".join(words[:cut])) is not None:
                return " ".join(words[cut:])
        return None


def _sentences(item: dict[str, Any]) -> list[str]:
    found = []
    for key in NOTE_FIELDS:
        text = clean_inline(item.get(key)) if isinstance(item.get(key), str) else ""
        for sentence in re.split(r"(?<=[a-z)])\.\s+", text):
            sentence = sentence.strip(" ,.;")
            if sentence:
                found.append(sentence)
    return found


def read_statements(item: dict[str, Any], reader: PhraseReader) -> Statements:
    found = Statements()
    for sentence in _sentences(item):
        skink = _SKINK.search(sentence)
        if skink:
            found.skink_cost = int(skink.group(1))
            sentence = _SKINK.sub("", sentence).strip(" ,")
        _classify(sentence, reader, found)
    return found


def _classify(sentence: str, reader: PhraseReader, found: Statements) -> None:
    price = _PRICE.match(sentence)
    if price:
        rarity = int(price.group(2)) if price.group(2) else 0
        found.prices.append(
            (sentence, rarity, reader.phrase(price.group(4)) if price.group(3).lower() == "for" else None)
        )
        return
    exclude = _EXCLUDE.match(sentence) or _EXCLUDE_AFTER.match(sentence)
    if exclude and (readings := reader.phrase(exclude.group(1))) is not None:
        found.excluded.append((sentence, readings))
        return
    only = _ONLY.match(sentence)
    if only and (readings := reader.phrase(only.group(1))) is not None:
        found.who.append((sentence, readings))
        return
    if not only and (readings := reader.phrase(sentence)) is not None:
        found.who.append((sentence, readings))  # "Kislevite" before a separate "Heroes only"
        return
    if only and (rest := reader.strip_owner(sentence)):
        found.notes.append(rest[0].upper() + rest[1:])
        return
    found.notes.append(sentence)
