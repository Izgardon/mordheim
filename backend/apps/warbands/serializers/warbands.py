from django.db import models
from rest_framework import serializers

from apps.warbands.models import (
    HenchmenGroup,
    Hero,
    HiredSword,
    Warband,
    WarbandItem,
    WarbandLog,
    WarbandResource,
    WarbandTrade,
)

HEX_COLOR_REGEX = r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$"

_EXPENSE_ACTIONS = {
    "buy", "bought", "recruit", "recruited", "hired", "hire", "upkeep", "trade sent",
}


class WarbandSerializer(serializers.ModelSerializer):
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
            "dice_color",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "campaign_id",
            "user_id",
            "created_at",
            "updated_at",
        )


class WarbandUnitSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField(allow_null=True, required=False)
    unit_type = serializers.CharField(allow_null=True, required=False)


class WarbandSummarySerializer(serializers.ModelSerializer):
    resources = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    gold = serializers.SerializerMethodField()
    heroes = serializers.SerializerMethodField()
    hired_swords = serializers.SerializerMethodField()
    henchmen_groups = serializers.SerializerMethodField()

    def get_gold(self, obj):
        total = 0
        for trade in obj.trades.all():
            price = trade.price or 0
            action = (trade.action or "").strip().lower()
            if action in _EXPENSE_ACTIONS:
                total -= abs(price)
            else:
                total += abs(price)
        return max(total, 0)

    def get_resources(self, obj):
        resources = getattr(obj, "resources", None)
        if resources is None:
            return []
        return WarbandResourceSerializer(resources.all(), many=True).data

    def get_rating(self, obj):
        def _as_number(value):
            if value is None:
                return 0
            try:
                return float(value)
            except (TypeError, ValueError):
                return 0

        hero_rows = Hero.objects.filter(warband=obj).values("xp", "large")
        hero_rating = sum(
            ((20 if row["large"] else 5) + _as_number(row["xp"])) for row in hero_rows
        )

        group_rows = (
            HenchmenGroup.objects.filter(warband=obj)
            .annotate(henchmen_count=models.Count("henchmen"))
            .values("xp", "large", "henchmen_count")
        )
        henchmen_rating = sum(
            (row["henchmen_count"] or 0)
            * ((20 if row["large"] else 5) + _as_number(row["xp"]))
            for row in group_rows
        )

        hired_rows = HiredSword.objects.filter(warband=obj).values("rating", "xp")
        hired_rating = sum(
            (_as_number(row["rating"]) + _as_number(row["xp"])) for row in hired_rows
        )

        return hero_rating + henchmen_rating + hired_rating

    def get_heroes(self, obj):
        heroes = (
            Hero.objects.filter(warband=obj)
            .only("id", "name", "unit_type")
            .order_by("id")
        )
        return WarbandUnitSummarySerializer(heroes, many=True).data

    def get_hired_swords(self, obj):
        hired_swords = (
            HiredSword.objects.filter(warband=obj)
            .only("id", "name", "unit_type")
            .order_by("id")
        )
        return WarbandUnitSummarySerializer(hired_swords, many=True).data

    def get_henchmen_groups(self, obj):
        groups = (
            HenchmenGroup.objects.filter(warband=obj)
            .only("id", "name", "unit_type")
            .order_by("id")
        )
        return WarbandUnitSummarySerializer(groups, many=True).data

    class Meta:
        model = Warband
        fields = (
            "resources",
            "rating",
            "gold",
            "heroes",
            "hired_swords",
            "henchmen_groups",
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
    dice_color = serializers.RegexField(regex=HEX_COLOR_REGEX, required=False)

    class Meta:
        model = Warband
        fields = (
            "name",
            "faction",
            "wins",
            "losses",
            "backstory",
            "max_units",
            "dice_color",
        )

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


class WarbandLogCreateSerializer(serializers.Serializer):
    feature = serializers.CharField(max_length=80, required=False, allow_blank=True)
    entry_type = serializers.CharField(max_length=80, required=False, allow_blank=True)
    payload = serializers.JSONField(required=False)

    def validate_feature(self, value):
        return str(value).strip()

    def validate_entry_type(self, value):
        return str(value).strip()

    def validate_payload(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Payload must be an object.")
        return value


class WarbandItemSummarySerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="item.id")
    name = serializers.CharField(source="item.name")
    cost = serializers.IntegerField(source="item.cost", allow_null=True)

    class Meta:
        model = WarbandItem
        fields = ("id", "name", "cost", "quantity")


class WarbandTradeSerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = WarbandTrade
        fields = (
            "id",
            "warband_id",
            "action",
            "description",
            "price",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class WarbandTradeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WarbandTrade
        fields = ("action", "description", "price", "notes")

    def validate_action(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError("Action is required")
        return cleaned

    def validate_description(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError("Description is required")
        return cleaned

    def validate_price(self, value):
        if value is None:
            return 0
        if value < 0:
            raise serializers.ValidationError("Gold coins cannot be negative")
        return value
