"""What a claimant can put to a bounty (Claim): suggestions from the record, his units and his battles.

The suggestions are his warband's live kills of the target since the bounty was posted (battle_kill), and the battles
since then in which the target ended out of action against his warband with no kill of his recorded: the claim then
names the unit itself. They are suggestions only: a claim may name any of his units, with or without a battle.
"""

from typing import Any

from django.db.models import Q, QuerySet

from apps.battles.models import Battle, BattleKill, BattleParticipant
from apps.campaigns.selectors import format_short_date
from apps.warbands.models import HenchmenGroup, Hero, Hireling, not_dismissed

from .models import Bounty

MAX_BATTLES = 20


def _since(bounty: Bounty, prefix: str = "") -> Q:
    """A battle that began or ended after the bounty was posted."""
    return Q(**{f"{prefix}created_at__gte": bounty.created_at}) | Q(**{f"{prefix}ended_at__gte": bounty.created_at})


def kill_candidates(bounty: Bounty, warband_id: int) -> QuerySet[BattleKill]:
    """His warband's live kills of the target since the bounty was posted, newest first (one query)."""
    if bounty.target_hero_id is None:
        return BattleKill.objects.none()
    kills = BattleKill.objects.filter(
        victim_hero_id=bounty.target_hero_id,
        killer_warband_id=warband_id,
        voided_at__isnull=True,
        created_at__gte=bounty.created_at,
    )
    return kills.exclude(battle__status=Battle.STATUS_CANCELED).select_related("battle").order_by("-created_at", "-id")


def out_of_action_battles(bounty: Bounty, warband_id: int) -> QuerySet[Battle]:
    """Battles since the bounty was posted, against his warband, that the target ended out of action (one query)."""
    if bounty.target_hero_id is None or bounty.target_warband_id is None:
        return Battle.objects.none()
    out = BattleParticipant.objects.filter(
        warband_id=bounty.target_warband_id,
        **{f"unit_information_json__hero:{bounty.target_hero_id}__out_of_action": True},
    )
    battles = Battle.objects.filter(campaign_id=bounty.campaign_id, participants__warband_id=warband_id)
    battles = battles.filter(_since(bounty), id__in=out.values("battle_id")).exclude(status=Battle.STATUS_CANCELED)
    return battles.order_by("-created_at", "-id")


def battle_ref(battle: Battle) -> dict[str, Any]:
    return {
        "id": battle.id,
        "scenario": battle.scenario,
        "date": format_short_date(battle.ended_at or battle.created_at),
    }


def _kill_unit(kill: BattleKill) -> dict[str, Any] | None:
    unit_id = {"hero": kill.killer_hero_id, "henchman": kill.killer_henchman_id, "hireling": kill.killer_hireling_id}
    found = unit_id.get(kill.killer_kind)
    if found is None:
        return None
    return {"kind": kill.killer_kind, "id": found, "name": kill.killer_called(start=True)}


def suggestions(bounty: Bounty, warband_id: int) -> list[dict[str, Any]]:
    """The kills, then the out-of-actions no kill of his accounts for (two queries)."""
    rows: list[dict[str, Any]] = []
    killed_in = set()
    for kill in kill_candidates(bounty, warband_id):
        killed_in.add(kill.battle_id)
        unit = _kill_unit(kill)
        rows.append(
            {
                "kind": "kill",
                "kill_id": kill.id,
                "battle": battle_ref(kill.battle),
                "round": kill.round,
                "how": kill.how,
                "unit": unit,
                "text": f"{kill.killer_called(start=True)} took {bounty.target_name} out of action",
            }
        )
    for battle in out_of_action_battles(bounty, warband_id):
        if battle.id in killed_in:
            continue
        rows.append(
            {
                "kind": "out_of_action",
                "kill_id": None,
                "battle": battle_ref(battle),
                "round": None,
                "how": None,
                "unit": None,
                "text": f"{bounty.target_name} went out of action in {battle.scenario}, with no kill recorded",
            }
        )
    return rows


def claimable_units(warband_id: int) -> list[dict[str, Any]]:
    """His heroes, henchmen groups and hired swords still in the warband (the dead too: a hero may take his man and
    fall), three queries."""
    rows: list[dict[str, Any]] = []
    for kind, model in (("hero", Hero), ("henchmen_group", HenchmenGroup), ("hireling", Hireling)):
        units = not_dismissed(model.objects.filter(warband_id=warband_id)).only("id", "name", "unit_type", "dead")
        for unit in units.order_by("id"):
            rows.append({"kind": kind, "id": unit.id, "name": unit.name or unit.unit_type, "dead": unit.dead})
    return rows


def his_battles(bounty: Bounty, warband_id: int) -> list[dict[str, Any]]:
    """His warband's battles since the bounty was posted, newest first (one query)."""
    battles = Battle.objects.filter(campaign_id=bounty.campaign_id, participants__warband_id=warband_id)
    battles = battles.filter(_since(bounty)).exclude(status=Battle.STATUS_CANCELED).order_by("-created_at", "-id")
    return [battle_ref(battle) for battle in battles[:MAX_BATTLES]]


def has_record(bounty: Bounty, warband_id: int) -> bool:
    """Anything on record of his warband taking the target out since the bounty was posted (two queries at most)."""
    return kill_candidates(bounty, warband_id).exists() or out_of_action_battles(bounty, warband_id).exists()
