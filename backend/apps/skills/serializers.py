from rest_framework import serializers

from .models import Skill


class SkillSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)
    campaign_type_id = serializers.IntegerField(read_only=True)  # CAT-NEW-04: always null today

    class Meta:
        model = Skill
        fields = ("id", "campaign_id", "campaign_type_id", "name", "type", "description")


class SkillCreateSerializer(serializers.ModelSerializer):
    """A custom skill's create or edit; the campaign is never an input (the view saves the create in its campaign)."""

    class Meta:
        model = Skill
        fields = ("name", "type", "description")
        extra_kwargs = {"description": {"allow_blank": False}}
