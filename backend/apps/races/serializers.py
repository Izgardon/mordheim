from rest_framework import serializers

from .models import Race


class RaceSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)
    campaign_type_id = serializers.IntegerField(read_only=True)  # CAT-NEW-04: always null today

    class Meta:
        model = Race
        fields = (
            "id",
            "campaign_id",
            "campaign_type_id",
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
    """A race's create or edit; the campaign is never an input (BUG-147: an edit could move a race to another
    campaign, or into the book every campaign lists)."""

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
