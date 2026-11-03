"""Hire fees and upkeep (the fees and skill lists step): what a hired sword or dramatis persona costs to hire and to
keep, on the catalogue entry and on the warband's copy, as one small JSON object (`Fee`).

- `kind`: `gold` (a fee of gold, dice and resources), `replaces_hero` (free: he takes one of the heroes' places, as
  the Priest of Morr does), `special` (see his rules: hired at 0 gc with a warning) or `none` (no fee: an upkeep of
  "n/a" has no camp row);
- `gold` (null: none in the fee), `dice` and `dice_multiplier` ("70 + 3D6" is 70, 3 and null, as an item's price row;
  the roll is added when hiring);
- `resources`: `{resource, amount}` lines ("1 Wyrdstone", "5 Campaign points"), paid from the warband's counters of
  that name and never below 0 (units/services/fee_payments.py);
- `note`: the rest ("15 gc*", Sigmund's body part).

A resource is named as fees name it. Wyrdstone is paid from the warband's default resource (`WarbandResource.is_default`)
whatever the campaign calls it; the three the book uses also have their usual spellings (`RESOURCE_NAMES`), so a
warband without a default counter pays Wyrdstone from its "Wyrdstone shards". Payloads list each line's `names` and
whether the default resource pays it (`default_resource`), and the pages default the line to that counter (the player
may pick another, add one or not pay it).
"""

from collections.abc import Iterable, Mapping
from typing import Any, TypedDict

from rest_framework import serializers

FEE_KINDS = ("gold", "replaces_hero", "special", "none")
MAX_FEE = 100_000  # gold, and an amount of a resource
MAX_DICE = 20
MAX_RESOURCE_LINES = 6
MAX_NOTE = 500

WYRDSTONE = "Wyrdstone"  # the resource the warband's default counter pays, whatever the campaign calls it
# A resource as fees name it -> every name a warband's counter of it may have (lower case).
RESOURCE_NAMES: Mapping[str, tuple[str, ...]] = {
    WYRDSTONE: ("wyrdstone", "wyrdstones", "wyrdstone shard", "wyrdstone shards", "shard", "shards"),
    "Treasure": ("treasure", "treasures"),
    "Campaign points": ("campaign points", "campaign point", "campaign pts", "cp"),
}


class FeeResource(TypedDict):
    resource: str
    amount: int


class Fee(TypedDict):
    kind: str
    gold: int | None
    dice: int | None
    dice_multiplier: int | None
    resources: list[FeeResource]
    note: str


def make_fee(
    kind: str = "gold",
    gold: int | None = None,
    *,
    dice: int | None = None,
    dice_multiplier: int | None = None,
    resources: Iterable[tuple[str, int]] = (),
    note: str = "",
) -> Fee:
    return {
        "kind": kind,
        "gold": gold,
        "dice": dice,
        "dice_multiplier": dice_multiplier,
        "resources": [{"resource": name, "amount": amount} for name, amount in resources],
        "note": note,
    }


def no_fee() -> Fee:
    """A fee with nothing in it: the models' default."""
    return make_fee()


def _key(name: str) -> str:
    return " ".join(name.lower().split())


def names_of(resource: str) -> tuple[str, ...]:
    """Every name of a warband's counter that pays `resource`: the kind's spellings, or the name itself."""
    key = _key(resource)
    for kind, names in RESOURCE_NAMES.items():
        if key == _key(kind) or key in names:
            return names
    return (key,)


def pays_from_default(resource: str) -> bool:
    """Whether the warband's default resource pays `resource`: Wyrdstone, by any of its spellings."""
    return names_of(resource) == RESOURCE_NAMES[WYRDSTONE]


def match_counter(resource: str, counters: Iterable[Any]) -> Any:
    """The warband's counter (anything with a `name`, and `is_default`) that pays `resource`, or None: the default
    resource for Wyrdstone, else the counter of one of its names."""
    counters = list(counters)
    if pays_from_default(resource):
        default = next((counter for counter in counters if getattr(counter, "is_default", False)), None)
        if default is not None:
            return default
    names = names_of(resource)
    return next((counter for counter in counters if _key(counter.name) in names), None)


def gold_due(fee: Mapping[str, Any], dice_roll: int | None = None) -> int:
    """The gold a fee charges unless a price is given: its gold plus the dice roll times its multiplier. A fee that
    isn't gold (a hero's place, his rules, none) charges nothing."""
    if fee.get("kind") != "gold":
        return 0
    gold = int(fee.get("gold") or 0)
    if dice_roll is not None and fee.get("dice"):
        gold += dice_roll * int(fee.get("dice_multiplier") or 1)
    return gold


def fee_text(fee: Mapping[str, Any]) -> str:
    """The fee in words, for notes and warnings: "70 gc + 3D6", "1 Wyrdstone", "Takes a hero's place"."""
    kind = fee.get("kind")
    if kind == "none":
        return "None"
    if kind == "replaces_hero":
        return "Takes a hero's place"
    if kind == "special":
        return "Special (see the rules)"
    parts = [f"{fee['gold']} gc"] if fee.get("gold") is not None else []
    if fee.get("dice"):
        times = f"x{fee['dice_multiplier']}" if fee.get("dice_multiplier") else ""
        parts.append(f"{fee['dice']}D6{times}")
    parts += [f"{line['amount']} {line['resource']}" for line in fee.get("resources") or []]
    return " + ".join(parts) or "-"


class FeeResourceSerializer(serializers.Serializer):
    resource = serializers.CharField(max_length=60)
    amount = serializers.IntegerField(min_value=0, max_value=MAX_FEE)


class FeeSerializer(serializers.Serializer):
    """A fee as a write sends it; anything it leaves out is empty."""

    kind = serializers.ChoiceField(choices=FEE_KINDS, required=False, default="gold")
    gold = serializers.IntegerField(min_value=0, max_value=MAX_FEE, allow_null=True, required=False, default=None)
    dice = serializers.IntegerField(min_value=1, max_value=MAX_DICE, allow_null=True, required=False, default=None)
    dice_multiplier = serializers.IntegerField(
        min_value=1, max_value=MAX_FEE, allow_null=True, required=False, default=None
    )
    resources = FeeResourceSerializer(many=True, required=False, default=list)
    note = serializers.CharField(max_length=MAX_NOTE, allow_blank=True, required=False, default="")

    def validate_resources(self, lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if len(lines) > MAX_RESOURCE_LINES:
            raise serializers.ValidationError(f"A fee names at most {MAX_RESOURCE_LINES} resources.")
        return lines

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs.get("dice_multiplier") is not None and attrs.get("dice") is None:
            raise serializers.ValidationError({"dice_multiplier": ["A multiplier needs dice."]})
        return attrs


def _stored(data: Mapping[str, Any]) -> Fee:
    lines = [(line["resource"].strip(), line["amount"]) for line in data["resources"]]
    return make_fee(
        data["kind"],
        data["gold"],
        dice=data["dice"],
        dice_multiplier=data["dice_multiplier"],
        resources=lines,
        note=data["note"].strip(),
    )


def clean_fee(value: Any) -> Fee:
    """A fee checked and in its stored shape (every key, trimmed names); ValueError when it isn't one."""
    shape = FeeSerializer(data=value)
    if not isinstance(value, dict) or not shape.is_valid():
        raise ValueError(f"Not a fee: {value!r}")
    return _stored(shape.validated_data)


def fee_payload(fee: Mapping[str, Any] | None) -> dict[str, Any]:
    """A stored fee as payloads show it: every key, and what pays each resource line (its `names`, and whether the
    warband's default resource does: `default_resource`)."""
    stored = {**no_fee(), **(fee or {})}
    lines = [
        {**line, "names": list(names_of(line["resource"])), "default_resource": pays_from_default(line["resource"])}
        for line in stored["resources"]
    ]
    return {**stored, "resources": lines}


class FeeField(serializers.Field):
    """A hire fee or upkeep: written as `FeeSerializer` takes it, answered with each resource's `names`."""

    def to_internal_value(self, data: Any) -> Fee:
        if not isinstance(data, dict):
            raise serializers.ValidationError("A fee is an object: kind, gold, dice, resources and a note.")
        shape = FeeSerializer(data=data)
        shape.is_valid(raise_exception=True)
        return _stored(shape.validated_data)

    def to_representation(self, value: Any) -> dict[str, Any]:
        return fee_payload(value)
