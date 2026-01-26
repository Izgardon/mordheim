from django.db import models
from rest_framework import serializers

from apps.items.models import Item
from apps.items.serializers import ItemSerializer
from apps.skills.models import Skill
from apps.skills.serializers import SkillSerializer

from .models import (
    HenchmenGroup,
    Hero,
    HeroItem,
    HiredSword,
    Warband,
    WarbandLog,
    WarbandResource,
)

STAT_FIELDS = (
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


class WarbandSerializer(serializers.ModelSerializer):
    resources = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()

    def get_resources(self, obj):
        resources = getattr(obj, "resources", None)
        if resources is None:
            return []
        return WarbandResourceSerializer(resources.all(), many=True).data

    def get_rating(self, obj):
        hero_rows = Hero.objects.filter(warband=obj).values("xp", "large")
        hero_rating = sum(
            ((20 if row["large"] else 5) + (row["xp"] or 0)) for row in hero_rows
        )

        group_rows = (
            HenchmenGroup.objects.filter(warband=obj)
            .annotate(henchmen_count=models.Count("henchmen"))
            .values("xp", "large", "henchmen_count")
        )
        henchmen_rating = sum(
            (row["henchmen_count"] or 0)
            * ((20 if row["large"] else 5) + (row["xp"] or 0))
            for row in group_rows
        )

        hired_rows = HiredSword.objects.filter(warband=obj).values("rating", "xp")
        hired_rating = sum(
            ((row["rating"] or 0) + (row["xp"] or 0)) for row in hired_rows
        )

        return hero_rating + henchmen_rating + hired_rating

    class Meta:
        model = Warband
        fields = (
            "id",
            "name",
            "faction",
            "campaign_id",
            "user_id",
            "wins",
            "losses",
            "backstory",
            "max_units",
            "rating",
            "resources",
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
        fields = ("name", "faction", "campaign_id", "max_units")

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
        fields = ("name", "faction", "wins", "losses", "backstory", "max_units")

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


class WarbandResourceSerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = WarbandResource
        fields = ("id", "warband_id", "name", "amount")


class WarbandResourceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WarbandResource
        fields = ("name",)

    def validate_name(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError("Resource name is required")
        return cleaned


class WarbandResourceUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WarbandResource
        fields = ("amount",)


class WarbandLogSerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = WarbandLog
        fields = ("id", "warband_id", "feature", "entry_type", "payload", "created_at")


class HeroSerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)
    race_id = serializers.IntegerField(read_only=True)
    race_name = serializers.CharField(source="race.name", read_only=True)
    items = serializers.SerializerMethodField()
    skills = SkillSerializer(many=True, read_only=True)

    def get_items(self, obj):
        if hasattr(obj, "_prefetched_objects_cache") and "hero_items" in obj._prefetched_objects_cache:
            hero_items = obj._prefetched_objects_cache["hero_items"]
        else:
            hero_items = list(obj.hero_items.all())
        return [ItemSerializer(entry.item).data for entry in hero_items if entry.item_id]

    class Meta:
        model = Hero
        fields = (
            "id",
            "warband_id",
            "name",
            "unit_type",
            "race_id",
            "race_name",
            "price",
            "xp",
            "level_up",
            "deeds",
            "armour_save",
            "large",
            "half_rate",
            "dead",
            *STAT_FIELDS,
            "created_at",
            "updated_at",
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
            "price",
            "xp",
            "level_up",
            "deeds",
            "armour_save",
            "large",
            "half_rate",
            "dead",
            *STAT_FIELDS,
            "item_ids",
            "skill_ids",
        )

    def create(self, validated_data):
        item_ids = validated_data.pop("item_ids", [])
        skill_ids = validated_data.pop("skill_ids", [])
        hero = Hero.objects.create(**validated_data)
        if item_ids:
            items_by_id = {
                item.id: item for item in Item.objects.filter(id__in=item_ids)
            }
            HeroItem.objects.bulk_create(
                [
                    HeroItem(hero=hero, item=items_by_id[item_id])
                    for item_id in item_ids
                    if item_id in items_by_id
                ]
            )
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
            "price",
            "xp",
            "level_up",
            "deeds",
            "armour_save",
            "large",
            "half_rate",
            "dead",
            *STAT_FIELDS,
            "item_ids",
            "skill_ids",
        )

    def update(self, instance, validated_data):
        item_ids = validated_data.pop("item_ids", None)
        skill_ids = validated_data.pop("skill_ids", None)
        hero = super().update(instance, validated_data)
        if item_ids is not None:
            hero.hero_items.all().delete()
            items_by_id = {
                item.id: item for item in Item.objects.filter(id__in=item_ids)
            }
            HeroItem.objects.bulk_create(
                [
                    HeroItem(hero=hero, item=items_by_id[item_id])
                    for item_id in item_ids
                    if item_id in items_by_id
                ]
            )
        if skill_ids is not None:
            hero.skills.set(Skill.objects.filter(id__in=skill_ids))
        if hasattr(hero, "_prefetched_objects_cache"):
            hero._prefetched_objects_cache.pop("hero_items", None)
            hero._prefetched_objects_cache.pop("skills", None)
        return hero
