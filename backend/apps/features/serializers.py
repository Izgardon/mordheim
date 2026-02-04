from rest_framework import serializers

from .models import Feature


class FeatureSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Feature
        fields = ("id", "campaign_id", "name", "type", "description")


class FeatureCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feature
        fields = ("campaign", "name", "type", "description")

