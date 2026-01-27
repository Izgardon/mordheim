from django.db import models
from rest_framework import serializers

from apps.warbands.models import (
    HenchmenGroup,
    Hero,
    HiredSword,
    Warband,
    WarbandLog,
    WarbandResource,
)
from .heroes import HeroSummarySerializer


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


class WarbandSummarySerializer(serializers.ModelSerializer):
    heroes = HeroSummarySerializer(many=True, read_only=True)

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
            "heroes",
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
