"""The create body every kind shares: the write body, with the name a new unit must have (William, 26 Nov 2026: "Block
it, needs a name"). A PATCH keeps the write body's name, so a write that doesn't send one leaves it as it is."""

from rest_framework import serializers

from .errors import NAME_NEEDED
from .serializers import UnitWriteSerializer


class UnitCreateSerializer(UnitWriteSerializer):
    """A hero's, hired sword's or henchmen group's create (POST .../<kind>/, a roster Save's `create`, a hire): refused
    with "Name is needed." when the name is left out, null or blank (spaces count as blank)."""

    name = serializers.CharField(
        max_length=120, error_messages={"required": NAME_NEEDED, "null": NAME_NEEDED, "blank": NAME_NEEDED}
    )
