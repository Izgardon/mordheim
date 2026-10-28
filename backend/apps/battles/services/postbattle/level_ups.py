"""The level-ups each suggested XP would earn, from the server (the finalise summary's preview, BATL-NEW-10).

Only the server knows each unit's XP high-water mark (pass 1, BUG-27), so the suggestion counts them with the shared
XP service (`predicted_level_ups`: the campaign's thresholds, the hero table for hired swords, half rate, no
level-ups). The units are read live, in at most one query per kind for every player at once; a henchman's row is his
group's.
"""

from collections.abc import Iterable

from apps.campaigns.models import CampaignSettings
from apps.warbands.models import HenchmenGroup, Hero, Hireling, RosterUnit
from apps.warbands.units.services.xp import predicted_level_ups

XP_COLUMNS = ("id", "xp", "xp_high_water", "half_rate")


def _wanted(rosters: Iterable[dict], keys: set[str]) -> tuple[set[int], set[int], dict[str, int]]:
    heroes, swords, group_of = set(), set(), {}
    for roster in rosters:
        heroes |= {hero["id"] for hero in roster.get("heroes", []) if hero.get("key") in keys}
        swords |= {sword["id"] for sword in roster.get("hirelings", []) if sword.get("key") in keys}
        for group in roster.get("henchmenGroups", []):
            group_of.update({member["key"]: group["id"] for member in group.get("members", []) if member.get("key") in keys})  # fmt: skip
    return heroes, swords, group_of


def unit_rows(rosters: Iterable[dict], keys: set[str]) -> dict[str, RosterUnit]:
    """The live rows behind these roster keys (heroes, hired swords, and each henchman's group)."""
    hero_ids, sword_ids, group_of = _wanted(rosters, keys)
    rows: dict[str, RosterUnit] = {}
    if hero_ids:
        rows.update({f"hero:{hero.id}": hero for hero in Hero.objects.filter(id__in=hero_ids).only(*XP_COLUMNS)})
    if sword_ids:
        swords = Hireling.objects.filter(id__in=sword_ids).only(*XP_COLUMNS, "no_level_ups")
        rows.update({f"hireling:{sword.id}": sword for sword in swords})
    if group_of:
        groups = HenchmenGroup.objects.filter(id__in=set(group_of.values())).only(*XP_COLUMNS, "no_level_ups")
        by_id = {group.id: group for group in groups}
        rows.update({key: by_id[group_id] for key, group_id in group_of.items() if group_id in by_id})
    return rows


def add_level_ups(unit_results: dict[str, dict], rows: dict[str, RosterUnit], settings: CampaignSettings | None):
    """Each suggestion's `level_ups`: how many new level-ups its xp_earned would bring (0 for a unit gone since)."""
    for key, suggestion in unit_results.items():
        row = rows.get(key)
        suggestion["level_ups"] = predicted_level_ups(row, suggestion["xp_earned"], settings) if row else 0
