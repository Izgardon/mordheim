from rest_framework import serializers

from .models import Special


class SpecialSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)
    setting_id = serializers.IntegerField(source="campaign_type_id", read_only=True)  # null: Mordheim (in_play.py)

    class Meta:
        model = Special
        fields = ("id", "campaign_id", "setting_id", "name", "type", "kind", "category", "owner_kind", "description")


class SpecialCreateSerializer(serializers.ModelSerializer):
    """A custom special's create or edit; the campaign is never an input (the view saves the create in its campaign)."""

    class Meta:
        model = Special
        fields = ("name", "type", "kind", "category", "description")  # left out: a trait, an aura
