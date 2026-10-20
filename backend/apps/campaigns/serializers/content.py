"""House rules, encampments, locations, chat messages and bulletin notes."""

from rest_framework import serializers

from apps.core.html import sanitize_rich_text
from apps.users.names import display_name

from ..access import CAMPAIGN_RULES
from ..effects import EFFECT_KEYS
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

    def validate_effect_key(self, value):
        """One of the known effects, or nothing (a rule that is only text; IMP-69)."""
        if value and value not in EFFECT_KEYS:
            raise serializers.ValidationError(f"Unknown effect: {value}.")
        return value


class CampaignEncampmentSerializer(serializers.ModelSerializer):
    """An encampment, with `owner_left` (its owner has left the campaign: shown "(left)") and what the reader may do
    with it (`capabilities.edit`: edit, reassign, remove); `context["access"]` is the reader's CampaignAccess."""

    campaign_id = serializers.IntegerField(read_only=True)
    owner_id = serializers.IntegerField(source="owner.id", read_only=True, allow_null=True)
    owner_name = serializers.SerializerMethodField()
    owner_left = serializers.SerializerMethodField()
    capabilities = serializers.SerializerMethodField()

    class Meta:
        model = CampaignEncampment
        fields = ("id", "campaign_id", "name", "owner_id", "owner_name", "owner_left", "description", "capabilities")

    def get_owner_name(self, obj):
        if not obj.owner_id:
            return None
        return display_name(obj.owner)

    def get_owner_left(self, obj):
        return bool(obj.owner_id) and not getattr(obj, "owner_is_member", True)  # annotated (services/encampments)

    def get_capabilities(self, obj):
        access = self.context["access"]
        return {"edit": not access.archived and CAMPAIGN_RULES["edit_encampment"](access, obj)}


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


class RemovablePostSerializer(serializers.ModelSerializer):
    """A chat message or bulletin note: once removed (decision 8) its body is gone and `removed_by` says by whom,
    "author" or "admin" (an owner or admin, or a remover whose account is gone)."""

    user_id = serializers.IntegerField(source="user.id", read_only=True, allow_null=True)
    body = serializers.SerializerMethodField()
    removed_by = serializers.SerializerMethodField()

    def get_body(self, obj):
        return "" if obj.removed_at else obj.body

    def get_removed_by(self, obj):
        if not obj.removed_at:
            return None
        return "author" if obj.removed_by_id is not None and obj.removed_by_id == obj.user_id else "admin"


class CampaignMessageSerializer(RemovablePostSerializer):
    class Meta:
        model = CampaignMessage
        fields = ("id", "campaign_id", "user_id", "username", "body", "created_at", "removed_at", "removed_by")


class CampaignBulletinEntrySerializer(RemovablePostSerializer):
    campaign_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = CampaignBulletinEntry
        fields = ("id", "campaign_id", "user_id", "username", "body", "created_at", "removed_at", "removed_by")


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
