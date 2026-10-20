"""The players and members lists, and the bodies of a grant PUT and a role PATCH."""

from rest_framework import serializers


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


class OwnershipSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()  # the admin who becomes the owner (decision 4)
