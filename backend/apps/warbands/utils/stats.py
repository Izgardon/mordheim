"""Characteristics as the books print them (William, 3 Nov 2026: "allow free text instead of nums as a lot of units
will require them"): a whole number from 0 to 10, or a written value such as "1(2)", "5*", "2D6" or "-".

The field holds the number the app does sums with: the whole number a written value starts with ("1(2)" is 1, "5*" is
5), or none at all ("D6", "2D6", "-"; "-" is not 0, William). `written_stats` (keyed by field) holds what the book
writes after that number ("(2)", "*"), or the whole text when there is no number. A stat shows as its number followed
by that text, so a change to the number moves the text with it (William: "the text part was just the (2) here"): an
advance turns "1(2)" into "2(2)". Sums skip a stat without a number.
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
    written: str | None  # what follows the number ("(2)"), or the whole text without one ("D6"); None: plain


def split_written(text: str) -> Stat:
    """A written value as its number and what follows it ("1(2)": 1 and "(2)"), or no number and the whole text."""
    match = _LEADING_NUMBER.match(text)
    if match is None:
        return Stat(None, text)
    return Stat(int(match.group(1)), text[match.end() :] or None)


def shown_stat(number: int | None, written: str | None) -> str:
    """A stat as the book writes it: its number followed by its written text ("2(2)"), or the text alone ("D6")."""
    return f"{'' if number is None else number}{written or ''}" or "-"


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
            stat = split_written(text)
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
    """A profile's nine characteristics as a create body sends them (a hire, a beast recruited): a written stat as
    the book writes it ("2(2)"), else its number."""
    written = getattr(source, "written_stats", None) or {}
    inputs: dict[str, Any] = {}
    for field in STAT_FIELDS:
        number = getattr(source, field)
        inputs[field] = shown_stat(number, written.get(field)) if field in written or number is None else number
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
