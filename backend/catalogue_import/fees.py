"""Hire fees and upkeep read into structured fees (the fees and skill lists step), the shape the app stores
(`apps/hirelings/fees.py`): `kind` (gold, replaces_hero, special or none), `gold`, `dice` and `dice_multiplier`,
`resources` ({resource, amount}) and a `note` for the rest.

mordheimer writes a fee as a number ("25"), a number and more ("70 +3D6", "90 gc and 5 campaign points", "15 gc*"),
a resource ("1 wyrdstone", "2 treasures"), "Hero" (he takes a hero's place: free), "n/a" (a hire fee in his rules,
an upkeep of none), a blank or words. A footnote's asterisk and words after a fee that reads ("70 gold crowns to hire, ... one
body part") are kept as the note. Anything else is `special` with the text as its note, and the report lists it.
"""

import re
from dataclasses import dataclass
from typing import Any

from catalogue_import.text import clean_inline

# A resource as a fee names it -> its name in the app (apps/hirelings/fees.py: RESOURCE_NAMES).
RESOURCES = {
    "wyrdstone": "Wyrdstone",
    "wyrdstones": "Wyrdstone",
    "wyrdstone shard": "Wyrdstone",
    "wyrdstone shards": "Wyrdstone",
    "shard": "Wyrdstone",
    "shards": "Wyrdstone",
    "piece of wyrdstone": "Wyrdstone",
    "pieces of wyrdstone": "Wyrdstone",
    "treasure": "Treasure",
    "treasures": "Treasure",
    "campaign point": "Campaign points",
    "campaign points": "Campaign points",
}
GOLD = re.compile(r"(\d+)\s*(?:gc|gold crowns?|gold)?(\*?)(?:\s+to hire)?", re.I)
DICE = re.compile(r"(\d*)\s*d6(?:\s*[x×]\s*(\d+))?", re.I)
RESOURCE = re.compile(r"(\d+)\s+(" + "|".join(sorted(map(re.escape, RESOURCES), key=len, reverse=True)) + r")", re.I)
SPLIT = re.compile(r"\s*(?:\+|\band\b)\s*", re.I)
SPECIAL = re.compile(r"^see (?:the |his |her |their )?(?:special )?rules\.?$", re.I)
EMPTY: dict[str, Any] = {
    "kind": "gold",
    "gold": None,
    "dice": None,
    "dice_multiplier": None,
    "resources": [],
    "note": "",
}


@dataclass(frozen=True)
class ReadFee:
    fee: dict[str, Any]
    plain: bool  # a plain number: nothing for the report
    unread: bool  # nothing in it could be read: special, its text the note


def fee(kind: str = "gold", gold: int | None = None, **parts: Any) -> dict[str, Any]:
    return {
        "kind": kind,
        "gold": gold,
        "dice": parts.get("dice"),
        "dice_multiplier": parts.get("dice_multiplier"),
        "resources": parts.get("resources", []),
        "note": parts.get("note", ""),
    }


def _terms(text: str) -> dict[str, Any] | None:
    """A fee of terms joined by "+" or "and": gold (once), D6 (once) and resources; None when a term isn't one."""
    gold: int | None = None
    parts: dict[str, Any] = {"resources": []}
    for term in SPLIT.split(text.strip()):
        if (match := GOLD.fullmatch(term)) and gold is None:
            gold = int(match.group(1))
            if match.group(2):
                parts["note"] = text  # a footnote the source doesn't explain: "15 gc*"
        elif (match := DICE.fullmatch(term)) and "dice" not in parts:
            parts["dice"] = int(match.group(1) or 1)
            parts["dice_multiplier"] = int(match.group(2)) if match.group(2) else None
        elif match := RESOURCE.fullmatch(term):
            parts["resources"].append({"resource": RESOURCES[match.group(2).lower()], "amount": int(match.group(1))})
        else:
            return None
    return fee("gold", gold, **parts)


def read_fee(value: object, *, upkeep: bool) -> ReadFee:
    """A hire fee (or an upkeep, `upkeep`) as a structured fee."""
    text = " ".join(clean_inline(str(value)).split()) if value is not None else ""
    if not text or text in ("-", "—"):
        return ReadFee(fee(), plain=False, unread=False)  # none given: listed, a fee with no gold to fill in
    if text.isdigit():
        return ReadFee(fee("gold", int(text)), plain=True, unread=False)
    lowered = text.lower().rstrip(".")
    if lowered in ("n/a", "na", "none"):
        if upkeep:
            return ReadFee(fee("none"), plain=False, unread=False)
        return ReadFee(fee("special"), plain=False, unread=False)  # his rules say: Bertha, the Truthsayer
    if lowered == "hero":
        return ReadFee(fee("replaces_hero"), plain=False, unread=False)  # free: he takes a hero's place
    if SPECIAL.match(text):
        return ReadFee(fee("special"), plain=False, unread=False)
    whole = _terms(text)
    if whole is not None:
        return ReadFee(whole, plain=False, unread=False)
    head, _sep, rest = text.partition(",")
    first = _terms(head) if rest else None
    if first is not None:  # "70 gold crowns to hire, Sigmund ... may also be hired in the payment of one body part"
        first["note"] = rest.strip()
        return ReadFee(first, plain=False, unread=False)
    return ReadFee(fee("special", note=text), plain=False, unread=True)


def describe(read: ReadFee) -> str:
    """A read fee as the report shows it: "70 gc + 3D6", "1 Wyrdstone", "takes a hero's place", with its note."""
    fee = read.fee
    if fee == EMPTY:
        return "- (no gold given)"
    words = {"none": "none", "replaces_hero": "takes a hero's place", "special": "special (see the rules)"}
    if fee["kind"] in words:
        text = words[fee["kind"]]
    else:
        parts = [f"{fee['gold']} gc"] if fee["gold"] is not None else []
        if fee["dice"]:
            parts.append(f"{fee['dice']}D6" + (f"x{fee['dice_multiplier']}" if fee["dice_multiplier"] else ""))
        parts += [f"{line['amount']} {line['resource']}" for line in fee["resources"]]
        text = " + ".join(parts)
    return f"{text}; note: {fee['note']}" if fee["note"] and not read.unread else text
