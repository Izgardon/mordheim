"""Each participant's roster as the battle pages show it (BUG-73, PERF-38).

Read live from the warbands until the battle starts; `start/` stores each roster on its participant
(`roster_json`), and from then on the battle keeps that snapshot, so a unit killed or dismissed on the sheet
mid-battle stays in it. Every unit kind is read in one query plus its link tables, whatever the number of units.
"""

from collections import defaultdict
from collections.abc import Iterable

from django.db.models import Prefetch

from apps.warbands.models import Henchman, HenchmenGroup, Hero, HiredSword, on_roster

from ..models import BattleParticipant


def _item_entries(links: Iterable) -> list[dict]:
    counts: dict[tuple[int, str], dict] = {}
    for link in links:
        item = getattr(link, "item", None)
        if not item or not item.id:
            continue
        key = (item.id, item.name)
        existing = counts.get(key)
        if existing is None:
            counts[key] = {"id": item.id, "name": item.name, "count": 1, "singleUse": bool(item.single_use)}
            continue
        existing["count"] += 1
        existing["singleUse"] = existing["singleUse"] or bool(item.single_use)
    return sorted(counts.values(), key=lambda entry: (entry["name"], entry["id"]))


def _single_use(items: list[dict]) -> list[dict]:
    return [{"id": item["id"], "name": item["name"], "quantity": item["count"]} for item in items if item["singleUse"]]


def _named(links: Iterable, attr_name: str) -> list[dict]:
    entries = []
    for link in links:
        entry = getattr(link, attr_name, None)
        if entry and entry.id:
            entries.append({"id": entry.id, "name": entry.name})
    return entries


def _spells(links: Iterable) -> list[dict]:
    entries = []
    for link in links:
        spell = getattr(link, "spell", None)
        if spell and spell.id:
            entries.append({"id": spell.id, "name": spell.name, "dc": spell.dc})
    return entries


def _stats(unit) -> dict:
    return {
        "movement": unit.movement,
        "weapon_skill": unit.weapon_skill,
        "ballistic_skill": unit.ballistic_skill,
        "strength": unit.strength,
        "toughness": unit.toughness,
        "wounds": unit.wounds,
        "initiative": unit.initiative,
        "attacks": unit.attacks,
        "leadership": unit.leadership,
        "armour_save": unit.armour_save,
    }


def hero_entry(hero: Hero) -> dict:
    items = _item_entries(hero.hero_items.all())
    return {
        "key": f"hero:{hero.id}",
        "id": hero.id,
        "kind": "hero",
        "displayName": hero.name or f"Hero {hero.id}",
        "unitType": hero.unit_type or "Hero",
        "stats": _stats(hero),
        "items": items,
        "singleUseItems": _single_use(items),
        "skills": _named(hero.hero_skills.all(), "skill"),
        "spells": _spells(hero.hero_spells.all()),
        "specials": _named(hero.hero_specials.all(), "special"),
    }


def hired_sword_entry(hired_sword: HiredSword) -> dict:
    items = _item_entries(hired_sword.hired_sword_items.all())
    return {
        "key": f"hired_sword:{hired_sword.id}",
        "id": hired_sword.id,
        "kind": "hired_sword",
        "displayName": hired_sword.name or f"Hired Sword {hired_sword.id}",
        "unitType": hired_sword.unit_type or "Hired Sword",
        "stats": _stats(hired_sword),
        "upkeepPrice": hired_sword.upkeep_price,
        "upkeepCostExpression": hired_sword.upkeep_cost_expression,
        "noLevelUps": bool(hired_sword.no_level_ups),
        "items": items,
        "singleUseItems": _single_use(items),
        "skills": _named(hired_sword.hired_sword_skills.all(), "skill"),
        "spells": _spells(hired_sword.hired_sword_spells.all()),
        "specials": _named(hired_sword.hired_sword_specials.all(), "special"),
    }


def henchmen_group_entry(group: HenchmenGroup) -> dict:
    items = _item_entries(group.henchmen_group_items.all())
    skills = _named(group.henchmen_group_skills.all(), "skill")
    specials = _named(group.henchmen_group_specials.all(), "special")
    members = [
        {
            "key": f"henchman:{member.id}",
            "id": member.id,
            "kind": "henchman",
            "displayName": member.name or f"Henchman {member.id}",
            "unitType": group.unit_type or "Henchman",
            "stats": _stats(group),
            "noLevelUps": bool(group.no_level_ups),
            "items": items,
            "singleUseItems": _single_use(items),
            "skills": skills,
            "spells": [],
            "specials": specials,
        }
        for member in group.henchmen.all()
    ]
    return {
        "id": group.id,
        "name": group.name or f"Henchmen Group {group.id}",
        "unitType": group.unit_type or "Henchmen",
        "members": members,
    }


def _by_warband(rows: Iterable, entry) -> defaultdict[int, list[dict]]:
    grouped: defaultdict[int, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row.warband_id].append(entry(row))
    return grouped


def _live_rosters(warband_ids: list[int]) -> tuple[defaultdict, defaultdict, defaultdict]:
    heroes = on_roster(Hero.objects.filter(warband_id__in=warband_ids)).prefetch_related(
        "hero_items__item", "hero_skills__skill", "hero_specials__special", "hero_spells__spell"
    )
    hired_swords = on_roster(HiredSword.objects.filter(warband_id__in=warband_ids)).prefetch_related(
        "hired_sword_items__item",
        "hired_sword_skills__skill",
        "hired_sword_specials__special",
        "hired_sword_spells__spell",
    )
    living_henchmen = Prefetch("henchmen", queryset=on_roster(Henchman.objects.all()).order_by("id"))
    groups = on_roster(HenchmenGroup.objects.filter(warband_id__in=warband_ids)).prefetch_related(
        "henchmen_group_items__item",
        "henchmen_group_skills__skill",
        "henchmen_group_specials__special",
        living_henchmen,
    )
    return (
        _by_warband(heroes.order_by("warband_id", "id"), hero_entry),
        _by_warband(hired_swords.order_by("warband_id", "id"), hired_sword_entry),
        _by_warband(groups.order_by("warband_id", "id"), henchmen_group_entry),
    )


def battle_rosters_payload(battle_id: int) -> dict:
    """Each participant's roster by user id: read live until the battle starts, then the snapshot `start/` stored."""
    participants = list(BattleParticipant.objects.filter(battle_id=battle_id).order_by("id"))
    if participants and all(participant.roster_json is not None for participant in participants):
        return {str(participant.user_id): participant.roster_json for participant in participants}
    warband_ids = [participant.warband_id for participant in participants]
    if not warband_ids:
        return {}
    heroes, hired_swords, groups = _live_rosters(warband_ids)
    return {
        str(participant.user_id): {
            "heroes": heroes[participant.warband_id],
            "hiredSwords": hired_swords[participant.warband_id],
            "henchmenGroups": groups[participant.warband_id],
        }
        for participant in participants
    }
