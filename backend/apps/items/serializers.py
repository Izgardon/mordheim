from rest_framework import serializers

from .models import Item


class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = ("id", "name", "type", "cost", "availability", "unique_to", "custom")


class ItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = ("name", "type", "cost", "availability", "unique_to", "custom")
