"""House-rule effects and the common house rules (IMP-69, CAMP-CQ-09).

An effect is what a house rule does to the campaign's items (half-price armour, improved shields: the clones in
services/house_rules.py). `effect_key` takes only these keys, or nothing for a rule that is just text. The common
rules are the ones the House Rules page offers ready-made (`GET rules/common/`); two of them carry an effect.
"""

from dataclasses import asdict, dataclass

from apps.items.services import HALF_PRICE_ARMOUR_EFFECT_KEY, IMPROVED_SHIELDS_EFFECT_KEY


@dataclass(frozen=True)
class Effect:
    key: str
    label: str


EFFECTS: tuple[Effect, ...] = (
    Effect(HALF_PRICE_ARMOUR_EFFECT_KEY, "Half Price Armour"),
    Effect(IMPROVED_SHIELDS_EFFECT_KEY, "Improved Shields"),
)
EFFECT_KEYS: frozenset[str] = frozenset(effect.key for effect in EFFECTS)


@dataclass(frozen=True)
class CommonRule:
    id: str
    title: str
    description: str
    effect_key: str | None = None


COMMON_RULES: tuple[CommonRule, ...] = (
    CommonRule(
        "half-price-armour",
        "Half Price Armour",
        "All items listed under Armour are half price with the exception of Shields and Bucklers.",
        HALF_PRICE_ARMOUR_EFFECT_KEY,
    ),
    CommonRule(
        "improved-shields",
        "Improved Shields",
        "Both Shields and Bucklers offer an improved +1 Sv in combat.",
        IMPROVED_SHIELDS_EFFECT_KEY,
    ),
    CommonRule(
        "two-weapon-fighting",
        "Two-weapon Fighting",
        "Attacks made with a weapon in your off hand are at -1 to hit. Furthermore, off-hand attacks cannot cause "
        "critical hits.",
    ),
    CommonRule(
        "black-powder-improvements",
        "Black Powder Improvements",
        "Black powder weapons have their cost reduced by 33% but will misfire on a roll to hit of 1 (see Misfire "
        "table). Furthermore, all non-pistol and template black powder weaponry gets +1 to their injury rolls.",
    ),
    CommonRule(
        "rout-test-changes",
        "Rout Test Changes",
        "When rolling rout tests, Warband Leaders suffer a -1 to their LD when at or below 50% of their warband "
        "size. This increases to -2 to their LD when at or below 25%.",
    ),
    CommonRule(
        "ranged-weapon-limitations",
        "50% Ranged Limit",
        "Only half of the models in your warband, including hired swords, can be armed with missile weapons with a "
        'range of more than 8".',
    ),
    CommonRule(
        "trinket-item-cap",
        "Trinket Item Cap",
        "Maximum 1 each of Lucky Charm, Rabbit's Foot, Holy/Unholy Relic, and Bear Claw Necklaces in a Warband.",
    ),
    CommonRule(
        "miscasts",
        "Miscasts",
        "Magic is very dangerous! The roll of a double one when casting a spell will result in a miscast – "
        "roll on the miscasts table. You may never re-roll a miscast with any skills or items, however you may use "
        "the Rabbit's Foot to re-roll a single dice when rolling on the miscast table.",
    ),
)


def common_rules() -> list[dict[str, str | None]]:
    """The common rules as the API answers them: id, title, description and effect_key (null for text only)."""
    return [asdict(rule) for rule in COMMON_RULES]
