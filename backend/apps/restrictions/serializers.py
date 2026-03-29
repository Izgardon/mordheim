from rest_framework import serializers

from .models import Restriction


class RestrictionSerializer(serializers.ModelSerializer):
    def validate_type(self, value):
        if value == "Setting":
            raise serializers.ValidationError("Setting restrictions must be selected from the existing campaign settings.")
        return value

    class Meta:
        model = Restriction
        fields = (
            "id",
            "type",
            "restriction",
            "campaign",
        )
        read_only_fields = ("campaign",)
