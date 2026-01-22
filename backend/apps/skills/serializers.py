from rest_framework import serializers

from .models import Skill


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ("id", "name", "type", "description", "custom")


class SkillCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ("name", "type", "description", "custom")
