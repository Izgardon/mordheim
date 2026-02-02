from rest_framework import serializers

from .models import Other


class OtherSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Other
        fields = ("id", "campaign_id", "name", "type", "description")


class OtherCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Other
        fields = ("campaign", "name", "type", "description")
