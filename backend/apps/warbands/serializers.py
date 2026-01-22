from rest_framework import serializers

from apps.items.models import Item
from apps.items.serializers import ItemSerializer
from apps.skills.models import Skill
from apps.skills.serializers import SkillSerializer

from .models import Hero, Warband


class WarbandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warband
        fields = (
            "id",
            "name",
            "faction",
            "campaign_id",
            "user_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "campaign_id",
            "user_id",
            "created_at",
            "updated_at",
        )


class WarbandCreateSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Warband
        fields = ("name", "faction", "campaign_id")

    def validate_name(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError("Name is required")
        return cleaned

    def validate_faction(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError("Faction is required")
        return cleaned


class WarbandUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warband
        fields = ("name", "faction")

    def validate_name(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError("Name is required")
        return cleaned

    def validate_faction(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError("Faction is required")
        return cleaned


class HeroSerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)
    items = ItemSerializer(many=True, read_only=True)
    skills = SkillSerializer(many=True, read_only=True)

    class Meta:
        model = Hero
        fields = (
            "id",
            "warband_id",
            "name",
            "unit_type",
            "race",
            "stats",
            "experience",
            "hire_cost",
            "available_skills",
            "items",
            "skills",
        )


class HeroCreateSerializer(serializers.ModelSerializer):
    item_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    skill_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = Hero
        fields = (
            "name",
            "unit_type",
            "race",
            "stats",
            "experience",
            "hire_cost",
            "available_skills",
            "item_ids",
            "skill_ids",
        )

    def create(self, validated_data):
        item_ids = validated_data.pop("item_ids", [])
        skill_ids = validated_data.pop("skill_ids", [])
        hero = Hero.objects.create(**validated_data)
        if item_ids:
            hero.items.set(Item.objects.filter(id__in=item_ids))
        if skill_ids:
            hero.skills.set(Skill.objects.filter(id__in=skill_ids))
        return hero


class HeroUpdateSerializer(serializers.ModelSerializer):
    item_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    skill_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = Hero
        fields = (
            "name",
            "unit_type",
            "race",
            "stats",
            "experience",
            "hire_cost",
            "available_skills",
            "item_ids",
            "skill_ids",
        )

    def update(self, instance, validated_data):
        item_ids = validated_data.pop("item_ids", None)
        skill_ids = validated_data.pop("skill_ids", None)
        hero = super().update(instance, validated_data)
        if item_ids is not None:
            hero.items.set(Item.objects.filter(id__in=item_ids))
        if skill_ids is not None:
            hero.skills.set(Skill.objects.filter(id__in=skill_ids))
        return hero
