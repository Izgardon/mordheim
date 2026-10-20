"""The campaign as members read it, and the bodies of create, PATCH and join."""

from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from apps.restrictions.models import Restriction
from apps.warbands.services.ledger import MAX_TRADE_PRICE
from apps.warbands.utils.henchmen_level import normalize_henchmen_level_thresholds
from apps.warbands.utils.hero_level import normalize_hero_level_thresholds

from ..models import Campaign

SMALLINT_MAX = 32767  # the settings' PositiveSmallIntegerField columns (BUG-76)


class CampaignRestrictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restriction
        fields = ("id", "type", "restriction")


class CampaignSerializer(serializers.ModelSerializer):
    player_count = serializers.IntegerField(read_only=True)
    role = serializers.CharField(read_only=True)
    max_players = serializers.IntegerField(source="settings.max_players", read_only=True)
    max_heroes = serializers.IntegerField(source="settings.max_heroes", read_only=True)
    max_hired_swords = serializers.IntegerField(source="settings.max_hired_swords", read_only=True)
    max_games = serializers.IntegerField(source="settings.max_games", read_only=True)
    starting_gold = serializers.IntegerField(source="settings.starting_gold", read_only=True)
    hero_death_roll = serializers.CharField(source="settings.hero_death_roll", read_only=True)
    hero_level_thresholds = serializers.ListField(
        source="settings.hero_level_thresholds",
        read_only=True,
        child=serializers.IntegerField(),
    )
    henchmen_level_thresholds = serializers.ListField(
        source="settings.henchmen_level_thresholds",
        read_only=True,
        child=serializers.IntegerField(),
    )
    hired_sword_level_thresholds = serializers.ListField(
        source="settings.hired_sword_level_thresholds",
        read_only=True,
        child=serializers.IntegerField(),
    )
    enable_encampments = serializers.BooleanField(source="settings.enable_encampments", read_only=True)
    enable_locations = serializers.BooleanField(source="settings.enable_locations", read_only=True)
    item_settings = serializers.SerializerMethodField()

    def get_item_settings(self, obj):
        try:
            settings = obj.settings
        except ObjectDoesNotExist:
            return []
        return CampaignRestrictionSerializer(settings.item_settings.all(), many=True).data

    class Meta:
        model = Campaign
        fields = (
            "id",
            "name",
            "join_code",
            "max_players",
            "max_heroes",
            "max_hired_swords",
            "max_games",
            "starting_gold",
            "hero_death_roll",
            "hero_level_thresholds",
            "henchmen_level_thresholds",
            "hired_sword_level_thresholds",
            "enable_encampments",
            "enable_locations",
            "item_settings",
            "in_progress",
            "archived_at",
            "player_count",
            "role",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "join_code",
            "archived_at",
            "player_count",
            "role",
            "created_at",
            "updated_at",
        )


class CampaignCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    campaign_type = serializers.ChoiceField(choices=["standard", "marienburg"], required=False, default="standard")
    max_players = serializers.IntegerField(default=8)
    max_heroes = serializers.IntegerField(default=6, min_value=0, max_value=SMALLINT_MAX)
    max_hired_swords = serializers.IntegerField(default=3, min_value=0, max_value=SMALLINT_MAX)
    max_games = serializers.IntegerField(default=10, min_value=0, max_value=SMALLINT_MAX)
    starting_gold = serializers.IntegerField(default=500, min_value=0, max_value=MAX_TRADE_PRICE)
    item_setting_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)

    def validate_max_players(self, value):
        if value < 2 or value > 16:
            raise serializers.ValidationError("Max players must be between 2 and 16")
        return value


class CampaignUpdateSerializer(serializers.Serializer):
    in_progress = serializers.BooleanField(required=False)
    max_heroes = serializers.IntegerField(required=False, min_value=0, max_value=SMALLINT_MAX)
    max_hired_swords = serializers.IntegerField(required=False, min_value=0, max_value=SMALLINT_MAX)
    starting_gold = serializers.IntegerField(required=False, min_value=0, max_value=MAX_TRADE_PRICE)
    hero_death_roll = serializers.ChoiceField(choices=["d66", "d100"], required=False)
    enable_encampments = serializers.BooleanField(required=False)
    enable_locations = serializers.BooleanField(required=False)
    hero_level_thresholds = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=False,
    )
    henchmen_level_thresholds = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=False,
    )
    hired_sword_level_thresholds = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=False,
    )
    item_setting_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    adjust_existing_warbands = serializers.BooleanField(required=False)  # with a new starting_gold (BUG-78)

    def validate_hero_level_thresholds(self, value):
        try:
            return normalize_hero_level_thresholds(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate_henchmen_level_thresholds(self, value):
        try:
            return normalize_henchmen_level_thresholds(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate_hired_sword_level_thresholds(self, value):
        try:
            return normalize_henchmen_level_thresholds(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc


class JoinCampaignSerializer(serializers.Serializer):
    join_code = serializers.CharField(max_length=6)

    def validate_join_code(self, value):
        cleaned = value.strip().upper()
        if len(cleaned) != 6:
            raise serializers.ValidationError("Join code must be 6 characters")
        return cleaned
