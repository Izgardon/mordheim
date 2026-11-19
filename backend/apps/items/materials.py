"""Weapon materials (William, 19 Nov 2026): what a weapon is made of, not an item of its own.

Gromril, ithilmar, obsidian and silver were catalogue items, so buying one gave the warband a stash row called
"Gromril Weapon" that was not a weapon and named none of his swords. They are modifiers on a weapon: the copy the
warband owns carries one (`material` on every owned row), its name reads "Gromril Sword", and its price is the
weapon's price through the material (four times it, or 60 gc on top).

The set is closed and will never be added to, so it is hard-coded here (William: "hard-code it"), as the unit kinds
are in `apps/warbands/units/kinds.py`. A material carries its slug, the word that goes in front of the weapon's name,
how it prices (a multiplier or a flat addition: the book needs only those two shapes), its own rarity (the rarity the
purchase rolls, never the weapon's), the book's rules word for word, the setting they come from, what putting it on a
weapon the warband already owns costs (`on_owned`, None: it is chosen when the weapon is bought), and who may not
take it (`excluded_groups`, `excluded_types`: who-can lines, which `warbands/services/materials.py` resolves and
`who_can.py` reads). Weapons only: `Gromril Armour` and `Ithilmar Armour` are real armour with their own prices and
saves, and `Sons of Hashut Obsidian Weapon` is a different rule at a flat price, so all three stay items.

Both price shapes are whole gold, so a material price is never rounded; half of one (a sale) rounds up through
`warbands/services/prices.half_up`, as half of any other price does.
"""

from dataclasses import dataclass

WEAPON = "Weapon"  # the only item type a material goes on
MAX_MATERIAL = 12  # the width of the `material` column on every owned row


@dataclass(frozen=True)
class MaterialRule:
    """One of a material's rules, as the book words it."""

    name: str
    text: str


@dataclass(frozen=True)
class Material:
    """One weapon material. `multiplier` and `addition` are exclusive: the price is the weapon's times the one, or
    the weapon's plus the other."""

    slug: str
    name: str
    rarity: int
    rules: tuple[MaterialRule, ...]
    setting: str
    multiplier: int | None = None
    addition: int | None = None
    on_owned: int | None = None
    excluded_groups: tuple[str, ...] = ()
    excluded_types: tuple[str, ...] = ()

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
    on_owned=80,  # "To silver a weapon the warband already owns, roll the rarity all the same and pay 80 gc in all."
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

MATERIALS: dict[str, Material] = {material.slug: material for material in (GROMRIL, ITHILMAR, OBSIDIAN, SILVER)}
SLUGS: tuple[str, ...] = tuple(MATERIALS)

# The items the four used to be. seed_items skips them, so its own archive writes them off, and the warband
# template seeder drops a list line naming one: a material is not an item (William, 19 Nov 2026).
FAKE_ITEM_NAMES = ("Gromril Weapon", "Ithilmar Weapon", "Obsidian Weapon", "Silver Weapons")


def material_of(slug: str) -> Material | None:
    """The material a slug names, None for a plain copy ("") or an unknown slug."""
    return MATERIALS.get(slug)


def named(slug: str, item_name: str) -> str:
    """The copy's name: "Gromril Sword", or the item's own name for a plain copy."""
    material = material_of(slug)
    return f"{material.name} {item_name}" if material else item_name


def label_of(slug: str) -> str:
    """The word in front of the name ("Gromril"), blank for a plain copy."""
    material = material_of(slug)
    return material.name if material else ""


def priced(slug: str, base: int | None) -> int | None:
    """`base` through the material a slug names; `base` itself for a plain copy, None when no price is known."""
    material = material_of(slug)
    if material is None or base is None:
        return base
    return material.price(base)


def on_owned_only() -> tuple[str, ...]:
    """The materials that can be put on a weapon the warband already owns (silver: the book says so)."""
    return tuple(slug for slug, material in MATERIALS.items() if material.on_owned is not None)
