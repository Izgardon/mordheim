"""A creature group's members back to their Animal item (the bestiary rewrite step 4).

`POST warbands/<id>/henchmen-groups/<id>/back-to-item/ {"member_ids": [...]} | {"count": n}` turns living members of a
group recruited from a creature back into copies of the beast's Animal item, in the stash at the group's price (what
recruiting set it from). The members leave the group as records (dismissed, their kills kept); `count` takes the
newest first. The group goes with its last member, dismissed as any group is, and whatever it still carried goes to
the stash with its costs rather than being lost. No gold moves and no ledger row is written. A fixed number of queries
whatever the number of members.
"""

from dataclasses import dataclass, field
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.items.models import Item
from apps.warbands.models import Henchman, HenchmenGroup, HenchmenGroupItem, Warband, on_roster
from apps.warbands.services import economy_log
from apps.warbands.services.stash import add_costs, add_to_stash
from apps.warbands.units.errors import RosterError
from apps.warbands.units.kinds import HENCHMEN_GROUP

from .dismiss import dismiss

NOT_FROM_A_BEAST = "Only a group recruited from a creature goes back to an item."
NO_ITEM = "This group's beast has no item to go back to; edit the beast in the bestiary to give it one."


@dataclass
class BackToItem:
    group: HenchmenGroup | None  # None when its last member went
    item_ids: list[int] = field(default_factory=list)  # every item that landed in the stash, the Animal item first


def _refused(field_name: str, message: str, code: str = "invalid") -> RosterError:
    return RosterError(message, code, {field_name: [message]})


def _animal_item(group: HenchmenGroup) -> Item:
    if group.source_beast_id is None:
        raise _refused("group", NOT_FROM_A_BEAST, "not_from_a_beast")
    item = Item.objects.filter(bestiary_entry_id=group.source_beast_id).first()
    if item is None:
        raise _refused("group", NO_ITEM, "no_animal_item")
    return item


def _leaving(living: list[int], data: dict[str, Any]) -> list[int]:
    """The members the body names (each a living member of the group), or the newest `count`."""
    if "member_ids" in data:
        wanted = list(dict.fromkeys(data["member_ids"]))
        strangers = [member_id for member_id in wanted if member_id not in living]
        if strangers:
            raise _refused("member_ids", f"Not living members of this group: {', '.join(map(str, strangers))}.")
        return wanted
    if data["count"] > len(living):
        raise _refused("count", f"The group has {len(living)} living members.")
    return sorted(living, reverse=True)[: data["count"]]


def _empty(warband: Warband, group: HenchmenGroup) -> list[int]:
    """The group lost its last member: its carried items go to the stash with their costs, then it is dismissed."""
    rows = HenchmenGroupItem.objects.filter(henchmen_group=group).order_by("id")
    carried = list(rows.values_list("id", "item_id", "item__name", "cost"))
    costs: dict[tuple[int, str], list[int | None]] = {}
    for _row_id, item_id, name, cost in carried:
        costs.setdefault((item_id, name), []).append(cost)
    HenchmenGroupItem.objects.filter(id__in=[row[0] for row in carried]).delete()
    source = (HENCHMEN_GROUP.key, economy_log.unit_name(HENCHMEN_GROUP.key, group))
    for (item_id, name), item_costs in costs.items():
        add_costs(warband.id, item_id, item_costs)
        economy_log.log_move(warband, name, len(item_costs), source, ("stash", None))
    dismiss(HENCHMEN_GROUP, warband, group)
    return [item_id for item_id, _name in costs]


def back_to_item(warband: Warband, group: HenchmenGroup, data: dict[str, Any]) -> BackToItem:
    """Inside one transaction: the members leave (a guarded update: two requests can't both turn one member back), the
    copies land in the stash, and the move is logged."""
    item = _animal_item(group)
    with transaction.atomic():
        living = list(on_roster(Henchman.objects.filter(group=group)).values_list("id", flat=True))
        leaving = _leaving(living, data)
        left = on_roster(Henchman.objects.filter(group=group, id__in=leaving)).update(dismissed_at=timezone.now())
        if left != len(leaving):
            message = "Those members just left the group; reload it and try again."
            raise RosterError(message, "members_changed", {"member_ids": [message]}, status_code=409)
        add_to_stash(warband.id, item.id, len(leaving), group.price)
        source = (HENCHMEN_GROUP.key, economy_log.unit_name(HENCHMEN_GROUP.key, group))
        economy_log.log_move(warband, item.name, len(leaving), source, ("stash", None))
        if len(leaving) == len(living):
            gear = _empty(warband, group)
            return BackToItem(None, [item.id, *(item_id for item_id in gear if item_id != item.id)])
        HenchmenGroup.objects.filter(pk=group.pk).update(updated_at=timezone.now())
    return BackToItem(group, [item.id])
