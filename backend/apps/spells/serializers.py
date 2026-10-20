from rest_framework import serializers

from .models import Spell


class SpellSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)
    campaign_type_id = serializers.IntegerField(read_only=True)  # CAT-NEW-04: always null today

    class Meta:
        model = Spell
        fields = ("id", "campaign_id", "campaign_type_id", "name", "type", "description", "dc", "roll")


class SpellCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Spell
        fields = ("campaign", "name", "type", "description", "dc", "roll")
