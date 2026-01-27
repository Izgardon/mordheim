from rest_framework import serializers

from .models import Item, ItemProperty


class ItemPropertySummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemProperty
        fields = (
            "id",
            "name",
            "type",
        )


class ItemSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)
    save = serializers.CharField(source="save_value", allow_null=True, required=False)
    properties = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = (
            "id",
            "campaign_id",
            "name",
            "type",
            "subtype",
            "grade",
            "cost",
            "rarity",
            "unique_to",
            "variable",
            "single_use",
            "description",
            "strength",
            "range",
            "save",
            "statblock",
            "properties",
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

    class Meta:
        model = Item
        fields = (
            "campaign",
            "name",
            "type",
            "subtype",
            "grade",
            "cost",
            "rarity",
            "unique_to",
            "variable",
            "single_use",
            "description",
            "strength",
            "range",
            "save",
            "statblock",
            "property_ids",
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
