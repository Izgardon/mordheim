from rest_framework import serializers

from .models import Campaign, CampaignMembership, CampaignPermission


class CampaignSerializer(serializers.ModelSerializer):
    player_count = serializers.IntegerField(read_only=True)
    role = serializers.CharField(read_only=True)

    class Meta:
        model = Campaign
        fields = (
            "id",
            "name",
            "campaign_type",
            "join_code",
            "max_players",
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
    class Meta:
        model = Campaign
        fields = ("name", "campaign_type", "max_players")

    def validate_max_players(self, value):
        if value < 2 or value > 16:
            raise serializers.ValidationError("Max players must be between 2 and 16")
        return value


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


class CampaignMemberSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.CharField()


class CampaignPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignPermission
        fields = ("code", "name")


class AdminPermissionsUpdateSerializer(serializers.Serializer):
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

