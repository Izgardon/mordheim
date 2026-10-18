from rest_framework import serializers

from apps.restrictions.serializers import RestrictionSerializer
from apps.warbands.models import Warband, WarbandResource
from apps.warbands.restrictions import get_effective_restrictions_for_warband
from apps.warbands.services.ledger import MAX_TRADE_PRICE
from apps.warbands.services.resources import MAX_AMOUNT
from apps.warbands.services.summary import WarbandUnits, load_warband_units
from apps.warbands.units.kinds import HERO, HIRED_SWORD
from apps.warbands.units.services.create import cap_limit

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
    unit_count = serializers.SerializerMethodField()
    hero_count = serializers.SerializerMethodField()
    max_heroes = serializers.SerializerMethodField()
    hired_sword_count = serializers.SerializerMethodField()
    max_hired_swords = serializers.SerializerMethodField()

    def _units(self, obj) -> WarbandUnits:
        # rating and the three unit lists share one load of the unit tables; the sheet passes the units it loaded
        provided: WarbandUnits | None = self.context.get("warband_units")
        if provided is not None:
            return provided
        cache: dict[int, WarbandUnits] = self.__dict__.setdefault("_units_cache", {})
        if obj.id not in cache:
            cache[obj.id] = load_warband_units([obj.id])[obj.id]
        return cache[obj.id]

    def get_gold(self, obj: Warband) -> int:
        return obj.gold  # the stored balance (services/ledger.py)

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

    # Decision 12: warband size (max_units) only warns; the hero and hired-sword caps block adding units.
    def get_unit_count(self, obj) -> int:
        return self._units(obj).unit_count

    def get_hero_count(self, obj) -> int:
        return self._units(obj).hero_count

    def get_max_heroes(self, obj) -> int | None:
        return cap_limit(HERO, obj)

    def get_hired_sword_count(self, obj) -> int:
        return self._units(obj).hired_sword_count

    def get_max_hired_swords(self, obj) -> int | None:
        return cap_limit(HIRED_SWORD, obj)

    class Meta:
        model = Warband
        fields = (
            "resources",
            "rating",
            "gold",
            "heroes",
            "hired_swords",
            "henchmen_groups",
            "unit_count",
            "max_units",
            "hero_count",
            "max_heroes",
            "hired_sword_count",
            "max_hired_swords",
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


class WarbandResourceUpdateSerializer(serializers.Serializer):
    """PATCH resources/<id>/: `delta` adds to the stored amount (stopping at 0); `amount` sets it (0 or more, for
    clients from before pass 2). Other keys, the name included, are ignored (BUG-68)."""

    amount = serializers.IntegerField(min_value=0, max_value=MAX_AMOUNT, required=False)
    delta = serializers.IntegerField(min_value=-MAX_AMOUNT, max_value=MAX_AMOUNT, required=False)

    def validate(self, attrs):
        if "amount" in attrs and "delta" in attrs:
            raise serializers.ValidationError("Send amount or delta, not both.")
        return attrs


class WarbandResourceSaleSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1, max_value=MAX_AMOUNT)
    price = serializers.IntegerField(min_value=0, max_value=MAX_TRADE_PRICE)


class StashCostSerializer(serializers.Serializer):
    cost = serializers.IntegerField(allow_null=True)
    quantity = serializers.IntegerField()


class WarbandItemSummarySerializer(serializers.Serializer):
    """A stash entry (services/stash.py StashEntry): the item, how many copies, the cost of the copies that leave
    first, and how many copies of each cost (BUG-117), the copies that leave first first."""

    id = serializers.IntegerField(source="item.id")
    name = serializers.CharField(source="item.name")
    cost = serializers.IntegerField(allow_null=True)
    quantity = serializers.IntegerField()
    costs = StashCostSerializer(many=True)


class WarbandItemTransferSerializer(serializers.Serializer):
    source_type = serializers.ChoiceField(choices=("hero", "hired_sword", "henchmen_group", "stash"))
    source_id = serializers.IntegerField(required=False, allow_null=True)
    cost = serializers.IntegerField(required=False, allow_null=True)  # from the stash: only copies of this cost
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
    cost = serializers.IntegerField(required=False, allow_null=True)  # from the stash: only copies of this cost
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
