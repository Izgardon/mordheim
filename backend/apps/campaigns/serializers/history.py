"""Top killers, for the campaign overview (a battle's pivotal moments ride the battle history)."""

from rest_framework import serializers


class CampaignTopKillerSerializer(serializers.Serializer):
    unit_id = serializers.IntegerField()
    unit_kind = serializers.ChoiceField(choices=["hero", "hireling", "henchman"])
    unit_name = serializers.CharField()
    unit_type = serializers.CharField(allow_null=True, required=False)
    warband_id = serializers.IntegerField()
    warband_name = serializers.CharField()
    kills = serializers.IntegerField(min_value=1)
