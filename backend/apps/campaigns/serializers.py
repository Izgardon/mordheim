from rest_framework import serializers

from .models import (
    Campaign,
    CampaignHouseRule,
    CampaignMembership,
    CampaignPermission,
    CampaignSettings,
    CampaignType,
)


class CampaignTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignType
        fields = ("code", "name")


class CampaignSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignSettings
        fields = (
            "max_players",
            "max_heroes",
            "max_hired_swords",
            "max_games",
            "starting_gold",
        )


class CampaignSerializer(serializers.ModelSerializer):
    player_count = serializers.IntegerField(read_only=True)
    role = serializers.CharField(read_only=True)
    campaign_type = serializers.SlugRelatedField(
        slug_field="code", read_only=True
    )
    campaign_type_name = serializers.CharField(
        source="campaign_type.name", read_only=True
    )
    max_players = serializers.IntegerField(source="settings.max_players", read_only=True)
    max_heroes = serializers.IntegerField(source="settings.max_heroes", read_only=True)
    max_hired_swords = serializers.IntegerField(source="settings.max_hired_swords", read_only=True)
    max_games = serializers.IntegerField(source="settings.max_games", read_only=True)
    starting_gold = serializers.IntegerField(source="settings.starting_gold", read_only=True)

    class Meta:
        model = Campaign
        fields = (
            "id",
            "name",
            "campaign_type",
            "campaign_type_name",
            "join_code",
            "max_players",
            "max_heroes",
            "max_hired_swords",
            "max_games",
            "starting_gold",
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
    campaign_type = serializers.SlugRelatedField(
        slug_field="code", queryset=CampaignType.objects.all()
    )
    max_players = serializers.IntegerField(default=8)
    max_heroes = serializers.IntegerField(default=6)
    max_hired_swords = serializers.IntegerField(default=3)
    max_games = serializers.IntegerField(default=10)
    starting_gold = serializers.IntegerField(default=500)

    def validate_max_players(self, value):
        if value < 2 or value > 16:
            raise serializers.ValidationError("Max players must be between 2 and 16")
        return value


class CampaignUpdateSerializer(serializers.Serializer):
    in_progress = serializers.BooleanField(required=False)
    max_heroes = serializers.IntegerField(required=False, min_value=0)
    max_hired_swords = serializers.IntegerField(required=False, min_value=0)
    starting_gold = serializers.IntegerField(required=False, min_value=0)


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
        }


class CampaignMemberSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.CharField()
    permissions = serializers.ListField(child=serializers.CharField())


class CampaignPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignPermission
        fields = ("code", "name")


class MembershipPermissionsUpdateSerializer(serializers.Serializer):
    permissions = serializers.ListField(
        child=serializers.CharField(), allow_empty=True
    )

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
        fields = ("id", "campaign_id", "title", "description", "created_at", "updated_at")


class CampaignHouseRuleCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignHouseRule
        fields = ("title", "description")
