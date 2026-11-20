"""A list line that names a weapon material (weapon materials, William 20 Nov 2026).

About twenty templates sell one: the Dwarf lists' "Gromril Weapon" at three times the price, the Elf lists'
ithilmar at twice it, the Chaos Dwarfs' obsidian at a flat 30 gc, the Werewolf hunters' silvered weapons at 60 gc
and the Druchii's darksteel blade at three times it. The line carries the material's slug and no item, and names
the weapon when it is picked: **the other melee weapons on that same equipment list** (William's answer), not every
melee weapon in play as the store's own material row offers.

The price is the line's own terms where it states them (its `cost` for a flat price, else "3 × price" or "+15 gc"
in its `cost_note`), else the material's own shape. The server works every one of them out, as it works out who may
take a line: the pages show them.
"""

import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Any

from apps.items.materials import Material, is_melee, material_of

MULTIPLIER = re.compile(r"(\d+)\s*(?:×|x|\*)\s*price", re.IGNORECASE)
ADDITION = re.compile(r"\+\s*(\d+)\s*gc", re.IGNORECASE)


@dataclass(frozen=True)
class Terms:
    """How a line prices the material: a flat cost, a multiple of the weapon's price, or so much on top."""

    flat: int | None = None
    multiplier: int | None = None
    addition: int | None = None

    def price(self, material: Material, base: int | None) -> int | None:
        """What a weapon of `base` price comes to on these terms; None when the weapon has no price."""
        if self.flat is not None:
            return self.flat
        if base is None:
            return None
        if self.multiplier is not None:
            return base * self.multiplier
        if self.addition is not None:
            return base + self.addition
        return material.price(base)


def line_terms(line: Any) -> Terms:
    """The line's own terms, read from its cost and its cost note; empty terms where it states none."""
    if line.cost is not None:
        return Terms(flat=int(line.cost))
    note = str(line.cost_note or "")
    times = MULTIPLIER.search(note)
    if times:
        return Terms(multiplier=int(times.group(1)))
    plus = ADDITION.search(note)
    if plus:
        return Terms(addition=int(plus.group(1)))
    return Terms()


def line_material(line: Any) -> Material | None:
    """The material a line names, None for an ordinary item line."""
    return material_of(str(line.material or ""))


def weapon_lines(lines: Iterable[Any]) -> list[Any]:
    """The melee weapons a list sells, which a material line on it may be made into: one line per item, the first
    naming it (the Dwarf list sells our Club, Mace or Hammer twice, as a Mace and as a Hammer, and a gromril one of
    it is one choice), named as the item itself is, which is what the copy bought will read."""
    found: dict[int, Any] = {}
    for line in lines:
        if line.item_id and is_melee(line.item):
            found.setdefault(line.item_id, line)
    return list(found.values())


def line_choices(line: Any, lines: Sequence[Any]) -> list[dict[str, Any]]:
    """What a material line offers: each melee weapon on the same list, at the line's price for it."""
    material = line_material(line)
    if material is None:
        return []
    terms = line_terms(line)
    return [
        {
            "line_id": other.pk,
            "item": {
                "id": other.item_id,
                "name": other.item.name,
                "variant": other.item.variant,
                "type": other.item.type,
            },
            "price": terms.price(material, other.cost),
        }
        for other in weapon_lines(lines)
    ]


def price_note(line: Any, material: Material) -> str:
    """How the line prices it, in its own words ("3 × price", "30 gc"), else the material's own shape."""
    if line.cost is not None:
        return f"{line.cost} gc"
    return str(line.cost_note or "") or material.price_note


def line_payload(line: Any, lines: Sequence[Any]) -> dict[str, Any] | None:
    """A material line as the hire screens and the store read it: the material, the word it puts in front of a
    weapon's name, how the line prices it, and the weapons on its list with their prices. None for an item line."""
    material = line_material(line)
    if material is None:
        return None
    return {
        "slug": material.slug,
        "name": material.name,
        "prefix": material.word,
        "rarity": material.rarity,
        "price_note": price_note(line, material),
        "choices": line_choices(line, lines),
    }
