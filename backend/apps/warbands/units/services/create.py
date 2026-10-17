"""Recruiting a unit: the cap check, the unit with its loadout, and its ledger rows, for every kind."""

from collections.abc import Mapping, MutableMapping
from typing import TYPE_CHECKING, Any

from django.db import transaction

from apps.warbands.models import RosterUnit, Warband

from .loadout import apply_create_traits, pop_loadout_lists, replace_loadout

if TYPE_CHECKING:
    from rest_framework.serializers import BaseSerializer

    from apps.warbands.units.kinds import UnitKindSpec


def _wants_to_skip_cap(sent: Any) -> bool:
    return str(sent.get("ignore_max_heroes", False)).lower() in ("1", "true", "yes")


def cap_refusal(kind: "UnitKindSpec", warband: Warband, data: Mapping[str, Any], *, sent: Any) -> str | None:
    """Why a new unit can't be added under the kind's cap (the 400's message), or None if it can.

    `data` is the validated body and `sent` the body as sent; the cap counts the warband's units as the
    kind's CapSpec says, with the campaign's limit or the kind's default.
    """
    cap = kind.cap
    if cap is None or (cap.client_may_skip and _wants_to_skip_cap(sent)):
        return None
    settings = getattr(warband.campaign, "settings", None)  # loaded with the warband
    limit = getattr(settings, cap.setting) if settings else None
    if limit is None:
        limit = cap.default
    if cap.exempt(data) or cap.counted(kind.objects.filter(warband=warband)).count() < limit:
        return None
    return f"Warband already has {limit} {cap.noun}"


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


def create_unit(kind: "UnitKindSpec", warband: Warband, writer: "BaseSerializer[Any]", *, sent: Any) -> RosterUnit:
    """Create the unit from a validated create serializer and write its recruit ledger, in one transaction."""
    with transaction.atomic():
        unit: RosterUnit = writer.save(warband=warband)
        kind.hooks.record_recruit(kind, warband, unit, sent)
    return unit
