"""What a warband can usually buy, hire and learn, for `GET warbands/<id>/who-can/` (the items rebuild): the pages
show it and decide nothing. The rules are `who_can.py`'s; this reads the campaign's current entries of each kind (its
own and the book's it hasn't replaced or removed, as its catalogue lists show them) in a fixed number of queries:
the items with their settings, then their price rows, then the rows' who-can lines; each hireling kind with its
setting, then its lines; the skill groups (skill groups phase 1a), then their lines, then their skills. A group is
open to the warband when its lines let it in (its type, its group, or everyone); the skills of a group not for
everyone that names the warband's type or group are its special skills (a skill is learnable by whoever has a group
holding it).
"""

from typing import Any

from django.db.models import Model, Prefetch, QuerySet

from apps.campaigns.in_play import with_in_play
from apps.core.catalogue.merge import campaign_list
from apps.items.models import ItemAvailability
from apps.warbands.models import Warband

from .who_can import Buyer, access, buyer_of, offer, step


def _current(kind: Any, campaign_id: int) -> QuerySet[Any]:
    """The campaign's current entries of a kind, with their setting and whether it is in play."""
    rows: QuerySet[Any] = campaign_list(kind, kind.model._default_manager.all(), campaign_id)
    return with_in_play(rows.select_related("campaign_type"), campaign_id).order_by("id")


def _setting(entry: Model) -> str:
    setting = getattr(entry, "campaign_type", None)
    return str(setting.name) if setting is not None else "Its setting"


def _items(campaign_id: int, buyer: Buyer) -> list[dict[str, Any]]:
    from apps.core.catalogue.kinds import ITEMS  # the registry imports the warbands app

    rows = ItemAvailability.objects.order_by("id").prefetch_related("warband_links")
    items = _current(ITEMS, campaign_id).prefetch_related(Prefetch("availabilities", queryset=rows))
    offers = (offer(item, buyer, item.in_play, _setting(item)) for item in items)
    return [found.payload() for found in offers if found is not None]


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
    dramatis_personae: [...], skill_group_ids: [...], special_skill_ids: [...]}`."""
    from apps.core.catalogue.kinds import DRAMATIS_PERSONAE, HIRED_SWORDS

    buyer, campaign_id = buyer_of(warband), warband.campaign_id
    group_ids, special_ids = _skill_groups(campaign_id, buyer)
    return {
        "items": _items(campaign_id, buyer),
        "hired_swords": _hirelings(HIRED_SWORDS, campaign_id, buyer),
        "dramatis_personae": _hirelings(DRAMATIS_PERSONAE, campaign_id, buyer),
        "skill_group_ids": group_ids,
        "special_skill_ids": special_ids,
    }
