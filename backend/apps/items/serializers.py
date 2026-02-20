from rest_framework import serializers

from apps.restrictions.models import Restriction

from .models import Item, ItemAvailability, ItemAvailabilityRestriction, ItemProperty


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
    restrictions = ItemAvailabilityRestrictionSerializer(
        source="restriction_links", many=True, read_only=True
    )

    class Meta:
        model = ItemAvailability
        fields = (
            "id",
            "cost",
            "rarity",
            "restrictions",
            "variable_cost",
        )


class ItemSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)
    save = serializers.CharField(source="save_value", allow_null=True, required=False)
    properties = serializers.SerializerMethodField()
    availabilities = ItemAvailabilitySerializer(many=True, read_only=True)

    class Meta:
        model = Item
        fields = (
            "id",
            "campaign_id",
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
        )

    def get_properties(self, obj):
        links = getattr(obj, "property_links", None)
        if not links:
            return []
        properties = [link.property for link in links.all() if link.property]
        return ItemPropertySummarySerializer(properties, many=True).data


class ItemCreateSerializer(serializers.ModelSerializer):
    save = serializers.CharField(source="save_value", allow_null=True, required=False)
    property_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )
    availabilities = serializers.ListField(
        child=serializers.DictField(), required=False, write_only=True
    )

    class Meta:
        model = Item
        fields = (
            "campaign",
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
        )

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
