"""Creatures recruited into henchmen from their Animal item (the bestiary rewrite step 4).

`POST warbands/<id>/beasts/recruit/` takes copies of a creature's Animal item out of a unit's items or the stash and
makes them members of a new henchmen group, or of a group already recruited from the same beast. No gold moves and no
RECRUIT row is written: the creature was paid for as an item. A new group takes the beast's profile (stats, save,
large, skills and specials as the campaign's current entries; `unit_type` is its name; `no_level_ups` unless it gains
XP), the race the body names (none by default), and its price from the copies' cost (the first copy taken; the item's
current price when that isn't known), so a member can go back to an item at the same value. A fixed number of
queries whatever the quantity.
"""

from dataclasses import dataclass
from typing import Any

from django.db import transaction

from apps.bestiary.models import CREATURE, BestiaryEntry, BestiaryEntrySkill, BestiaryEntrySpecial
from apps.items.models import Item
from apps.logs.utils import log_warband_event
from apps.warbands.models import Henchman, HenchmenGroup, Warband
from apps.warbands.models.shared import STAT_FIELDS
from apps.warbands.serializers import UNIT_SERIALIZERS
from apps.warbands.services import economy_log
from apps.warbands.services.prices import CampaignPrices
from apps.warbands.services.stash import ANY_COST, StashEntry, StashTake, remove_from_stash
from apps.warbands.services.summary import WarbandUnits
from apps.warbands.services.unit_items import resolve_unit, take_unit_copies, touch_unit
from apps.warbands.units.catalogue_scope import current_entry
from apps.warbands.units.companions import Warning, beast_of
from apps.warbands.units.errors import RosterError, validation_error
from apps.warbands.units.kinds import HENCHMEN_GROUP

STASH = "stash"
NOT_A_CREATURE = "Only a creature is recruited into henchmen; switch a mount or a pet on for the unit holding it."
NOT_THE_SAME_BEAST = "That group wasn't recruited from this beast: join a group of the same beast, or form a new one."


@dataclass(frozen=True)
class Target:
    """Where recruited copies go: an existing group of the same beast, or a new group (`name`, `race`: as sent)."""

    group: HenchmenGroup | None = None
    name: str = ""
    race: Any = None


def creature(item: Item) -> BestiaryEntry:
    """The creature whose Animal item `item` is; 400 `not_a_creature` for anything else."""
    beast: BestiaryEntry | None = beast_of(item)
    if beast is None or beast.kind != CREATURE:
        raise RosterError(NOT_A_CREATURE, "not_a_creature", {"source.item_id": [NOT_A_CREATURE]})
    return beast


def resolve_target(warband: Warband, beast: BestiaryEntry, data: dict[str, Any], key: str = "target") -> Target:
    """The validated target body as a Target: a group must be on the warband's roster (404) and recruited from the
    same beast (400 `not_the_same_beast`)."""
    if "group_id" not in data:
        new = data.get("new") or {}
        return Target(name=new.get("name", ""), race=new.get("race_id"))
    units = HENCHMEN_GROUP.visible(HenchmenGroup.objects.filter(id=data["group_id"], warband=warband))
    group = units.first()
    if group is None:
        raise RosterError(
            "Henchmen group not found.", "not_found", {f"{key}.group_id": ["Not found."]}, status_code=404
        )
    if group.source_beast_id != beast.pk:
        raise RosterError(NOT_THE_SAME_BEAST, "not_the_same_beast", {f"{key}.group_id": [NOT_THE_SAME_BEAST]})
    return Target(group=group)


def _group_body(beast: BestiaryEntry, target: Target, price: int, quantity: int) -> dict[str, Any]:
    """The henchmen group create body the beast makes (the generic create serializer maps its ids to the campaign's
    current entries and checks the race)."""
    skills = BestiaryEntrySkill.objects.filter(bestiary_entry=beast).order_by("id").values_list("skill_id", flat=True)
    specials = BestiaryEntrySpecial.objects.filter(bestiary_entry=beast).order_by("id")
    return {
        "name": (target.name or "").strip()[:120] or beast.name[:120],
        "unit_type": beast.name[:80],
        "race": target.race,
        "price": price,
        "no_level_ups": not beast.gains_xp,
        "large": beast.large,
        **{name: getattr(beast, name) for name in STAT_FIELDS},
        "armour_save": beast.armour_save,
        "skill_ids": list(skills),
        "special_ids": list(specials.values_list("special_id", flat=True)),
        "henchmen": [{"name": ""} for _ in range(quantity)],
    }


def _price(warband: Warband, item: Item, costs: list[int | None]) -> int:
    known = next((cost for cost in costs if cost is not None), None)
    if known is not None:
        return known
    return CampaignPrices(warband.campaign_id).current(item) or 0


def _new_group(warband: Warband, beast: BestiaryEntry, item: Item, costs: list[int | None], target: Target) -> Any:
    """The group the copies form, made through the generic create serializer (a bad race is a 400 on `target.new`)."""
    body = _group_body(beast, target, _price(warband, item, costs), len(costs))
    writer = UNIT_SERIALIZERS[HENCHMEN_GROUP.key].create(data=body, context={"campaign_id": warband.campaign_id})
    if not writer.is_valid():
        raise validation_error(writer.errors, "target.new")
    group = writer.save(warband=warband, source_beast=beast)
    formed = {"name": group.name, "type": group.unit_type}
    log_warband_event(warband.id, "personnel", HENCHMEN_GROUP.recruit.log_new, formed)
    return group


def recruit_copies(
    warband: Warband,
    beast: BestiaryEntry,
    item: Item,
    costs: list[int | None],
    target: Target,
    source: tuple[str, str | None],
) -> HenchmenGroup:
    """Inside the caller's transaction: the copies (one per cost, already taken from `source`) become members of the
    target group, or of a new group. No ledger row; the move into the group is logged (and a new group's forming)."""
    group: HenchmenGroup
    if target.group is not None:
        group = target.group
        Henchman.objects.bulk_create(Henchman(group=group, name="") for _ in costs)
        touch_unit(HENCHMEN_GROUP.key, group)
    else:
        group = _new_group(warband, beast, item, costs, target)
    moved_to = (HENCHMEN_GROUP.key, economy_log.unit_name(HENCHMEN_GROUP.key, group))
    economy_log.log_move(warband, item.name, len(costs), source, moved_to)
    return group


@dataclass
class Recruited:
    group: HenchmenGroup
    item: Item
    source_type: str  # "stash" or the unit's kind
    source_unit: Any = None  # the unit the copies left, or None for the stash
    stash: StashEntry | None = None  # what is left of the item in the stash (a stash source)


def _taken(
    warband: Warband, item: Item, source: dict[str, Any], unit: Any, quantity: int
) -> StashTake | list[int | None]:
    """Take the copies out of the stash (newest row first, or of the cost sent) or the unit (its companions last);
    400 `not_enough` when there are fewer."""
    try:
        if unit is None:
            cost = source["cost"] if "cost" in source else ANY_COST
            return remove_from_stash(warband.id, item.id, quantity, cost)
        return take_unit_copies(source["type"], unit, item.id, quantity)
    except ValueError:  # StashShortage too
        message = f"There are fewer than {quantity} {item.name} to recruit there."
        raise RosterError(message, "not_enough", {"quantity": [message]}) from None


def recruit_beasts(warband: Warband, data: dict[str, Any]) -> Recruited:
    """POST beasts/recruit/ with a validated body: everything is checked before anything is taken (the item is the
    campaign's current one, a creature; the source unit and the target group are on the roster), then one
    transaction takes the copies and recruits them."""
    source, quantity = data["source"], data["quantity"]
    item = current_entry(Item.objects.select_related("bestiary_entry"), source["item_id"], warband.campaign_id)
    if item is None:
        raise RosterError("Item not found.", "not_found", {"source.item_id": ["Item not found."]}, status_code=404)
    beast = creature(item)
    target = resolve_target(warband, beast, data["target"])
    unit = None if source["type"] == STASH else resolve_unit(warband, source["type"], source.get("id"), "Source")
    with transaction.atomic():
        taken = _taken(warband, item, source, unit, quantity)
        costs = taken.costs if isinstance(taken, StashTake) else taken
        moved_from = (source["type"], economy_log.unit_name(source["type"], unit))
        group = recruit_copies(warband, beast, item, costs, target, moved_from)
    stash = taken.remaining if isinstance(taken, StashTake) else None
    return Recruited(group, item, source["type"], unit, stash)


def size_warnings(warband: Warband, group: dict[str, Any], units: WarbandUnits) -> list[Warning]:
    """A group (its payload) over its maximum size, a warband over its size: warned, never refused (decision 12)."""
    warnings: list[Warning] = []
    members, most = len(group["henchmen"]), group["max_size"]
    if members > most:
        message = f"{group['name']} has {members} members; its maximum is {most}."
        warnings.append({"code": "group_over_size", "message": message, "members": members, "max_size": most})
    if units.unit_count > warband.max_units:
        message = f"The warband has {units.unit_count} models; its maximum is {warband.max_units}."
        sizes = {"units": units.unit_count, "max_units": warband.max_units}
        warnings.append({"code": "warband_over_size", "message": message, **sizes})
    return warnings
