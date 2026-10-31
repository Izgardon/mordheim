"""What a warband can usually buy, hire and learn, for `GET warbands/<id>/who-can/` (the items rebuild): the pages
show it and decide nothing. The rules are `who_can.py`'s; this reads the campaign's current entries of each kind (its
own and the book's it hasn't replaced or removed, as its catalogue lists show them) in a fixed number of queries:
the items with their settings, then their price rows, then the rows' who-can lines; each hireling kind with its
setting, then its lines; the special skills (a skill not for everyone), then their lines. A special skill several
lists share by name (Infiltration: Skaven, Dark Elf, Skink...) is offered once, from the list named most like the
warband's type.
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


def _list_fit(skill: Any, buyer: Buyer) -> int:
    """0 when the skill's list is named as the buyer's type ("Skaven"), 1 when one name holds the other ("Skaven
    Metal Mongers"), else 2."""
    ours, theirs = str(skill.type or "").strip().lower(), buyer.name.strip().lower()
    if ours == theirs:
        return 0
    return 1 if ours and (ours in theirs or theirs in ours) else 2


def _special_skills(campaign_id: int, buyer: Buyer) -> list[int]:
    from apps.core.catalogue.kinds import SKILLS

    skills = _current(SKILLS, campaign_id).filter(for_everyone=False).prefetch_related("warband_links")
    best: dict[str, tuple[int, int, int]] = {}
    for skill in skills:
        at = step(False, skill.warband_links.all(), buyer)
        if at not in (1, 2):
            continue
        key = (at, _list_fit(skill, buyer), skill.pk)
        name = str(skill.name).strip().lower()
        best[name] = min(best.get(name, key), key)
    return sorted(key[2] for key in best.values())


def who_can(warband: Warband) -> dict[str, Any]:
    """`{items: [{item_id, availability_id, options, can_buy, reason}], hired_swords: [{id, can_hire, reason}],
    dramatis_personae: [...], special_skill_ids: [...]}`."""
    from apps.core.catalogue.kinds import DRAMATIS_PERSONAE, HIRED_SWORDS

    buyer, campaign_id = buyer_of(warband), warband.campaign_id
    return {
        "items": _items(campaign_id, buyer),
        "hired_swords": _hirelings(HIRED_SWORDS, campaign_id, buyer),
        "dramatis_personae": _hirelings(DRAMATIS_PERSONAE, campaign_id, buyer),
        "special_skill_ids": _special_skills(campaign_id, buyer),
    }
