from rest_framework import serializers

from .models import Item


class ItemSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Item
        fields = (
            "id",
            "campaign_id",
            "name",
            "type",
            "cost",
            "rarity",
            "unique_to",
            "variable",
            "description",
            "custom",
        )


class ItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = (
            "campaign",
            "name",
            "type",
            "cost",
            "rarity",
            "unique_to",
            "variable",
            "description",
            "custom",
        )
