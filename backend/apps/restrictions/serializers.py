from rest_framework import serializers

from .models import Restriction


class RestrictionSerializer(serializers.ModelSerializer):
    """A restriction as lists and warband payloads show it; nothing writes restrictions through the API (SEC-06)."""

    class Meta:
        model = Restriction
        fields = (
            "id",
            "type",
            "restriction",
            "campaign",
            "campaign_type",  # CAT-NEW-04: always null today
        )
        read_only_fields = ("campaign", "campaign_type")
