"""Serializers shared by every unit kind."""

from dataclasses import dataclass

from rest_framework import serializers


@dataclass(frozen=True)
class UnitSerializers:
    """One kind's serializers, looked up by kind key in `apps.warbands.serializers.UNIT_SERIALIZERS`."""

    summary: type[serializers.ModelSerializer]  # list rows
    detail: type[serializers.ModelSerializer]  # detail lists, single unit, write responses
    create: type[serializers.ModelSerializer]
    update: type[serializers.ModelSerializer]


class UnitLevelUpSerializer(serializers.Serializer):
    """POST .../level-up/: the advance arrives as `payload.advance` and the payload is logged as sent."""

    payload = serializers.DictField(required=False)  # a non-object payload is a 400, not a 500 (BUG-89)
