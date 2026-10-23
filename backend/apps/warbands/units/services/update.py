"""PATCHing a unit, the same for every kind: fields, XP level-ups, loadout lists, traits and the logs."""

from collections.abc import Mapping, MutableMapping
from typing import TYPE_CHECKING, Any, cast

from django.db import transaction

from apps.logs.utils import log_warband_event
from apps.warbands.models import RosterUnit, Warband

from .loadout import finish_update_traits, linked_ids, pop_loadout_lists, prepare_update_traits, replace_loadout
from .xp import record_xp_change

if TYPE_CHECKING:
    from apps.warbands.units.hooks import Recruit
    from apps.warbands.units.kinds import UnitKindSpec
    from apps.warbands.units.serializers import UnitWriteSerializer

# Accepted (by the hero PATCH) and discarded: the frontend sends them with item purchases.
DISCARDED_FIELDS = ("item_reason", "item_action", "item_price")
# The loadout log's fallback type per catalogue target.
DEFAULT_ENTRY_TYPE = {"skill": "general", "special": "ability", "spell": "magic"}


def apply_update(
    kind: "UnitKindSpec", unit: RosterUnit, data: MutableMapping[str, Any], campaign_id: int
) -> list["Recruit"]:
    """Write a validated PATCH to `unit`; returns the members it recruited, for the ledger.

    A sent list replaces the whole list. XP sent without `level_up` adds the thresholds it crosses above
    the high-water mark; with `level_up` (the pending level-ups editor) the count is set as sent. The
    kind's hooks keep the hero crown and the henchmen members in step.
    """
    for name in DISCARDED_FIELDS:
        data.pop(name, None)
    lists = pop_loadout_lists(kind, data)
    members = data.pop("henchmen", None) if kind.has_members else None
    trait_update = prepare_update_traits(kind, data, lists, campaign_id)
    fields = frozenset(data)
    previous_xp = unit.xp
    kind.hooks.before_update(unit, fields, members)
    for name, value in data.items():
        setattr(unit, name, value)
    if "xp" in fields:
        settings = getattr(unit.warband.campaign, "settings", None)
        record_xp_change(kind, unit, previous_xp, settings, award="level_up" not in fields)
    unit.save()
    recruits = kind.hooks.after_update(unit, fields, members)  # before the lists: hire costs read the old items
    replace_loadout(kind, unit, lists)
    finish_update_traits(kind, unit, trait_update, lists)
    return recruits


def _logged_ids_before(kind: "UnitKindSpec", unit: RosterUnit, sent: Any) -> dict[str, set[int]]:
    """For each logged list the PATCH sends, the ids linked before it: only additions are logged."""
    return {
        link.write_field: linked_ids(getattr(unit, link.relation), f"{link.target}_id")
        for link in kind.links()
        if link.log_entry and link.write_field in sent
    }


def _log_loadout_additions(
    kind: "UnitKindSpec", warband: Warband, unit: RosterUnit, before: Mapping[str, set[int]], sent: Any
) -> None:
    """One loadout log row per skill, special or spell the PATCH added, compared as the client sent the ids."""
    unit_name = unit.name or unit.unit_type or kind.unknown_name
    for link in kind.links():
        if link.write_field not in before:
            continue
        added = set(sent.get(link.write_field, [])) - before[link.write_field]
        if not added:
            continue
        for entry in link.catalogue._default_manager.filter(id__in=added):
            entry_type = entry.type or DEFAULT_ENTRY_TYPE[link.target]
            payload = {"hero": unit_name, link.target: entry.name, f"{link.target}_type": entry_type}
            log_warband_event(warband.id, "loadout", str(link.log_entry), payload)


def save_update(kind: "UnitKindSpec", warband: Warband, writer: "UnitWriteSerializer", *, sent: Any) -> None:
    """Inside the caller's transaction: save a validated update serializer, log loadout additions, charge recruits."""
    unit = cast(RosterUnit, writer.instance)
    before = _logged_ids_before(kind, unit, sent)
    writer.save()
    _log_loadout_additions(kind, warband, unit, before, sent)
    recruits = writer.recruits
    if recruits:
        kind.hooks.record_recruits(warband, unit, list(recruits))


def update_unit(kind: "UnitKindSpec", warband: Warband, writer: "UnitWriteSerializer", *, sent: Any) -> None:
    """PATCH one unit in its own transaction."""
    with transaction.atomic():
        save_update(kind, warband, writer, sent=sent)
