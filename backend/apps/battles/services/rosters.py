"""Each participant's roster as the battle pages show it (BUG-73, PERF-38).

Read live from the warbands until the battle starts; `start/` stores each roster on its participant
(`roster_json`), and from then on the battle keeps that snapshot, so a unit killed or dismissed on the sheet
mid-battle stays in it. Every unit kind is read in one query plus its link tables, whatever the number of units.
Each unit carries its mount, pets and the Move and save its mount gives it (`effectiveStats`, beside its own
`stats`), and a group recruited from a creature its beast and kind, so the snapshot keeps them too.
"""

from collections import defaultdict
from collections.abc import Iterable

from django.db.models import F, Prefetch

from apps.warbands.models import (
    Henchman,
    HenchmenGroup,
    HenchmenGroupItem,
    Hero,
    HeroItem,
    Hireling,
    HirelingItem,
    on_roster,
)
from apps.warbands.units.companions import companions, effective_stats, mount_payload, pet_payload, with_beasts

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


ROSTER_ABILITY_COLUMNS = {"skills": ("id", "name"), "specials": ("id", "name"), "spells": ("id", "name", "dc")}


def _beast(row) -> dict:
    """A mount or pet as the roster shows it, with its beast's skills, specials and spells in the roster's own shapes
    (each left out when empty)."""
    shown = pet_payload(row)
    entry = {"itemId": shown["item_id"], "name": shown["name"], "hasProfile": shown["has_profile"]}
    entry["stats"] = shown["stats"]
    for key, columns in ROSTER_ABILITY_COLUMNS.items():
        if shown[key]:
            entry[key] = [{column: ability[column] for column in columns} for ability in shown[key]]
    return entry


def _companions(unit, links: list, rider: int = 0) -> dict:
    """The unit's mount (its first switched on; a group's `rider`-th member rides the `rider`-th, and goes on foot when
    there are fewer), its pets and what the mount makes it show (the bestiary rewrite step 4): snapshotted with the
    rest at start/, so the battle keeps what the rider rode in on."""
    found = companions(links)
    mount = found.mounts[rider] if rider < len(found.mounts) else None
    shown = None
    if mount is not None:
        payload = mount_payload(mount)
        shown = {**_beast(mount), "movement": payload["movement"], "ratingBonus": payload["rating_bonus"]}
    pets = [_beast(row) for row in found.pets]
    return {"mount": shown, "pets": pets, "effectiveStats": effective_stats(unit, mount)}


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
    links = list(hero.hero_items.all())
    items = _item_entries(links)
    return {
        "key": f"hero:{hero.id}",
        "id": hero.id,
        "kind": "hero",
        "displayName": hero.name or f"Hero {hero.id}",
        "unitType": hero.unit_type or "Hero",
        "isLeader": bool(hero.is_leader),  # Winning Leader XP (BATL-NEW-09)
        "stats": _stats(hero),
        **_companions(hero, links),
        "items": items,
        "singleUseItems": _single_use(items),
        "skills": _named(hero.hero_skills.all(), "skill"),
        "spells": _spells(hero.hero_spells.all()),
        "specials": _named(hero.hero_specials.all(), "special"),
    }


def hireling_entry(hireling: Hireling) -> dict:
    links = list(hireling.hireling_items.all())
    items = _item_entries(links)
    return {
        "key": f"hireling:{hireling.id}",
        "id": hireling.id,
        "kind": "hireling",
        "displayName": hireling.name or f"Hired Sword {hireling.id}",
        "unitType": hireling.unit_type or "Hired Sword",
        "stats": _stats(hireling),
        **_companions(hireling, links),
        "upkeepPrice": hireling.upkeep_price,
        "upkeepCostExpression": hireling.upkeep_cost_expression,
        "noLevelUps": bool(hireling.no_level_ups),
        "hirelingKind": hireling.kind,  # hired_sword | dramatis_persona
        "injuryTable": hireling.injury_table,  # henchman: a d6; hero: the campaign's hero death roll
        "stays": hireling.stays,  # always | one_battle: suggested to leave after it
        "paymentNote": hireling.payment_note,
        "items": items,
        "singleUseItems": _single_use(items),
        "skills": _named(hireling.hireling_skills.all(), "skill"),
        "spells": _spells(hireling.hireling_spells.all()),
        "specials": _named(hireling.hireling_specials.all(), "special"),
    }


def henchmen_group_entry(group: HenchmenGroup) -> dict:
    links = list(group.henchmen_group_items.all())
    items = _item_entries(links)
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
            **_companions(group, links, rider),  # one mount per member, in order
            "noLevelUps": bool(group.no_level_ups),
            "items": items,
            "singleUseItems": _single_use(items),
            "skills": skills,
            "spells": [],
            "specials": specials,
        }
        for rider, member in enumerate(group.henchmen.all())
    ]
    return {
        "id": group.id,
        "name": group.name or f"Henchmen Group {group.id}",
        "unitType": group.unit_type or "Henchmen",
        "sourceBeastId": group.source_beast_id,  # recruited from a creature: its beast and kind
        "beastKind": getattr(group, "beast_kind", None),
        "members": members,
    }


def _by_warband(rows: Iterable, entry) -> defaultdict[int, list[dict]]:
    grouped: defaultdict[int, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row.warband_id].append(entry(row))
    return grouped


def _items(relation: str, model) -> Prefetch:
    """A kind's copies in row order with their items, each Animal item's beast and its entries: one query."""
    return Prefetch(relation, queryset=with_beasts(model.objects.all()).order_by("id"))


def _live_rosters(warband_ids: list[int]) -> tuple[defaultdict, defaultdict, defaultdict]:
    heroes = on_roster(Hero.objects.filter(warband_id__in=warband_ids)).prefetch_related(
        _items("hero_items", HeroItem), "hero_skills__skill", "hero_specials__special", "hero_spells__spell"
    )
    hirelings = on_roster(Hireling.objects.filter(warband_id__in=warband_ids)).prefetch_related(
        _items("hireling_items", HirelingItem),
        "hireling_skills__skill",
        "hireling_specials__special",
        "hireling_spells__spell",
    )
    living_henchmen = Prefetch("henchmen", queryset=on_roster(Henchman.objects.all()).order_by("id"))
    groups = on_roster(HenchmenGroup.objects.filter(warband_id__in=warband_ids)).annotate(
        beast_kind=F("source_beast__kind")
    )
    groups = groups.prefetch_related(
        _items("henchmen_group_items", HenchmenGroupItem),
        "henchmen_group_skills__skill",
        "henchmen_group_specials__special",
        living_henchmen,
    )
    return (
        _by_warband(heroes.order_by("warband_id", "id"), hero_entry),
        _by_warband(hirelings.order_by("warband_id", "id"), hireling_entry),
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
    heroes, hirelings, groups = _live_rosters(warband_ids)
    return {
        str(participant.user_id): {
            "heroes": heroes[participant.warband_id],
            "hirelings": hirelings[participant.warband_id],
            "henchmenGroups": groups[participant.warband_id],
        }
        for participant in participants
    }
