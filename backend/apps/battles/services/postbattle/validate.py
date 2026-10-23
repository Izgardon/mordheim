"""Checking a player's postbattle draft against his units and the campaign, for a draft save and at finalise.

The draft is normalised first (validation/postbattle.py); then, in this order: every selected unit of the warband
has a result, injury rolls use the campaign's hero death roll (heroes, and hirelings on the hero table; d6 for everyone
else), injury specials exist, the exploration resource is the warband's and each upkeep entry names one of its hired
swords. ValueError otherwise.
"""

from collections.abc import Callable

from django.db.models import Q

from apps.campaigns.models import CampaignSettings
from apps.special.models import Special
from apps.warbands.models import Hireling, WarbandResource

from ...models import Battle, BattleParticipant
from ...validation.postbattle import normalize_postbattle
from ...validation.unit_keys import parse_unit_key
from ..selection import permanent_unit_keys


def hero_death_roll(campaign_id: int) -> str:
    return (
        CampaignSettings.objects.filter(campaign_id=campaign_id).values_list("hero_death_roll", flat=True).first()
        or "d66"
    )


def rolled_hireling_ids(unit_results: dict[str, dict]) -> set[int]:
    """The hirelings whose results carry injury rolls: the ones whose injury table the check needs."""
    ids = set()
    for unit_key, result in unit_results.items():
        parsed = parse_unit_key(unit_key)
        if parsed["unit_type"] == "hireling" and parsed["unit_id"] is not None and result.get("serious_injury_rolls"):
            ids.add(parsed["unit_id"])
    return ids


def check_unit_results(
    participant: BattleParticipant, unit_results: dict[str, dict], hero_roll_type: str, hero_table: set[int]
) -> None:
    """Every selected unit has a result, and each injury roll is on its unit's table: the campaign's hero death roll
    for heroes and for the hirelings in `hero_table` (dramatis personae, and house rules), a d6 for everyone else."""
    missing_keys = sorted(permanent_unit_keys(participant) - set(unit_results.keys()))
    if missing_keys:
        raise ValueError("postbattle unit_results are missing selected units")
    for unit_key, result in unit_results.items():
        parsed = parse_unit_key(unit_key)
        unit_type = parsed["unit_type"]
        on_hero_table = unit_type == "hero" or (unit_type == "hireling" and parsed["unit_id"] in hero_table)
        expected_roll_type = hero_roll_type if on_hero_table else "d6"
        for roll in result.get("serious_injury_rolls", []):
            if roll.get("roll_type") != expected_roll_type:
                raise ValueError(f"{unit_type} serious_injury_rolls must use {expected_roll_type}")


def check_special_ids(campaign_id: int, unit_results: dict[str, dict]) -> None:
    special_ids = {special_id for entry in unit_results.values() for special_id in entry.get("special_ids", [])}
    if not special_ids:
        return
    found = Special.objects.filter(id__in=special_ids).filter(Q(campaign_id__isnull=True) | Q(campaign_id=campaign_id))
    if len({special.id for special in found}) != len(special_ids):
        raise ValueError("One or more selected injury specials are invalid")


def upkeep_hireling_ids(draft: dict) -> list[int]:
    ids = []
    for unit_key in draft.get("upkeep", {}).get("entries", {}).keys():
        parsed_unit = parse_unit_key(unit_key)
        if parsed_unit["unit_type"] == "hireling" and parsed_unit["unit_id"] is not None:
            ids.append(parsed_unit["unit_id"])
    return ids


def check_draft(
    draft: dict,
    participant: BattleParticipant,
    campaign_id: int,
    hero_roll_type: str,
    *,
    resource_found: Callable[[int], bool],
    hireling_ids: Callable[[list[int]], set[int]],
    on_hero_table: Callable[[set[int]], set[int]],
) -> None:
    """Check a normalised draft in the order its refusals have always come in; the warband's exploration resource,
    hired swords and hirelings on the hero injury table are looked up through `resource_found`, `hireling_ids` and
    `on_hero_table` (ValueError for the first problem)."""
    unit_results = draft["unit_results"]
    rolled = rolled_hireling_ids(unit_results)
    check_unit_results(participant, unit_results, hero_roll_type, on_hero_table(rolled) if rolled else set())
    check_special_ids(campaign_id, unit_results)
    resource_id = draft["exploration"].get("resource_id")
    if resource_id is not None and not resource_found(resource_id):
        raise ValueError("Selected exploration resource is invalid")
    sword_ids = upkeep_hireling_ids(draft)
    if sword_ids and len(hireling_ids(sword_ids)) != len(set(sword_ids)):
        # the warband's own, dismissed or not; one dismissed since is charged nothing (BUG-73)
        raise ValueError("One or more upkeep hired swords are invalid")


def validate_postbattle(battle: Battle, participant: BattleParticipant, raw_draft: object) -> dict:
    """A draft save's draft, normalised and checked against the database (ValueError for the first problem)."""
    draft: dict = normalize_postbattle(raw_draft)
    warband_id = participant.warband_id
    check_draft(
        draft,
        participant,
        battle.campaign_id,
        hero_death_roll(battle.campaign_id),
        resource_found=lambda resource_id: WarbandResource.objects.filter(
            id=resource_id, warband_id=warband_id
        ).exists(),
        hireling_ids=lambda ids: set(
            Hireling.objects.filter(id__in=ids, warband_id=warband_id).values_list("id", flat=True)
        ),
        on_hero_table=lambda ids: set(
            Hireling.objects.filter(id__in=ids, warband_id=warband_id, injury_table="hero").values_list("id", flat=True)
        ),
    )
    return draft
