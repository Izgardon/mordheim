"""Everything finalise reads before it writes, locked and read once (PERF-36).

The rows are locked in the battle lock order (services/locks.py): the warband, then its heroes, the hired swords the
draft names, the henchmen of the groups it names and those groups; the battle row is not held. Each unit comes with
the names of what it carries (for a unit that dies here), the warband with the draft's exploration resource, and the
battle's live kill events and the player's own item uses come in one read.
"""

from dataclasses import dataclass, field
from typing import Any

from django.contrib.postgres.expressions import ArraySubquery
from django.db.models import Exists, OuterRef, Q, Subquery

from apps.campaigns.models import CampaignSettings
from apps.warbands.models import (
    Henchman,
    HenchmenGroup,
    Hero,
    HeroItem,
    Hireling,
    HirelingItem,
    Warband,
    WarbandResource,
)

from ...models import Battle, BattleEvent, BattleParticipant
from ...validation.unit_keys import parse_unit_key
from ..kills import count_kills
from ..locks import locked
from .validate import upkeep_hired_sword_ids


@dataclass
class FinaliseContext:
    battle: Battle
    participant: BattleParticipant
    settings: CampaignSettings | None
    warband: Warband
    resource_found: bool
    resource_name: str | None
    heroes: list[Hero]  # every hero of the warband, in id order (the crown is chosen among them)
    hired_swords: dict[int, Hireling]  # those the draft names, as results or upkeep
    henchmen: list[Henchman]  # every member of the groups the draft names
    groups: dict[int, HenchmenGroup]
    kills: dict[str, int] = field(default_factory=dict)  # live kills per unit key of the warband (decision 5)
    item_uses: list[Any] = field(default_factory=list)  # the player's live item_used payloads (BUG-72)

    def hero(self, unit_id: int) -> Hero | None:
        """A hero of the results, unless he was dismissed since the battle started (BUG-73)."""
        return next((hero for hero in self.heroes if hero.id == unit_id and hero.dismissed_at is None), None)


def campaign_settings(battle: Battle) -> CampaignSettings | None:
    """The campaign's settings, read with the battle (select_related "campaign__settings") or on their own."""
    return getattr(battle.campaign, "settings", None)


def _ids(draft: dict, unit_type: str) -> list[int]:
    keys = (parse_unit_key(unit_key) for unit_key in draft["unit_results"])
    return [parsed["unit_id"] for parsed in keys if parsed["unit_type"] == unit_type]


def _locked_warband(warband_id: int, resource_id: int | None) -> Warband:
    """The warband, locked, with the draft's exploration resource (`resource_found`, `resource_name`)."""
    warbands = locked(Warband.objects.all())
    if resource_id is not None:
        resources = WarbandResource.objects.filter(id=resource_id, warband_id=OuterRef("pk"))
        warbands = warbands.annotate(
            resource_found=Exists(resources), resource_name=Subquery(resources.values("name")[:1])
        )
    return warbands.get(id=warband_id)


def _carried(links) -> ArraySubquery:
    return ArraySubquery(links.order_by("id").values("item__name"))


def _locked_units(warband_id: int, draft: dict) -> tuple[list[Hero], dict[int, Hireling], list[Henchman]]:
    heroes = locked(Hero.objects.filter(warband_id=warband_id).order_by("id"))
    heroes = heroes.annotate(carried=_carried(HeroItem.objects.filter(hero_id=OuterRef("pk"))))
    sword_ids = {*_ids(draft, "hired_sword"), *upkeep_hired_sword_ids(draft)}
    swords = locked(Hireling.objects.filter(id__in=sword_ids, warband_id=warband_id))
    swords = swords.annotate(carried=_carried(HirelingItem.objects.filter(hireling_id=OuterRef("pk"))))
    named_groups = Henchman.objects.filter(id__in=_ids(draft, "henchman")).values("group_id")
    henchmen = locked(
        Henchman.objects.select_related("group")
        .filter(group_id__in=named_groups, group__warband_id=warband_id)
        .order_by("id")
    )
    return list(heroes), {sword.id: sword for sword in swords}, list(henchmen)


def load_context(battle: Battle, participant: BattleParticipant, draft: dict) -> FinaliseContext:
    """Lock and read what finalising this draft touches (the participant is locked already)."""
    warband = _locked_warband(participant.warband_id, draft["exploration"].get("resource_id"))
    heroes, hired_swords, henchmen = _locked_units(participant.warband_id, draft)
    named = set(_ids(draft, "henchman"))
    group_ids = {
        member.group_id
        for member in henchmen
        if member.id in named and member.dismissed_at is None and member.group.dismissed_at is None
    }
    groups = locked(
        HenchmenGroup.objects.filter(id__in=group_ids, warband_id=participant.warband_id, dismissed_at__isnull=True)
    )
    locked_groups = {group.id: group for group in groups}
    events = BattleEvent.objects.filter(battle_id=battle.id, voided_at__isnull=True).filter(
        Q(type=BattleEvent.TYPE_UNIT_KILL_RECORDED)
        | Q(type=BattleEvent.TYPE_ITEM_USED, actor_user_id=participant.user_id)
    )
    rows = list(events.values_list("type", "payload_json"))
    kills = [payload for kind, payload in rows if kind == BattleEvent.TYPE_UNIT_KILL_RECORDED]
    return FinaliseContext(
        battle=battle,
        participant=participant,
        settings=campaign_settings(battle),
        warband=warband,
        resource_found=bool(getattr(warband, "resource_found", False)),
        resource_name=getattr(warband, "resource_name", None),
        heroes=heroes,
        hired_swords=hired_swords,
        henchmen=henchmen,
        groups=locked_groups,
        kills=dict(count_kills(kills, participant.warband_id)),
        item_uses=[payload for kind, payload in rows if kind == BattleEvent.TYPE_ITEM_USED],
    )
