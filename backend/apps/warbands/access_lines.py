"""Who-can lists as payloads show them and writes send them (the items rebuild): a price row's buyers, a hired sword's
or dramatis persona's hirers, a special skill's learners. A line is a warband type or a warband group, included or
excluded (`models.types.WarbandAccess`).

A write's types are the book's or the writer's campaign's (another campaign's read as unknown, SEC-07); groups are
the book's. Each is checked in one query for a whole write.
"""

from collections.abc import Iterable, Mapping
from typing import Any

from django.db.models import Q
from rest_framework import serializers

from apps.warbands.models import WarbandGroup, WarbandType


def line_name(line: Any) -> str:
    """The name of the type or group a line names (read with them)."""
    named = line.warband_type if line.warband_type_id else line.warband_group
    return str(named.name) if named is not None else ""


def source_code(line: Any) -> str:
    """A type's source code ("BTB"); a group's is blank."""
    return str(line.warband_type.source_code) if line.warband_type_id and line.warband_type else ""


class AccessLineSerializer(serializers.Serializer):
    """`{warband_type_id, warband_group_id, name, source_code, excluded}`: the line's type or group (one is null), its
    name and a type's source code (a group's is blank), which tells two types of one name apart ("Norse Explorers
    (BTB)")."""

    warband_type_id = serializers.IntegerField(allow_null=True)
    warband_group_id = serializers.IntegerField(allow_null=True)
    name = serializers.SerializerMethodField()
    source_code = serializers.SerializerMethodField()
    excluded = serializers.BooleanField()

    def get_name(self, line: Any) -> str:
        return line_name(line)

    def get_source_code(self, line: Any) -> str:
        return source_code(line)


class AccessLineInputSerializer(serializers.Serializer):
    """One line of a who-can list a write sends: a type or a group, and whether it is excluded."""

    warband_type_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    warband_group_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    excluded = serializers.BooleanField(default=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if bool(attrs.get("warband_type_id")) == bool(attrs.get("warband_group_id")):
            raise serializers.ValidationError("Name a warband type or a warband group, not both.")
        return {"warband_type_id": None, "warband_group_id": None, "excluded": False, **attrs}


def refuse_unknown_lines(lines: Iterable[Mapping[str, Any]], campaign_id: int) -> None:
    """Every type must be the book's or the campaign's and every group the book's: one query each (none when the
    write names none)."""
    lines = list(lines)
    type_ids = {line["warband_type_id"] for line in lines if line.get("warband_type_id")}
    group_ids = {line["warband_group_id"] for line in lines if line.get("warband_group_id")}
    scope = Q(campaign__isnull=True) | Q(campaign_id=campaign_id)
    known_types = set(WarbandType.objects.filter(scope, id__in=type_ids).values_list("id", flat=True)) if type_ids else set()  # fmt: skip
    known_groups = set(WarbandGroup.objects.filter(id__in=group_ids).values_list("id", flat=True)) if group_ids else set()  # fmt: skip
    missing = sorted(type_ids - known_types) + sorted(group_ids - known_groups)
    if missing:
        raise serializers.ValidationError([f'Invalid pk "{pk}" - object does not exist.' for pk in missing])


def unique_lines(lines: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Each type or group once (its last line wins), in the order first sent."""
    keyed: dict[tuple[Any, Any], dict[str, Any]] = {}
    for line in lines:
        key = (line.get("warband_type_id"), line.get("warband_group_id"))
        keyed[key] = {**keyed.get(key, {}), **line}
    return list(keyed.values())


def _listed(names: list[str]) -> str:
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def line_names(lines: Iterable[Any]) -> list[tuple[str, bool]]:
    """Each line's name and whether it is excluded, a type's with its source code where another line has its name
    ("Norse Explorers (BTB)"), from lines read with their types and groups."""
    read = [(line_name(line), line) for line in lines]
    count: dict[str, int] = {}
    for name, _line in read:
        count[name] = count.get(name, 0) + 1
    named = []
    for name, line in read:
        code = source_code(line)
        named.append((f"{name} ({code})" if count[name] > 1 and code else name, bool(line.excluded)))
    return named


def who_text(for_everyone: bool, lines: Iterable[Any]) -> str:
    """Who a who-can list is for, when it is for anyone less than everyone: "For Skaven and Lizardmen.", "For Humans,
    except Witch Hunters.", "Not available for Dark Elves." (everyone else), "Not available for any warband."; blank for
    everyone (William, 22 Nov 2026: the store's item says who it is for if it has a restriction)."""
    named = line_names(lines)
    included = [name for name, excluded in named if not excluded]
    excluded = [name for name, excluded in named if excluded]
    if for_everyone:
        return f"Not available for {_listed(excluded)}." if excluded else ""
    if not included:
        return "Not available for any warband."
    if excluded:
        return f"For {_listed(included)}, except {_listed(excluded)}."
    return f"For {_listed(included)}."
