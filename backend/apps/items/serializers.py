from typing import Any

from rest_framework import serializers
from rest_framework.fields import Field

from apps.core.catalogue.scope import CatalogueIdsField
from apps.restrictions.models import Restriction
from apps.restrictions.serializers import RestrictionNoteSerializer, refuse_unknown_restrictions

from .models import ANIMAL, Item, ItemAvailability, ItemAvailabilityRestriction, ItemProperty

MAX_COST = 2_147_483_647  # the largest cost the column holds
WEAPON_DEFAULTS = {"strength": "As user", "range": "Close combat"}


def with_save(fields: dict[str, Field]) -> dict[str, Field]:
    """`fields` with the item's "save" after its "range" (IMP-85). The column is `save_value`; declared in the class
    body, a field named `save` reads as if it replaced Serializer.save() (it only works because DRF's metaclass pops
    declared fields off the class, CAT-CQ-09)."""
    ordered: dict[str, Field] = {}
    for name, field in fields.items():
        ordered[name] = field
        if name == "range":
            ordered["save"] = serializers.CharField(source="save_value", allow_null=True, required=False)
    return ordered


class ItemPropertySummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemProperty
        fields = (
            "id",
            "name",
            "type",
        )


class RestrictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restriction
        fields = (
            "id",
            "type",
            "restriction",
        )


class ItemAvailabilityRestrictionSerializer(serializers.ModelSerializer):
    restriction = RestrictionSerializer(read_only=True)
    additional_note = serializers.CharField(read_only=True)

    class Meta:
        model = ItemAvailabilityRestriction
        fields = (
            "restriction",
            "additional_note",
        )


class ItemAvailabilitySerializer(serializers.ModelSerializer):
    restrictions = ItemAvailabilityRestrictionSerializer(source="restriction_links", many=True, read_only=True)

    class Meta:
        model = ItemAvailability
        fields = (
            "id",
            "cost",
            "rarity",
            "restrictions",
            "variable_cost",
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
    campaign_type_id = serializers.IntegerField(read_only=True)  # CAT-NEW-04: always null today
    properties = serializers.SerializerMethodField()
    availabilities = ItemAvailabilitySerializer(many=True, read_only=True)
    bestiary_entry = ItemBestiaryEntrySummarySerializer(read_only=True)

    class Meta:
        model = Item
        fields = (
            "id",
            "campaign_id",
            "campaign_type_id",
            "name",
            "type",
            "subtype",
            "grade",
            "single_use",
            "description",
            "strength",
            "range",
            "statblock",
            "properties",
            "availabilities",
            "listed",  # the shop sells it (an Animal item: its beast is sold)
            "bestiary_entry",
            "generated_effect_key",  # set on a house rule's clone, which can't be edited or deleted (BUG-51)
        )

    def get_fields(self) -> dict[str, Field]:
        return with_save(super().get_fields())

    def get_properties(self, obj):
        links = getattr(obj, "property_links", None)
        if not links:
            return []
        properties = [link.property for link in links.all() if link.property]
        return ItemPropertySummarySerializer(properties, many=True).data


class AvailabilityInputSerializer(serializers.Serializer):
    """One price of a custom item: what ItemAvailability allows, checked before anything is written (BUG-53)."""

    cost = serializers.IntegerField(min_value=0, max_value=MAX_COST, default=0)
    rarity = serializers.IntegerField(min_value=2, max_value=20, default=2)
    variable_cost = serializers.CharField(max_length=120, allow_blank=True, allow_null=True, required=False)
    restrictions = RestrictionNoteSerializer(many=True, required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        # a PATCH's availabilities are whole rows: the defaults apply there too (DRF skips them in a partial write)
        return {"cost": 0, "rarity": 2, "restrictions": [], **attrs}


class ItemWriteSerializer(serializers.ModelSerializer):
    """A custom item's create or edit. Linked ids are the book's or this campaign's (`context["campaign_id"]`,
    SEC-07); the campaign itself is never an input. An Animal item is never written here: the bestiary writes each
    beast's (the items routes refuse one, `ANIMAL_ITEM`)."""

    property_ids = CatalogueIdsField(rows=ItemProperty.objects.all(), required=False)
    availabilities = AvailabilityInputSerializer(many=True, required=False)

    class Meta:
        model = Item
        validators: list = []  # a taken name is the name rule's 400 name_taken (CAT-TWEAK-02), backed by the constraint
        fields = (
            "name",
            "type",
            "subtype",
            "grade",
            "single_use",
            "description",
            "strength",
            "range",
            "statblock",
            "property_ids",
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

    def validate_availabilities(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        links = [link for row in rows for link in row.get("restrictions", [])]
        refuse_unknown_restrictions(links, self.context["campaign_id"])
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


class ItemPropertySerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = ItemProperty
        fields = (
            "id",
            "campaign_id",
            "name",
            "description",
            "type",
        )
