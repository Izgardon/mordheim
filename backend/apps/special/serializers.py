from rest_framework import serializers

from .models import Special


class SpecialSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)
    campaign_type_id = serializers.IntegerField(read_only=True)  # CAT-NEW-04: always null today

    class Meta:
        model = Special
        fields = ("id", "campaign_id", "campaign_type_id", "name", "type", "description")


class SpecialCreateSerializer(serializers.ModelSerializer):
    """A custom special's create or edit; the campaign is never an input (the view saves the create in its campaign)."""

    class Meta:
        model = Special
        fields = ("name", "type", "description")
