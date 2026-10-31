"""Item payloads and writes (the items rebuild): the item, its rules in order (shared or its own, with D6 tables)
and its price rows with who may buy each. The catalogue's rows and details add the badge fields
(apps/core/catalogue/rows.py)."""

from typing import Any

from django.db.models import Q
from rest_framework import serializers
from rest_framework.fields import Field

from apps.warbands.access_lines import (
    AccessLineInputSerializer,
    AccessLineSerializer,
    refuse_unknown_lines,
    unique_lines,
)

from .models import ANIMAL, Item, ItemAvailability, ItemRule, ItemRuleLink

MAX_COST = 2_147_483_647  # the largest cost the column holds
WEAPON_DEFAULTS = {"strength": "As user", "range": "Close combat"}
MAX_TABLE_ROWS = 36


def with_save(fields: dict[str, Field]) -> dict[str, Field]:
    """`fields` with the item's "save" after its "range" (IMP-85). The column is `save_value`; declared in the class
    body, a field named `save` reads as if it replaced Serializer.save() (it only works because DRF's metaclass pops
    declared fields off the class, CAT-CQ-09)."""
    ordered: dict[str, Field] = {}
    for name, field in fields.items():
        ordered[name] = field
        if name == "range":
            ordered["save"] = serializers.CharField(
                source="save_value", allow_null=True, allow_blank=True, required=False, max_length=80
            )
    return ordered


class ItemRuleSerializer(serializers.ModelSerializer):
    """A shared rule (the book's, or one a campaign added)."""

    campaign_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = ItemRule
        fields = ("id", "campaign_id", "name", "summary", "text")


class ItemRuleLinkSerializer(serializers.Serializer):
    """One of an item's rules as it reads: a shared rule's name, summary and text unless the item words them its own
    way (`shared`), or a rule only this item has; with its D6 tables."""

    id = serializers.IntegerField()
    rule_id = serializers.IntegerField(allow_null=True)
    shared = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()
    text = serializers.SerializerMethodField()
    table = serializers.JSONField()

    def get_shared(self, link: ItemRuleLink) -> bool:
        return link.rule_id is not None

    def _own(self, link: ItemRuleLink, field: str) -> str:
        value: str = getattr(link, field)
        if value or link.rule is None:
            return value
        shared: str = getattr(link.rule, field)
        return shared

    def get_name(self, link: ItemRuleLink) -> str:
        return self._own(link, "name")

    def get_summary(self, link: ItemRuleLink) -> str:
        return self._own(link, "summary")

    def get_text(self, link: ItemRuleLink) -> str:
        return self._own(link, "text")


class ItemAvailabilitySerializer(serializers.ModelSerializer):
    """A price row and who may buy it: `for_everyone` (minus the excluded lines), or the lines it names."""

    warbands = AccessLineSerializer(source="warband_links", many=True, read_only=True)

    class Meta:
        model = ItemAvailability
        fields = (
            "id",
            "label",
            "cost",
            "dice",
            "dice_multiplier",
            "cost_note",
            "rarity",
            "for_everyone",
            "warbands",
            "note",
        )


class BestiaryEntrySpecialSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    description = serializers.CharField()


class ItemBestiaryEntrySummarySerializer(serializers.Serializer):
    """An Animal item's beast: its kind and its profile (`has_profile` off: no stat line to show)."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    kind = serializers.CharField()
    has_profile = serializers.BooleanField()
    movement = serializers.IntegerField()
    weapon_skill = serializers.IntegerField()
    ballistic_skill = serializers.IntegerField()
    strength = serializers.IntegerField()
    toughness = serializers.IntegerField()
    wounds = serializers.IntegerField()
    initiative = serializers.IntegerField()
    attacks = serializers.IntegerField()
    leadership = serializers.IntegerField()
    armour_save = serializers.CharField()
    specials = BestiaryEntrySpecialSummarySerializer(many=True, read_only=True)


class ItemSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)
    setting_id = serializers.IntegerField(source="campaign_type_id", read_only=True)  # null: a campaign's own
    rules = ItemRuleLinkSerializer(source="rule_links", many=True, read_only=True)
    availabilities = ItemAvailabilitySerializer(many=True, read_only=True)
    bestiary_entry = ItemBestiaryEntrySummarySerializer(read_only=True)

    class Meta:
        model = Item
        fields = (
            "id",
            "campaign_id",
            "setting_id",
            "name",
            "variant",
            "type",
            "subtype",
            "single_use",
            "flavour",
            "strength",
            "range",
            "statblock",
            "source",
            "link_url",
            "tags",
            "notes",
            "rules",
            "availabilities",
            "listed",  # the shop sells it (an Animal item: its beast is sold)
            "bestiary_entry",
            "generated_effect_key",  # set on a house rule's clone, which can't be edited or deleted (BUG-51)
        )

    def get_fields(self) -> dict[str, Field]:
        return with_save(super().get_fields())


class TableSerializer(serializers.Serializer):
    """A D6 table: its column headings ("D6", "Result") and its rows, the roll first."""

    columns = serializers.ListField(child=serializers.CharField(max_length=80), max_length=12)
    rows = serializers.ListField(
        child=serializers.ListField(child=serializers.CharField(max_length=1000, allow_blank=True), max_length=12),
        max_length=MAX_TABLE_ROWS,
    )


class RuleLinkInputSerializer(serializers.Serializer):
    """One of an item's rules a write sends: a shared rule's id (its own wording optional), or a rule of its own with
    a name; either with D6 tables."""

    rule_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    name = serializers.CharField(max_length=120, allow_blank=True, required=False, default="")
    summary = serializers.CharField(max_length=1000, allow_blank=True, required=False, default="")
    text = serializers.CharField(max_length=4000, allow_blank=True, required=False, default="")
    table = TableSerializer(many=True, required=False, default=list)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = {"rule_id": None, "name": "", "summary": "", "text": "", "table": [], **attrs}
        if attrs["rule_id"] is None and not attrs["name"].strip():
            raise serializers.ValidationError({"name": ["A rule of the item's own needs a name."]})
        return attrs


class AvailabilityInputSerializer(serializers.Serializer):
    """One price of a custom item, checked before anything is written (BUG-53): cost, dice, rarity (null: Common),
    label, note, and who may buy it."""

    # declared fields are popped off the class by DRF's metaclass, so this shadows Field.label only for mypy
    label = serializers.CharField(max_length=80, allow_blank=True, required=False, default="")  # type: ignore[assignment]
    cost = serializers.IntegerField(min_value=0, max_value=MAX_COST, allow_null=True, required=False, default=0)
    dice = serializers.IntegerField(min_value=1, max_value=20, allow_null=True, required=False, default=None)
    dice_multiplier = serializers.IntegerField(min_value=1, max_value=1000, allow_null=True, required=False)
    cost_note = serializers.CharField(max_length=120, allow_blank=True, required=False, default="")
    rarity = serializers.IntegerField(min_value=2, max_value=20, allow_null=True, required=False, default=None)
    for_everyone = serializers.BooleanField(required=False, default=True)
    note = serializers.CharField(max_length=300, allow_blank=True, required=False, default="")
    warbands = AccessLineInputSerializer(many=True, required=False, default=list)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        # a PATCH's availabilities are whole rows: the defaults apply there too (DRF skips them in a partial write)
        defaults = {"label": "", "cost": 0, "dice": None, "dice_multiplier": None, "cost_note": "", "rarity": None}
        attrs = {**defaults, "for_everyone": True, "note": "", "warbands": [], **attrs}
        if attrs["dice_multiplier"] and not attrs["dice"]:
            raise serializers.ValidationError({"dice_multiplier": ["A multiplier needs dice."]})
        attrs["warbands"] = unique_lines(attrs["warbands"])
        return attrs


class ItemWriteSerializer(serializers.ModelSerializer):
    """A custom item's create or edit. Linked ids (shared rules, warband types) are the book's or this campaign's
    (`context["campaign_id"]`, SEC-07); the campaign itself is never an input. An Animal item is never written here:
    the bestiary writes each beast's (the items routes refuse one, `ANIMAL_ITEM`). A list it sends (rules, prices)
    replaces that list."""

    tags = serializers.ListField(child=serializers.CharField(max_length=80), max_length=20, required=False)
    rules = RuleLinkInputSerializer(many=True, required=False)
    availabilities = AvailabilityInputSerializer(many=True, required=False)

    class Meta:
        model = Item
        validators: list = []  # a taken name is the name rule's 400 name_taken (CAT-TWEAK-02), backed by the constraint
        fields = (
            "name",
            "variant",
            "type",
            "subtype",
            "single_use",
            "flavour",
            "strength",
            "range",
            "statblock",
            "source",
            "link_url",
            "tags",
            "notes",
            "rules",
            "availabilities",
        )

    def get_fields(self) -> dict[str, Field]:
        return with_save(super().get_fields())

    def validate_type(self, value: str) -> str:
        if value.strip().lower() == ANIMAL.lower():
            raise serializers.ValidationError(
                "Animal items come from the bestiary: add the beast there, with its price."
            )
        return value

    def validate_rules(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        ids = {row["rule_id"] for row in rows if row["rule_id"]}
        campaign_id = self.context["campaign_id"]
        scope = Q(campaign__isnull=True) | Q(campaign_id=campaign_id)
        known = set(ItemRule.objects.filter(scope, id__in=ids).values_list("id", flat=True))
        missing = sorted(ids - known)
        if missing:
            raise serializers.ValidationError([f'Invalid pk "{pk}" - object does not exist.' for pk in missing])
        return rows

    def validate_availabilities(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        refuse_unknown_lines([line for row in rows for line in row["warbands"]], self.context["campaign_id"])
        return rows

    def validate(self, attrs):
        """A weapon's strength and range default to "As user" and "Close combat" where the write leaves them empty: sent
        blank, or not sent and not stored (BUG-151: an edit that didn't resend them lost them)."""
        item_type = attrs.get("type") or getattr(self.instance, "type", "")
        if item_type and item_type.lower() == "weapon":
            for field, default in WEAPON_DEFAULTS.items():
                value = attrs[field] if field in attrs else getattr(self.instance, field, None)
                if not value:
                    attrs[field] = default
        return attrs
