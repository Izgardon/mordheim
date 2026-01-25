from rest_framework import serializers

from .models import Skill


class SkillSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Skill
        fields = ("id", "campaign_id", "name", "type", "description", "custom")


class SkillCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ("campaign", "name", "type", "description", "custom")
