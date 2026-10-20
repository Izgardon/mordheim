"""Pivotal moments and top killers, for the campaign overview."""

from rest_framework import serializers

from ..models import PivotalMoment


class PivotalMomentSerializer(serializers.ModelSerializer):
    warband_id = serializers.IntegerField(source="warband.id", read_only=True)
    warband_name = serializers.CharField(source="warband.name", read_only=True)
    battle_id = serializers.IntegerField(source="battle.id", read_only=True)
    battle_scenario = serializers.CharField(source="battle.scenario", read_only=True)
    source_event_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = PivotalMoment
        fields = (
            "id",
            "kind",
            "headline",
            "detail",
            "unit_key",
            "unit_name",
            "warband_id",
            "warband_name",
            "battle_id",
            "battle_scenario",
            "source_event_id",
            "battle_ended_at",
        )


class CampaignTopKillerSerializer(serializers.Serializer):
    unit_id = serializers.IntegerField()
    unit_kind = serializers.ChoiceField(choices=["hero", "hired_sword", "henchman"])
    unit_name = serializers.CharField()
    unit_type = serializers.CharField(allow_null=True, required=False)
    warband_id = serializers.IntegerField()
    warband_name = serializers.CharField()
    kills = serializers.IntegerField(min_value=1)
