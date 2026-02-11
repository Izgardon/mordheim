from rest_framework import serializers

from .models import Special


class SpecialSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Special
        fields = ("id", "campaign_id", "name", "type", "description")


class SpecialCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Special
        fields = ("campaign", "name", "type", "description")
