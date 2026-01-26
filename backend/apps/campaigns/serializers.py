from rest_framework import serializers

from .models import (
    Campaign,
    CampaignHouseRule,
    CampaignMembership,
    CampaignPermission,
    CampaignType,
)


class CampaignTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignType
        fields = ("code", "name")


class CampaignSerializer(serializers.ModelSerializer):
    player_count = serializers.IntegerField(read_only=True)
    role = serializers.CharField(read_only=True)
    campaign_type = serializers.SlugRelatedField(
        slug_field="code", read_only=True
    )
    campaign_type_name = serializers.CharField(
        source="campaign_type.name", read_only=True
    )

    class Meta:
        model = Campaign
        fields = (
            "id",
            "name",
            "campaign_type",
            "campaign_type_name",
            "join_code",
            "max_players",
            "max_games",
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


class CampaignCreateSerializer(serializers.ModelSerializer):
    campaign_type = serializers.SlugRelatedField(
        slug_field="code", queryset=CampaignType.objects.all()
    )

    class Meta:
        model = Campaign
        fields = ("name", "campaign_type", "max_players", "max_games")

    def validate_max_players(self, value):
        if value < 2 or value > 16:
            raise serializers.ValidationError("Max players must be between 2 and 16")
        return value


class CampaignUpdateSerializer(serializers.Serializer):
    in_progress = serializers.BooleanField(required=False)


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
