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
