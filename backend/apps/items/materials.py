"""Weapon materials (William, 19 Nov 2026): what a weapon is made of, not an item of its own.

Gromril, ithilmar, obsidian and silver were catalogue items, so buying one gave the warband a stash row called
"Gromril Weapon" that was not a weapon and named none of his swords. They are modifiers on a weapon: the copy the
warband owns carries one (`material` on every owned row), its name reads "Gromril Sword", and its price is the
weapon's price through the material (four times it, or 60 gc on top).

The set is closed and will never be added to, so it is hard-coded here (William: "hard-code it"), as the unit kinds
are in `apps/warbands/units/kinds.py`. A material carries its slug, the word that goes in front of the weapon's name,
how it prices (a multiplier or a flat addition: the book needs only those two shapes), its own rarity (the rarity the
purchase rolls, never the weapon's), the book's rules word for word, the setting they come from, and who may not
take it (`excluded_groups`, `excluded_types`: who-can lines, which `warbands/services/materials.py` resolves and
`who_can.py` reads). An item is never transformed (William, 20 Nov 2026: "items are never transformed"): a material
is a store row of its own, which picks the weapon it is made into, and a weapon is never made of anything after it
is bought. Silver's own words on silvering a weapon the warband already owns stay as the book has them, for the
player to settle at the table. Weapons only: `Gromril Armour` and `Ithilmar Armour` are real armour with their own prices and
saves, and `Sons of Hashut Obsidian Weapon` is a different rule at a flat price, so all three stay items.

Both price shapes are whole gold, so a material price is never rounded; half of one (a sale) rounds up through
`warbands/services/prices.half_up`, as half of any other price does.
"""

from dataclasses import dataclass
from typing import Any

WEAPON = "Weapon"  # the only item type a material goes on
MAX_MATERIAL = 20  # the width of the `material` column on every owned row
MAX_SHOWN_AS = 160  # the width of the `shown_as` column, as a warband template's list line's


@dataclass(frozen=True)
class MaterialRule:
    """One of a material's rules, as the book words it."""

    name: str
    text: str


@dataclass(frozen=True)
class Material:
    """One weapon material. `multiplier` and `addition` are exclusive: the price is the weapon's times the one, or
    the weapon's plus the other. `prefix` is the word that goes in front of the weapon's name where it isn't the
    material's own name ("Dark Elf Blade" makes a "Dark Elf Sword").

    Who may take it is a who-can list read exactly as a price row's is: `for_everyone` with the types and groups it
    names, included or excluded, and `from_lists` for one that belongs to the warbands whose template list sells it
    (the two darksteels; `warbands/services/materials.py` works out which types those are). `only_names` and
    `only_text` are a rule that names which weapons may be made of it (the Dark Elf Blade's swords and daggers,
    William 20 Nov 2026: "the one just for swords and daggers should only allow those 2"), so the picker offers
    those and nothing else, with the rule's own sentence above them."""

    slug: str
    name: str
    rarity: int
    rules: tuple[MaterialRule, ...]
    setting: str
    multiplier: int | None = None
    addition: int | None = None
    prefix: str = ""
    for_everyone: bool = True
    from_lists: bool = False
    groups: tuple[str, ...] = ()
    types: tuple[str, ...] = ()
    excluded_groups: tuple[str, ...] = ()
    excluded_types: tuple[str, ...] = ()
    only_names: tuple[str, ...] = ()
    only_text: str = ""

    @property
    def word(self) -> str:
        """The word in front of the weapon's name: "Gromril", "Dark Elf"."""
        return self.prefix or self.name

    def allows(self, item: Any) -> bool:
        """Whether its rule allows this weapon, by the item's name and tags; True where it names none."""
        if not self.only_names:
            return True
        words = [str(getattr(item, "name", "") or ""), *(getattr(item, "tags", None) or [])]
        return any(wanted in word.lower() for word in words for wanted in self.only_names)

    def price(self, base: int) -> int:
        """What the weapon costs made of this material, from its own price."""
        if self.multiplier is not None:
            return base * self.multiplier
        return base + (self.addition or 0)

    @property
    def price_note(self) -> str:
        """How it prices, in the book's words ("4 x Price", "+60 gc"): the pages show it, nothing reads it."""
        return f"{self.multiplier} x Price" if self.multiplier is not None else f"+{self.addition} gc"


GROMRIL = Material(
    slug="gromril",
    name="Gromril",
    rarity=11,
    multiplier=4,
    setting="mordheim",
    rules=(
        MaterialRule(
            "Gromril",
            "A gromril weapon has an extra -1 save modifier, and costs four times the price of a normal weapon of "
            "its kind. You may choose which type of hand-to-hand weapon is offered to you as explained in the "
            "Trading section.",
        ),
    ),
)

ITHILMAR = Material(
    slug="ithilmar",
    name="Ithilmar",
    rarity=9,
    multiplier=3,
    setting="mordheim",
    rules=(
        MaterialRule(
            "Ithilmar",
            "An ithilmar weapon gives its user +1 Initiative in hand-to-hand combat, and costs three times the price "
            "of a normal weapon of its kind. You may choose which hand-to-hand weapon is offered to you as explained "
            "in the Trading section.",
        ),
    ),
)

OBSIDIAN = Material(
    slug="obsidian",
    name="Obsidian",
    rarity=12,
    multiplier=4,
    setting="mordheim-1c",
    rules=(
        MaterialRule(
            "Blemished",
            "Although not strictly tainted by Chaos, all artefacts of Obsidian are considered tinged with evil, by "
            "the same darkness associated with their artisans. Obsidian weapons may never be used by Dwarfs, Elves, "
            "Sisters of Sigmar, Witch Hunters or Priests.",
        ),
        MaterialRule(
            "Heavy",
            "Obsidian weapons are so heavy that the warrior using them always strikes last, even when charging.",
        ),
    ),
    excluded_groups=("dwarfs", "elves"),
    excluded_types=("sisters-of-sigmar", "witch-hunters"),
)

SILVER = Material(
    slug="silver",
    name="Silver",
    rarity=11,
    addition=60,
    setting="grade-3",
    rules=(
        MaterialRule(
            "Silvered",
            "A melee weapon covered in silver counts as a normal weapon against anyone but a werewolf. Against a "
            "werewolf each wound causes D3 wounds, and a roll of 4 or more wounds unless less was already needed. A "
            "wound caused by silver may be neither regenerated nor healed during the game.",
        ),
        MaterialRule(
            "Buying it",
            "Any weapon normally available to the warband may be bought already silvered: roll the weapon's rarity "
            "as 11, then roll for the weapon's cost in the normal way, and pay the weapon's cost plus 60 gc. To "
            "silver a weapon the warband already owns, roll the rarity all the same and pay 80 gc in all.",
        ),
    ),
)

# The Druchii's darksteel blade and the Dark Elves' Dark Elf Blade are two materials, not one (William, 20 Nov
# 2026: "i think it might be easier to have both kinds of darksteel separately ... and cost them properly and scope
# them properly"). Both carry the Druchii page's two rules word for word; the Dark Elf Blade also carries William's
# own ruling, which its picker enforces. Each belongs to the warbands whose template list sells it.
CRITICAL_DAMAGE = MaterialRule(
    "Critical Damage",
    "Dark Elf Blades inflict serious damage on their opponents. When rolling on the critical hit chart a Dark Elf "
    "Blade will add +1 to the result.",
)
WICKED_EDGE = MaterialRule(
    "Wicked Edge",
    "Dark Elf Blades are set with sharp protrusions and serrated edges which inflict serious damage on an opponent. "
    "A roll of 2-4 on the injury table is a Stunned result.",
)
SWORDS_AND_DAGGERS = "Only a sword or a dagger may be made with one of these blades."

DARKSTEEL = Material(  # the Druchii's list: "3 x price", and its page allows any close-combat weapon
    slug="darksteel",
    name="Darksteel",
    rarity=9,
    multiplier=3,
    setting="mordheim-1b",
    for_everyone=False,
    from_lists=True,
    rules=(CRITICAL_DAMAGE, WICKED_EDGE),
)

DARK_ELF_BLADE = Material(  # ours, the Dark Elves': +20 gc, Rare 9, swords and daggers only
    slug="dark-elf-blade",
    name="Dark Elf Blade",
    prefix="Dark Elf",
    rarity=9,
    addition=20,
    setting="mordheim-1b",
    for_everyone=False,
    from_lists=True,
    only_names=("sword", "dagger"),
    only_text=SWORDS_AND_DAGGERS,
    rules=(CRITICAL_DAMAGE, WICKED_EDGE, MaterialRule("Swords and daggers only", SWORDS_AND_DAGGERS)),
)

MATERIALS: dict[str, Material] = {
    material.slug: material for material in (GROMRIL, ITHILMAR, OBSIDIAN, SILVER, DARKSTEEL, DARK_ELF_BLADE)
}
SLUGS: tuple[str, ...] = tuple(MATERIALS)

# The items the materials used to be, by the name the import gives each. seed_items skips them, so its own archive
# writes them off, and a warband template's list line naming one names the material instead (a line with no item:
# `warband_templates/services/material_lines.py`), because a material is not an item (William, 19 Nov 2026).
ITEM_NAME_MATERIALS: dict[str, str] = {
    "Gromril Weapon": "gromril",
    "Ithilmar Weapon": "ithilmar",
    "Obsidian Weapon": "obsidian",
    "Silver Weapons": "silver",
    "Dark Elf Blade": "dark-elf-blade",
}
FAKE_ITEM_NAMES: tuple[str, ...] = tuple(ITEM_NAME_MATERIALS)

# A list that names the item one way and the material another: the Druchii's line sells the Dark Elf Blade as a
# "Darksteel blade", which is the Druchii's own material, so its name wins over the item's.
SHOWN_AS_MATERIALS: dict[str, str] = {"Darksteel blade": "darksteel"}


def material_for(item_name: str, shown_as: str = "") -> str:
    """The material a seeded list line names, by the name it shows and then the item it names; "" for a real item."""
    return SHOWN_AS_MATERIALS.get(shown_as) or ITEM_NAME_MATERIALS.get(item_name, "")


# Gromril Armour and Ithilmar Armour count as heavy armour (William, 20 Nov 2026: "gromril and ithilmar count as
# heavy armour so if a unit in a template can get heavy armour they should also be able to get that"), so a warband
# whose own template list sells Heavy Armour may buy them in the store too (`who_can.py` step 4). The store only:
# no list line is added, and no hire kit offers them.
COUNTS_AS_ITEMS: dict[str, tuple[str, ...]] = {"Heavy Armour": ("Gromril Armour", "Ithilmar Armour")}

# A weapon swung, not shot: the only thing a material is made into ("which type of hand-to-hand weapon is offered
# to you"). The store's chips read the same subtypes (`features/items/store/store-items.ts`).
MISSILE_SUBTYPES = frozenset({"ranged", "missile", "blackpowder", "thrown"})


def is_melee(item: Any) -> bool:
    """Whether an item is a melee weapon (its `type` and `subtype`)."""
    type_ = str(getattr(item, "type", "") or "").strip().lower()
    subtype = str(getattr(item, "subtype", "") or "").strip().lower()
    return type_ == WEAPON.lower() and subtype not in MISSILE_SUBTYPES


def material_of(slug: str) -> Material | None:
    """The material a slug names, None for a plain copy ("") or an unknown slug."""
    return MATERIALS.get(slug)


def named(slug: str, item_name: str) -> str:
    """The copy's name: "Gromril Sword", "Dark Elf Sword", or the item's own name for a plain copy."""
    material = material_of(slug)
    return f"{material.word} {item_name}" if material else item_name


def copy_name(slug: str, shown_as: str, item_name: str) -> str:
    """What a copy of an item reads as: its material in front of the name it was given (`shown_as`, the nickname the
    list that gave it uses for the item, as a warband template's list line does: the Runesmith Journeyman's kit calls
    our Club, Mace or Hammer a "Hammer", so his copy reads "Gromril Hammer"), else the item's own name."""
    return named(slug, shown_as or item_name)


def label_of(slug: str) -> str:
    """The word in front of the name ("Gromril", "Dark Elf"), blank for a plain copy."""
    material = material_of(slug)
    return material.word if material else ""


def priced(slug: str, base: int | None) -> int | None:
    """`base` through the material a slug names; `base` itself for a plain copy, None when no price is known."""
    material = material_of(slug)
    if material is None or base is None:
        return base
    return material.price(base)
