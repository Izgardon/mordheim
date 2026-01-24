from rest_framework import serializers

from .models import Race


class RaceSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Race
        fields = (
            "id",
            "campaign_id",
            "name",
            "movement",
            "weapon_skill",
            "ballistic_skill",
            "strength",
            "toughness",
            "wounds",
            "initiative",
            "attacks",
            "leadership",
        )


class RaceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Race
        fields = (
            "name",
            "movement",
            "weapon_skill",
            "ballistic_skill",
            "strength",
            "toughness",
            "wounds",
            "initiative",
            "attacks",
            "leadership",
        )

    def validate_name(self, value):
        cleaned = str(value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("Name is required.")
        return cleaned
