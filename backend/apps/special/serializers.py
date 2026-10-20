from rest_framework import serializers

from .models import Special


class SpecialSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)
    campaign_type_id = serializers.IntegerField(read_only=True)  # CAT-NEW-04: always null today

    class Meta:
        model = Special
        fields = ("id", "campaign_id", "campaign_type_id", "name", "type", "description")


class SpecialCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Special
        fields = ("campaign", "name", "type", "description")
