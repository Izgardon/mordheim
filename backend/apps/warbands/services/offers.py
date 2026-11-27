"""What a warband can usually buy, hire and learn, for `GET warbands/<id>/who-can/` (the items rebuild): the pages
show it and decide nothing. The rules are `who_can.py`'s; this reads the campaign's current entries of each kind (its
own and the book's it hasn't replaced or removed, as its catalogue lists show them) in a fixed number of queries:
the items with their settings, then their price rows, then the rows' who-can lines; each hireling kind with its
setting, then its lines; the skill groups (skill groups phase 1a), then their lines, then their skills. A group is
open to the warband when its lines let it in (its type, its group, or everyone); the skills of a group not for
everyone that names the warband's type or group are its special skills (a skill is learnable by whoever has a group
holding it). The warband's own template lists are read too (two queries: its template, then its lines' items for
its variant), so an item its own list sells is one it may buy whatever the price rows name (`who_can.py`, step 4);
Gromril and Ithilmar Armour ride on a list that sells Heavy Armour, which they count as (William, 20 Nov 2026).
"""

from collections.abc import Sequence
from dataclasses import replace
from typing import Any

from django.db.models import Model, Prefetch, QuerySet

from apps.campaigns.in_play import with_in_play
from apps.core.catalogue.merge import campaign_list
from apps.items.materials import COUNTS_AS_ITEMS
from apps.items.models import ItemAvailability
from apps.warbands.models import Warband

from .materials import material_offers
from .who_can import Buyer, access, buyer_of, offer, on_his_list, step


def _current(kind: Any, campaign_id: int) -> QuerySet[Any]:
    """The campaign's current entries of a kind, with their setting and whether it is in play."""
    rows: QuerySet[Any] = campaign_list(kind, kind.model._default_manager.all(), campaign_id)
    return with_in_play(rows.select_related("campaign_type"), campaign_id).order_by("id")


def _setting(entry: Model) -> str:
    setting = getattr(entry, "campaign_type", None)
    return str(setting.name) if setting is not None else "Its setting"


def current_items(campaign_id: int) -> list[Any]:
    """The campaign's current items with their price rows (each saying whether its own setting, where it has one, is
    in play: `who_can.offer`) and the rows' who-can lines (three queries)."""
    from apps.core.catalogue.kinds import ITEMS  # the registry imports the warbands app

    rows = with_in_play(ItemAvailability.objects.order_by("id"), campaign_id).prefetch_related("warband_links")
    return list(_current(ITEMS, campaign_id).prefetch_related(Prefetch("availabilities", queryset=rows)))


def item_offers(campaign_id: int, buyer: Buyer, items: Sequence[Any] | None = None) -> list[dict[str, Any]]:
    """Each of the campaign's current items' offer to the buyer (a warband, or a template's types: the editor)."""
    rows = items if items is not None else current_items(campaign_id)
    counted = counts_as_ids(rows)
    offers = (offer(item, buyer, item.in_play, _setting(item)) for item in rows)
    return [replace(found, counts_as=counted.get(found.item_id, ())).payload() for found in offers if found is not None]


def counts_as_ids(items: Sequence[Any]) -> dict[int, tuple[int, ...]]:
    """For each item in play that counts as another on a unit's own list (`COUNTS_AS_ITEMS`), that item's ids (its
    own, and the book's a campaign's version stands in for): Gromril and Ithilmar Armour count as Heavy Armour, so the
    store's Their list offers them to a hero whose list sells it (William, 22 Nov 2026), while the settings in play
    still apply. No extra query: these are the items already read."""
    ids_of: dict[str, list[int]] = {}
    for item in items:
        for name in COUNTS_AS_ITEMS.get(item.name, ()):
            ids_of.setdefault(name, []).extend(pk for pk in (item.pk, getattr(item, "replaces_id", None)) if pk)
    return {item.pk: tuple(ids_of[item.name]) for item in items if item.name in ids_of and item.in_play}


def counts_as_sold(items: Sequence[Any], sells: frozenset[int]) -> frozenset[int]:
    """The items a warband's own template lists sell, with the ones that count as one of them (`COUNTS_AS_ITEMS`:
    Gromril and Ithilmar Armour count as heavy armour, William 20 Nov 2026, so a list selling Heavy Armour admits
    them in the store). No extra query: these are the items already read."""
    wanted = {name for item in items if on_his_list(item, sells) for name in COUNTS_AS_ITEMS.get(item.name, ())}
    if not wanted:
        return sells
    return sells | frozenset(item.pk for item in items if item.name in wanted)


def _hirelings(kind: Any, campaign_id: int, buyer: Buyer) -> list[dict[str, Any]]:
    entries = _current(kind, campaign_id).prefetch_related("warband_links")
    return [access(entry, buyer, entry.in_play, _setting(entry)) for entry in entries]


def _skill_groups(campaign_id: int, buyer: Buyer) -> tuple[list[int], list[int]]:
    """The campaign's current skill groups open to the buyer (in their order), and the skills of those not for
    everyone that name its type or group (its special skills, as the campaign's current entries)."""
    from apps.core.catalogue.kinds import SKILL_GROUPS
    from apps.skills.models import SkillGroup
    from apps.skills.selectors import current_skill_id, group_skills, in_group_order

    rows = campaign_list(SKILL_GROUPS, SkillGroup.objects.all(), campaign_id)
    groups = in_group_order(rows).prefetch_related("warband_links", group_skills(campaign_id))
    open_ids: list[int] = []
    special: set[int] = set()
    for group in groups:
        at = step(group.for_everyone, group.warband_links.all(), buyer)
        if at is None:
            continue
        open_ids.append(group.pk)
        if not group.for_everyone and at in (1, 2):
            special |= {current_skill_id(link) for link in group.skill_links.all()}
    return open_ids, sorted(special)


def who_can(warband: Warband) -> dict[str, Any]:
    """`{items: [{item_id, availability_id, options, can_buy, reason}], hired_swords: [{id, can_hire, reason}],
    dramatis_personae: [...], skill_group_ids: [...], special_skill_ids: [...],
    materials: [{slug, name, rarity, rules, can_take, reason, limit}]}` (weapon materials: three queries)."""
    from apps.core.catalogue.kinds import DRAMATIS_PERSONAE, HIRED_SWORDS
    from apps.warband_templates.services.resolve import list_item_ids  # it reads the warbands app

    campaign_id = warband.campaign_id
    items = current_items(campaign_id)
    buyer = replace(buyer_of(warband), sells=counts_as_sold(items, list_item_ids(warband)))
    group_ids, special_ids = _skill_groups(campaign_id, buyer)
    return {
        "items": item_offers(campaign_id, buyer, items),
        "hired_swords": _hirelings(HIRED_SWORDS, campaign_id, buyer),
        "dramatis_personae": _hirelings(DRAMATIS_PERSONAE, campaign_id, buyer),
        "skill_group_ids": group_ids,
        "special_skill_ids": special_ids,
        "materials": material_offers(campaign_id, buyer, items),
    }
