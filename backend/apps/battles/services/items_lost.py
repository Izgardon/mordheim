"""A unit that dies loses what he carries (pass 2 decision 7, BATL-TWEAK-08).

A dead hero or hired sword keeps his items on his record, out of the warband's reach (dead units are off the
roster). A henchman's group carries its items for all its members, so each henchman who dies takes one copy of each
of the group's items with him (the first row of each, as a promoted henchman takes his share). The battle log lists
what was lost.
"""

from typing import Any

from apps.warbands.models import HenchmenGroup, HenchmenGroupItem


def henchman_takes_his_share(group: HenchmenGroup) -> list[str]:
    """Remove one copy of each item the group carries, for a member who died; returns the items' names."""
    share: dict[int, HenchmenGroupItem] = {}
    for row in HenchmenGroupItem.objects.filter(henchmen_group=group).select_related("item").order_by("id"):
        share.setdefault(row.item_id, row)
    HenchmenGroupItem.objects.filter(id__in=[row.id for row in share.values()]).delete()
    return [row.item.name for row in share.values()]


def carried_item_names(unit: Any) -> list[str]:
    """What a dead hero or hired sword carries (it stays on his record)."""
    links = unit.hero_items if hasattr(unit, "hero_items") else unit.hired_sword_items
    return list(links.order_by("id").values_list("item__name", flat=True))


def lost_entry(unit_name: str, items: list[str]) -> dict[str, Any] | None:
    return {"unit_name": unit_name, "items": items} if items else None
