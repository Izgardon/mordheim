from rest_framework import serializers

from .models import Restriction


class RestrictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restriction
        fields = (
            "id",
            "type",
            "restriction",
            "campaign",
        )
        read_only_fields = ("campaign",)
