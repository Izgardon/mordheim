"""Everything finalise reads before it writes, locked and read once (PERF-36).

The rows are locked in the battle lock order (services/locks.py): the warband, then its heroes, the hired swords the
draft names, the henchmen of the groups it names and those groups; the battle row is not held. Each unit comes with
the names of what it carries (for a unit that dies here), the warband with the draft's exploration resource and
whether any unit of it misses games and its live kills in the battle (battle_kill, next step 9), and the player's
own item uses come in one read.
"""

from dataclasses import dataclass, field
from typing import Any

from django.contrib.postgres.expressions import ArraySubquery
from django.db.models import Exists, OuterRef, Subquery

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
    on_roster,
)

from ...models import Battle, BattleEvent, BattleParticipant
from ...validation.unit_keys import parse_unit_key
from ..kills import count_killers, live_killers
from ..locks import locked
from .validate import upkeep_hireling_ids


@dataclass
class FinaliseContext:
    battle: Battle
    participant: BattleParticipant
    settings: CampaignSettings | None
    warband: Warband
    resource_id: int | None  # the draft's exploration resource, else the warband's default resource
    resource_found: bool
    resource_name: str | None
    has_missing: bool  # a unit of the warband misses games: finalise counts this battle off (missing.py)
    heroes: list[Hero]  # every hero of the warband, in id order (the crown is chosen among them)
    hirelings: dict[int, Hireling]  # those the draft names, as results or upkeep
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


MISSING_UNITS: dict[str, Any] = {"missing_heroes": Hero, "missing_groups": HenchmenGroup, "missing_hirelings": Hireling}


def _locked_warband(battle_id: int, warband_id: int, resource_id: int | None) -> Warband:
    """The warband, locked, with the draft's exploration resource, else its default resource (`resource_pk`,
    `resource_name`), whether any of its units misses games (one per kind), so a finalise without them reads none, and
    its live kills in the battle (`killers`, battle_kill)."""
    missing = {
        name: Exists(on_roster(model.objects.filter(warband_id=OuterRef("pk"), missing_games__gt=0)))
        for name, model in MISSING_UNITS.items()
    }
    resources = WarbandResource.objects.filter(warband_id=OuterRef("pk"))
    resources = resources.filter(id=resource_id) if resource_id is not None else resources.filter(is_default=True)
    warbands = locked(
        Warband.objects.annotate(
            **missing,
            killers=live_killers(battle_id, OuterRef("pk")),
            resource_pk=Subquery(resources.values("id")[:1]),
            resource_name=Subquery(resources.values("name")[:1]),
        )
    )
    return warbands.get(id=warband_id)


def _carried(links) -> ArraySubquery:
    return ArraySubquery(links.order_by("id").values("item__name"))


def _locked_units(warband_id: int, draft: dict) -> tuple[list[Hero], dict[int, Hireling], list[Henchman]]:
    heroes = locked(Hero.objects.filter(warband_id=warband_id).order_by("id"))
    heroes = heroes.annotate(carried=_carried(HeroItem.objects.filter(hero_id=OuterRef("pk"))))
    sword_ids = {*_ids(draft, "hireling"), *upkeep_hireling_ids(draft)}
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
    warband = _locked_warband(battle.id, participant.warband_id, draft["exploration"].get("resource_id"))
    heroes, hirelings, henchmen = _locked_units(participant.warband_id, draft)
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
    item_uses = BattleEvent.objects.filter(
        battle_id=battle.id, voided_at__isnull=True, type=BattleEvent.TYPE_ITEM_USED, actor_user_id=participant.user_id
    )
    return FinaliseContext(
        battle=battle,
        participant=participant,
        settings=campaign_settings(battle),
        warband=warband,
        resource_id=getattr(warband, "resource_pk", None),
        resource_found=getattr(warband, "resource_pk", None) is not None,
        resource_name=getattr(warband, "resource_name", None),
        has_missing=any(getattr(warband, name) for name in MISSING_UNITS),
        heroes=heroes,
        hirelings=hirelings,
        henchmen=henchmen,
        groups=locked_groups,
        kills=dict(count_killers(getattr(warband, "killers", None))),
        item_uses=list(item_uses.values_list("payload_json", flat=True)),
    )
