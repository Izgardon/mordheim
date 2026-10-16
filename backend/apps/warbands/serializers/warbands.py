from rest_framework import serializers

from apps.restrictions.serializers import RestrictionSerializer
from apps.warbands.models import (
    Warband,
    WarbandItem,
    WarbandLog,
    WarbandResource,
    WarbandTrade,
)
from apps.warbands.restrictions import get_effective_restrictions_for_warband
from apps.warbands.services.summary import WarbandUnits, load_warband_units, warband_gold

HEX_COLOR_REGEX = r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$"


class WarbandSerializer(serializers.ModelSerializer):
    restrictions = serializers.SerializerMethodField()

    def get_restrictions(self, obj):
        return RestrictionSerializer(get_effective_restrictions_for_warband(obj), many=True).data

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
            "warband_link",
            "max_units",
            "dice_color",
            "show_loadout_on_mobile",
            "restrictions",
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

    def _units(self, obj) -> WarbandUnits:
        # rating and the three unit lists share one load of the unit tables
        cache: dict[int, WarbandUnits] = self.__dict__.setdefault("_units_cache", {})
        if obj.id not in cache:
            cache[obj.id] = load_warband_units([obj.id])[obj.id]
        return cache[obj.id]

    def get_gold(self, obj):
        return warband_gold(obj.id)

    def get_resources(self, obj):
        resources = getattr(obj, "resources", None)
        if resources is None:
            return []
        return WarbandResourceSerializer(resources.all(), many=True).data

    def get_rating(self, obj):
        return self._units(obj).rating

    def get_heroes(self, obj):
        return WarbandUnitSummarySerializer(self._units(obj).heroes, many=True).data

    def get_hired_swords(self, obj):
        return WarbandUnitSummarySerializer(self._units(obj).hired_swords, many=True).data

    def get_henchmen_groups(self, obj):
        groups = self._units(obj).henchmen_groups
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
    restriction_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)

    class Meta:
        model = Warband
        fields = ("name", "faction", "campaign_id", "max_units", "restriction_ids")

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
    restriction_ids = serializers.ListField(child=serializers.IntegerField(), required=False)

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
            "show_loadout_on_mobile",
            "restriction_ids",
            "warband_link",
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
        fields = ("id", "warband_id", "parent_id", "feature", "entry_type", "payload", "created_at")


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

    class Meta:
        model = WarbandItem
        fields = ("id", "name", "cost", "quantity")


class WarbandTradeChildSerializer(serializers.ModelSerializer):
    class Meta:
        model = WarbandTrade
        fields = (
            "id",
            "action",
            "description",
            "price",
            "notes",
            "created_at",
        )


class WarbandTradeSerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(read_only=True)
    children = WarbandTradeChildSerializer(many=True, read_only=True)

    class Meta:
        model = WarbandTrade
        fields = (
            "id",
            "warband_id",
            "parent_id",
            "action",
            "description",
            "price",
            "notes",
            "children",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class WarbandTradeCreateSerializer(serializers.ModelSerializer):
    parent_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = WarbandTrade
        fields = ("action", "description", "price", "notes", "parent_id")

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


class WarbandItemTransferSerializer(serializers.Serializer):
    source_type = serializers.ChoiceField(choices=("hero", "hired_sword", "henchmen_group", "stash"))
    source_id = serializers.IntegerField(required=False, allow_null=True)
    target_type = serializers.ChoiceField(choices=("hero", "hired_sword", "henchmen_group", "stash"))
    target_id = serializers.IntegerField(required=False, allow_null=True)
    item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)

    def validate(self, attrs):
        source_type = attrs["source_type"]
        target_type = attrs["target_type"]
        source_id = attrs.get("source_id")
        target_id = attrs.get("target_id")

        if source_type == target_type and source_id == target_id:
            raise serializers.ValidationError("Source and target must differ.")
        if source_type == "stash":
            attrs["source_id"] = None
        elif source_id is None:
            raise serializers.ValidationError({"source_id": "source_id is required for non-stash sources."})
        if target_type == "stash":
            attrs["target_id"] = None
        elif target_id is None:
            raise serializers.ValidationError({"target_id": "target_id is required for non-stash targets."})
        return attrs


class WarbandItemSaleSerializer(serializers.Serializer):
    source_type = serializers.ChoiceField(choices=("hero", "hired_sword", "henchmen_group", "stash"))
    source_id = serializers.IntegerField(required=False, allow_null=True)
    item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    price = serializers.IntegerField(min_value=0)

    def validate(self, attrs):
        source_type = attrs["source_type"]
        source_id = attrs.get("source_id")
        if source_type == "stash":
            attrs["source_id"] = None
        elif source_id is None:
            raise serializers.ValidationError({"source_id": "source_id is required for non-stash sources."})
        return attrs
