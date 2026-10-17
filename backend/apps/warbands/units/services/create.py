"""Recruiting a unit: the cap check, the unit with its loadout, and its ledger rows, for every kind."""

from collections.abc import Mapping, MutableMapping
from typing import TYPE_CHECKING, Any

from django.db import transaction

from apps.warbands.models import RosterUnit, Warband
from apps.warbands.units.errors import RosterError
from apps.warbands.utils.leaders import lock_warband

from .loadout import apply_create_traits, pop_loadout_lists, replace_loadout

if TYPE_CHECKING:
    from rest_framework.serializers import BaseSerializer

    from apps.warbands.units.kinds import UnitKindSpec


def cap_limit(kind: "UnitKindSpec", warband: Warband) -> int | None:
    """The kind's cap in the warband's campaign (or the kind's default); None for a kind without a cap."""
    cap = kind.cap
    if cap is None:
        return None
    settings = getattr(warband.campaign, "settings", None)  # loaded with the warband
    limit = getattr(settings, cap.setting) if settings else None
    return cap.default if limit is None else int(limit)


def cap_count(kind: "UnitKindSpec", warband: Warband) -> int:
    """How many of the warband's units count towards the kind's cap (living, not dismissed, per CapSpec)."""
    assert kind.cap is not None
    return int(kind.cap.counted(kind.objects.filter(warband=warband)).count())


def check_cap(kind: "UnitKindSpec", warband: Warband, data: Mapping[str, Any], *, locked: bool = False) -> None:
    """Raise `<kind>_cap_reached` if a new unit with validated body `data` would go over the kind's cap.

    Runs inside the create's transaction with the warband row locked, so two concurrent creates can't both
    take the last place (BUG-105); `locked` says the caller already holds that lock.
    """
    cap, limit = kind.cap, cap_limit(kind, warband)
    if cap is None or limit is None or cap.exempt(data):
        return
    if not locked:
        lock_warband(warband.id)
    if cap_count(kind, warband) >= limit:
        raise RosterError(f"Warband already has {limit} {cap.noun}", cap.code)


def apply_create(kind: "UnitKindSpec", data: MutableMapping[str, Any]) -> RosterUnit:
    """Create a unit from a validated body (with `warband`): its fields, loadout, traits and members."""
    lists = pop_loadout_lists(kind, data)
    members = data.pop("henchmen", None) if kind.has_members else None
    apply_create_traits(kind, data, lists)
    if not (kind.recruit.client_may_seed_level_up and "level_up" in data):
        data["level_up"] = 0  # seeded XP on first persist mints no level-ups
    data["xp_high_water"] = data.get("xp") or 0  # nor do later climbs back up to it (BUG-27)
    unit: RosterUnit = kind.objects.create(**data)
    replace_loadout(kind, unit, lists, fresh=True)
    kind.hooks.after_create(unit, members)
    return unit


def recruit(kind: "UnitKindSpec", warband: Warband, writer: "BaseSerializer[Any]", *, sent: Any) -> RosterUnit:
    """Inside the caller's transaction: check the cap, create the unit from a validated create serializer
    and write its recruit ledger."""
    check_cap(kind, warband, writer.validated_data)
    unit: RosterUnit = writer.save(warband=warband)
    kind.hooks.record_recruit(kind, warband, unit, sent)
    return unit


def create_unit(kind: "UnitKindSpec", warband: Warband, writer: "BaseSerializer[Any]", *, sent: Any) -> RosterUnit:
    """Recruit one unit in its own transaction (POST .../<kind>/)."""
    with transaction.atomic():
        return recruit(kind, warband, writer, sent=sent)
