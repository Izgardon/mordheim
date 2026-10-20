from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from apps.core.html import sanitize_rich_text
from apps.restrictions.models import Restriction
from apps.warbands.utils.henchmen_level import normalize_henchmen_level_thresholds
from apps.warbands.utils.hero_level import normalize_hero_level_thresholds

from .models import (
    Campaign,
    CampaignBulletinEntry,
    CampaignEncampment,
    CampaignHouseRule,
    CampaignLocation,
    CampaignMembership,
    CampaignMessage,
    CampaignPermission,
    CampaignSettings,
    PivotalMoment,
)


class CampaignRestrictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restriction
        fields = ("id", "type", "restriction")


class CampaignSettingsSerializer(serializers.ModelSerializer):
    item_settings = CampaignRestrictionSerializer(many=True, read_only=True)

    class Meta:
        model = CampaignSettings
        fields = (
            "max_players",
            "max_heroes",
            "max_hired_swords",
            "max_games",
            "starting_gold",
            "hero_death_roll",
            "hero_level_thresholds",
            "henchmen_level_thresholds",
            "hired_sword_level_thresholds",
            "locations",
            "enable_encampments",
            "enable_locations",
            "item_settings",
        )


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
    locations = serializers.BooleanField(source="settings.locations", read_only=True)
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
            "locations",
            "enable_encampments",
            "enable_locations",
            "item_settings",
            "in_progress",
            "player_count",
            "role",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "join_code",
            "player_count",
            "role",
            "created_at",
            "updated_at",
        )


class CampaignCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    campaign_type = serializers.ChoiceField(choices=["standard", "marienburg"], required=False, default="standard")
    max_players = serializers.IntegerField(default=8)
    max_heroes = serializers.IntegerField(default=6)
    max_hired_swords = serializers.IntegerField(default=3)
    max_games = serializers.IntegerField(default=10)
    starting_gold = serializers.IntegerField(default=500)
    item_setting_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)

    def validate_max_players(self, value):
        if value < 2 or value > 16:
            raise serializers.ValidationError("Max players must be between 2 and 16")
        return value


class CampaignUpdateSerializer(serializers.Serializer):
    in_progress = serializers.BooleanField(required=False)
    max_heroes = serializers.IntegerField(required=False, min_value=0)
    max_hired_swords = serializers.IntegerField(required=False, min_value=0)
    starting_gold = serializers.IntegerField(required=False, min_value=0)
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


class CampaignMembershipSerializer(serializers.ModelSerializer):
    campaign = CampaignSerializer(read_only=True)

    class Meta:
        model = CampaignMembership
        fields = ("id", "role", "campaign")


class CampaignPlayerSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    warband = serializers.SerializerMethodField()
    battle_busy = serializers.BooleanField(required=False, default=False)
    battle_busy_status = serializers.CharField(required=False, allow_null=True)
    battle_busy_battle_id = serializers.IntegerField(required=False, allow_null=True)
    battle_busy_last_activity_at = serializers.DateTimeField(required=False, allow_null=True)

    def get_warband(self, obj):
        warband = obj.get("warband")
        if not warband:
            return None
        return {
            "id": warband.get("id"),
            "name": warband.get("name"),
            "faction": warband.get("faction"),
            "wins": warband.get("wins"),
            "losses": warband.get("losses"),
            "rating": warband.get("rating"),
        }


class CampaignMemberSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.CharField()
    permissions = serializers.ListField(child=serializers.CharField())
    warband_id = serializers.IntegerField(allow_null=True, required=False)
    warband_name = serializers.CharField(allow_null=True, required=False)


class CampaignPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignPermission
        fields = ("code", "name")


class MembershipPermissionsUpdateSerializer(serializers.Serializer):
    permissions = serializers.ListField(child=serializers.CharField(), allow_empty=True)

    def validate_permissions(self, value):
        cleaned = []
        for item in value:
            code = str(item).strip().lower()
            if code:
                cleaned.append(code)
        return list(dict.fromkeys(cleaned))


class MembershipRoleUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["admin", "player"])


class CampaignHouseRuleSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = CampaignHouseRule
        fields = ("id", "campaign_id", "title", "description", "effect_key", "created_at", "updated_at")


class CampaignHouseRuleCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignHouseRule
        fields = ("title", "description", "effect_key")


class CampaignEncampmentSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)
    owner_id = serializers.IntegerField(source="owner.id", read_only=True, allow_null=True)
    owner_name = serializers.SerializerMethodField()

    class Meta:
        model = CampaignEncampment
        fields = ("id", "campaign_id", "name", "owner_id", "owner_name", "description")

    def get_owner_name(self, obj):
        if not obj.owner_id:
            return None
        return obj.owner.first_name or obj.owner.get_username()


class CampaignEncampmentWriteSerializer(serializers.ModelSerializer):
    owner_id = serializers.IntegerField(required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = CampaignEncampment
        fields = ("name", "owner_id", "description")

    def validate_name(self, value):
        cleaned = str(value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("Name is required.")
        return cleaned

    def validate_owner_id(self, value):
        if value is None:
            return None
        campaign_id = self.context.get("campaign_id")
        if (
            campaign_id is None
            or not CampaignMembership.objects.filter(campaign_id=campaign_id, user_id=value).exists()
        ):
            raise serializers.ValidationError("Owner must be a member of the campaign.")
        return value

    def create(self, validated_data):
        owner_id = validated_data.pop("owner_id", None)
        return CampaignEncampment.objects.create(owner_id=owner_id, **validated_data)

    def update(self, instance, validated_data):
        if "owner_id" in validated_data:
            instance.owner_id = validated_data.pop("owner_id")
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance


class CampaignLocationSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = CampaignLocation
        fields = ("id", "campaign_id", "name", "content", "d6_1", "d6_2", "d6_3", "d6_4", "d6_5", "d6_6")


class CampaignLocationWriteSerializer(serializers.ModelSerializer):
    content = serializers.CharField(required=False, allow_blank=True)
    d6_1 = serializers.CharField(required=False, allow_blank=True)
    d6_2 = serializers.CharField(required=False, allow_blank=True)
    d6_3 = serializers.CharField(required=False, allow_blank=True)
    d6_4 = serializers.CharField(required=False, allow_blank=True)
    d6_5 = serializers.CharField(required=False, allow_blank=True)
    d6_6 = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = CampaignLocation
        fields = ("name", "content", "d6_1", "d6_2", "d6_3", "d6_4", "d6_5", "d6_6")

    def validate_name(self, value):
        cleaned = str(value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("Name is required.")
        return cleaned

    def validate_content(self, value):
        # Rendered as HTML for every campaign member, so it must never carry scripts.
        return sanitize_rich_text(value)


class CampaignMessageSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True, allow_null=True)

    class Meta:
        model = CampaignMessage
        fields = ("id", "campaign_id", "user_id", "username", "body", "created_at")


class CampaignBulletinEntrySerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True, allow_null=True)

    class Meta:
        model = CampaignBulletinEntry
        fields = ("id", "campaign_id", "user_id", "username", "body", "created_at")


class CampaignBulletinEntryCreateSerializer(serializers.ModelSerializer):
    body = serializers.CharField(allow_blank=True, trim_whitespace=False)

    class Meta:
        model = CampaignBulletinEntry
        fields = ("body",)

    def validate_body(self, value):
        cleaned = str(value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("Bulletin body is required.")
        if len(cleaned) > 280:
            raise serializers.ValidationError("Bulletin body must be 280 characters or fewer.")
        return cleaned


class PivotalMomentSerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(source="warband.id", read_only=True)
    warband_name = serializers.CharField(source="warband.name", read_only=True)
    battle_id = serializers.IntegerField(source="battle.id", read_only=True)
    battle_scenario = serializers.CharField(source="battle.scenario", read_only=True)
    source_event_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = PivotalMoment
        fields = (
            "id",
            "kind",
            "headline",
            "detail",
            "unit_key",
            "unit_name",
            "warband_id",
            "warband_name",
            "battle_id",
            "battle_scenario",
            "source_event_id",
            "battle_ended_at",
        )


class CampaignTopKillerSerializer(serializers.Serializer):
    unit_id = serializers.IntegerField()
    unit_kind = serializers.ChoiceField(choices=["hero", "hired_sword", "henchman"])
    unit_name = serializers.CharField()
    unit_type = serializers.CharField(allow_null=True, required=False)
    warband_id = serializers.IntegerField()
    warband_name = serializers.CharField()
    kills = serializers.IntegerField(min_value=1)
