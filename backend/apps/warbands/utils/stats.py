"""Characteristics as the books print them (William, 3 Nov 2026: "allow free text instead of nums as a lot of units
will require them"): a whole number from 0 to 10, or a written value such as "1(2)", "5*", "2D6" or "-".

A written stat keeps its text in `written_stats` (keyed by field) and the number the app does sums with in the field
itself: the whole number it starts with ("1(2)" is 1, "5*" is 5), or none at all ("D6", "2D6", "-"; "-" is not 0,
William). Sums use the number and skip a stat that has none: an advance adds 1 to the number and leaves the text, which
the pages then flag as needing an update (William: "do alternative, but warn").
"""

import re
from typing import Any, NamedTuple

from rest_framework import serializers

STAT_FIELDS = (
    "movement",
    "weapon_skill",
    "ballistic_skill",
    "strength",
    "toughness",
    "wounds",
    "initiative",
    "attacks",
    "leadership",
)
MAX_STAT = 10
MAX_WRITTEN = 8  # the books' longest are "1(2)", "3(6)" and "2D6"; a stat cell holds a few characters
STAT_ERROR = f'Enter a number from 0 to {MAX_STAT}, or the value as written, such as "1(2)", "D6" or "-".'
WRITTEN_TOO_LONG = f"Keep a written value to {MAX_WRITTEN} characters."
_LEADING_NUMBER = re.compile(r"^(\d+)(?![\dDd])")  # "1(2)" and "5*" start with one; "2D6" is a dice roll


class Stat(NamedTuple):
    number: int | None
    written: str | None  # None: a plain number


def written_number(text: str) -> int | None:
    """The number a written value starts with, or None ("D6", "2D6", "-")."""
    match = _LEADING_NUMBER.match(text)
    return int(match.group(1)) if match else None


def read_stat(value: Any) -> Stat:
    """A stat as sent: 4, "4", "1(2)", "D6", "-". ValueError (STAT_ERROR or WRITTEN_TOO_LONG) for anything else."""
    if isinstance(value, bool):
        raise ValueError(STAT_ERROR)
    if isinstance(value, int):
        stat = Stat(value, None)
    elif isinstance(value, float) and value.is_integer():
        stat = Stat(int(value), None)
    elif isinstance(value, str):
        text = " ".join(value.split())
        if not text:
            raise ValueError(STAT_ERROR)
        if text.isdigit():
            stat = Stat(int(text), None)
        elif len(text) > MAX_WRITTEN:
            raise ValueError(WRITTEN_TOO_LONG)
        else:
            stat = Stat(written_number(text), text)
    else:
        raise ValueError(STAT_ERROR)
    if stat.number is not None and not 0 <= stat.number <= MAX_STAT:
        raise ValueError(STAT_ERROR)
    return stat


def stat_values(source: Any) -> dict[str, Any]:
    """A profile's nine characteristics and written values as stored, for a create that skips the serializer (a
    promotion)."""
    return {
        **{field: getattr(source, field) for field in STAT_FIELDS},
        "written_stats": dict(getattr(source, "written_stats", None) or {}),
    }


def stat_inputs(source: Any) -> dict[str, Any]:
    """A profile's nine characteristics as a create body sends them (a hire, a promotion, a beast recruited): each
    written value as written, else its number."""
    written = getattr(source, "written_stats", None) or {}
    inputs: dict[str, Any] = {}
    for field in STAT_FIELDS:
        value = written.get(field)
        if value is None:
            value = getattr(source, field)
        inputs[field] = "-" if value is None else value
    return inputs


class StatField(serializers.Field):
    """A characteristic as players type it (`read_stat`); answered as its number, which is null for "D6" or "-"."""

    def to_internal_value(self, data: Any) -> Stat:
        try:
            return read_stat(data)
        except ValueError as error:
            raise serializers.ValidationError(str(error)) from None

    def to_representation(self, value: Any) -> Any:
        return value


class WrittenStatsSerializer(serializers.Serializer):
    """The nine characteristics of a profile that may be written (units, hired swords, bestiary entries): each sent
    stat sets its number and its written value (a plain number clears it), and `written_stats` answers them all."""

    movement = StatField(required=False)
    weapon_skill = StatField(required=False)
    ballistic_skill = StatField(required=False)
    strength = StatField(required=False)
    toughness = StatField(required=False)
    wounds = StatField(required=False)
    initiative = StatField(required=False)
    attacks = StatField(required=False)
    leadership = StatField(required=False)
    written_stats = serializers.JSONField(read_only=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)
        sent = {field: attrs[field] for field in STAT_FIELDS if isinstance(attrs.get(field), Stat)}
        if sent:
            written = dict(getattr(self.instance, "written_stats", None) or {})
            for field, stat in sent.items():
                attrs[field] = stat.number
                if stat.written is None:
                    written.pop(field, None)
                else:
                    written[field] = stat.written
            attrs["written_stats"] = written
        return attrs
