from rest_framework import serializers

from .models import Spell


class SpellSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)
    setting_id = serializers.IntegerField(source="campaign_type_id", read_only=True)  # null: Mordheim (in_play.py)

    class Meta:
        model = Spell
        fields = ("id", "campaign_id", "setting_id", "name", "type", "description", "dc", "roll")


class SpellCreateSerializer(serializers.ModelSerializer):
    """A custom spell's create or edit; the campaign is never an input (the view saves the create in its campaign)."""

    class Meta:
        model = Spell
        fields = ("name", "type", "description", "dc", "roll")
