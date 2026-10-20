"""House rules, encampments, locations, chat messages and bulletin notes."""

from rest_framework import serializers

from apps.core.html import sanitize_rich_text
from apps.users.names import display_name

from ..models import (
    CampaignBulletinEntry,
    CampaignEncampment,
    CampaignHouseRule,
    CampaignLocation,
    CampaignMembership,
    CampaignMessage,
)


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
        return display_name(obj.owner)


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
