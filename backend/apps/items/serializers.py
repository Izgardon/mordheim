from typing import Any

from rest_framework import serializers

from apps.bestiary.models import BestiaryEntry
from apps.core.catalogue.scope import CatalogueEntryField, CatalogueIdsField
from apps.restrictions.models import Restriction
from apps.restrictions.serializers import RestrictionNoteSerializer, refuse_unknown_restrictions

from .models import Item, ItemAvailability, ItemAvailabilityRestriction, ItemProperty

MAX_COST = 2_147_483_647  # the largest cost the column holds


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
    id = serializers.IntegerField()
    name = serializers.CharField()
    type = serializers.CharField()
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
    save = serializers.CharField(source="save_value", allow_null=True, required=False)  # type: ignore[assignment]
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
            "save",
            "statblock",
            "properties",
            "availabilities",
            "bestiary_entry",
            "generated_effect_key",  # set on a house rule's clone, which can't be edited or deleted (BUG-51)
        )

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


class ItemWriteSerializer(serializers.ModelSerializer):
    """A custom item's create or edit. Linked ids are the book's or this campaign's (`context["campaign_id"]`,
    SEC-07); the campaign itself is never an input."""

    save = serializers.CharField(source="save_value", allow_null=True, required=False)  # type: ignore[assignment]
    property_ids = CatalogueIdsField(rows=ItemProperty.objects.all(), required=False)
    availabilities = AvailabilityInputSerializer(many=True, required=False)
    bestiary_entry_id = CatalogueEntryField(
        queryset=BestiaryEntry.objects.all(), source="bestiary_entry", allow_null=True, required=False
    )  # the animal an Animal item hires (BUG-146: a raw id was a 500)

    class Meta:
        model = Item
        validators: list = []  # a duplicate is the database constraint's 400 duplicate_entry (BUG-17)
        fields = (
            "name",
            "type",
            "subtype",
            "grade",
            "single_use",
            "description",
            "strength",
            "range",
            "save",
            "statblock",
            "property_ids",
            "availabilities",
            "bestiary_entry_id",
        )

    def validate_availabilities(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        links = [link for row in rows for link in row.get("restrictions", [])]
        refuse_unknown_restrictions(links, self.context["campaign_id"])
        return rows

    def validate(self, attrs):
        item_type = attrs.get("type") or getattr(self.instance, "type", "")
        if item_type and item_type.lower() == "weapon":
            strength = attrs.get("strength")
            range_value = attrs.get("range")
            if not strength:
                attrs["strength"] = "As user"
            if not range_value:
                attrs["range"] = "Close combat"
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
