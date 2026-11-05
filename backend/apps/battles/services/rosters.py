"""Each participant's roster as the battle pages show it (BUG-73, PERF-38).

Read live from the warbands until the battle starts; `start/` stores each roster on its participant
(`roster_json`), and from then on the battle keeps that snapshot, so a unit killed or dismissed on the sheet
mid-battle stays in it. Every unit kind is read in one query plus its link tables, whatever the number of units.
Each unit carries its mount, pets and the Move and save its mount gives it (`effectiveStats`, beside its own
`stats`), and a group recruited from a creature its beast and kind, so the snapshot keeps them too. A mounted group
carries its mount warnings (`mountWarnings`, the warband page's), which prebattle shows as a note: never a block.
A skill or special with a pre-battle roll carries its dice and text, and an item its rules' (`prebattleRolls`, a shared
rule's with its name and one of the item's own with none, read with the copy), which prebattle shows under the unit
(core/models.py: PrebattleRoll).
"""

from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from django.contrib.postgres.expressions import ArraySubquery
from django.db.models import Case, F, OuterRef, Prefetch, Q, When
from django.db.models.functions import JSONObject

from apps.items.models import ItemRuleLink
from apps.skills.access import access_names
from apps.warbands.models import (
    Henchman,
    HenchmanItemGap,
    HenchmenGroup,
    HenchmenGroupItem,
    Hero,
    HeroItem,
    Hireling,
    HirelingItem,
    on_roster,
)
from apps.warbands.prefetches import members_with_gaps
from apps.warbands.units.companions import (
    companions,
    effective_stats,
    group_mount_warnings,
    mount_payload,
    pet_payload,
    with_beasts,
)

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
            rolls = getattr(link, "item_rolls", None)
            if rolls:
                counts[key]["prebattleRolls"] = rolls
            continue
        existing["count"] += 1
        existing["singleUse"] = existing["singleUse"] or bool(item.single_use)
    return sorted(counts.values(), key=lambda entry: (entry["name"], entry["id"]))


def _single_use(items: list[dict]) -> list[dict]:
    return [{"id": item["id"], "name": item["name"], "quantity": item["count"]} for item in items if item["singleUse"]]


def _prebattle(rule) -> dict:
    """A skill's or special's pre-battle roll, which prebattle shows under the unit (none: nothing)."""
    return {"prebattleRoll": rule.prebattle_roll, "prebattleText": rule.prebattle_text} if rule.prebattle_roll else {}


def _named(links: Iterable, attr_name: str) -> list[dict]:
    entries = []
    for link in links:
        entry = getattr(link, attr_name, None)
        if entry and entry.id:
            entries.append({"id": entry.id, "name": entry.name, **_prebattle(entry)})
    return entries


def _spells(links: Iterable) -> list[dict]:
    entries = []
    for link in links:
        spell = getattr(link, "spell", None)
        if spell and spell.id:
            entries.append({"id": spell.id, "name": spell.name, "dc": spell.dc})
    return entries


ROSTER_ABILITY_COLUMNS = {"skills": ("id", "name"), "specials": ("id", "name"), "spells": ("id", "name", "dc")}


def _beast(row, owner: str | None = None) -> dict:
    """A mount or pet as the roster shows it, with its beast's skills, specials and spells in the roster's own shapes
    (each left out when empty). A pet with a profile its `owner` kind brings takes part as its own model (step 5):
    its unit key is `pet:<owner kind>:<item row id>`."""
    shown = pet_payload(row)
    entry: dict[str, Any] = {"key": f"pet:{owner}:{row.pk}"} if owner and shown["has_profile"] else {}
    entry |= {"itemId": shown["item_id"], "name": shown["name"], "hasProfile": shown["has_profile"]}
    entry["stats"] = shown["stats"]
    for key, columns in ROSTER_ABILITY_COLUMNS.items():
        if shown[key]:
            entry[key] = [{column: ability[column] for column in columns} for ability in shown[key]]
    return entry


def _companions(unit, links: list, owner: str | None = None) -> dict:
    """The unit's mount (its first switched on: a henchman's, the group's if he carries it), its pets (keyed as models of an `owner` kind) and what the mount makes it show (the bestiary
    rewrite step 4): snapshotted with the rest at start/, so the battle keeps what the rider rode in on."""
    found = companions(links)
    mount = found.mounts[0] if found.mounts else None
    shown = None
    if mount is not None:
        payload = mount_payload(mount)
        shown = {**_beast(mount), "movement": payload["movement"], "ratingBonus": payload["rating_bonus"]}
    pets = [_beast(row, owner) for row in found.pets]
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


def _profile(unit) -> dict:
    """The unit's stats (a stat written as the book prints it, "1(2)" or "D6", has its leading number or none) and
    its written text by field: what follows the number ("(2)"), or the whole text ("D6", apps/warbands/utils/stats.py)."""
    return {"stats": _stats(unit), "writtenStats": dict(unit.written_stats or {})}


def _missing(unit) -> dict:
    """How many more games the unit misses and why: prebattle leaves it out at first, and the player may bring it anyway
    (0 and "" when it isn't missing)."""
    return {"missingGames": unit.missing_games, "missingReason": unit.missing_reason}


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
        **_missing(hero),
        **_profile(hero),
        **_companions(hero, links, owner="hero"),
        "items": items,
        "singleUseItems": _single_use(items),
        "skills": _named(hero.hero_skills.all(), "skill"),
        "skillAccess": access_names(hero.available_skills),  # his skill groups, which a skill shows under
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
        **_missing(hireling),
        **_profile(hireling),
        **_companions(hireling, links, owner="hireling"),
        "upkeepFee": hireling.upkeep_fee,  # a structured fee (apps/hirelings/fees.py): gold, resources, kind
        "noLevelUps": bool(hireling.no_level_ups),
        "hirelingKind": hireling.kind,  # hired_sword | dramatis_persona
        "injuryTable": hireling.injury_table,  # henchman: a d6; hero: the campaign's hero death roll
        "stays": hireling.stays,  # always | one_battle: suggested to leave after it
        "paymentNote": hireling.payment_note,
        "items": items,
        "singleUseItems": _single_use(items),
        "skills": _named(hireling.hireling_skills.all(), "skill"),
        "skillAccess": access_names(hireling.available_skills),
        "spells": _spells(hireling.hireling_spells.all()),
        "specials": _named(hireling.hireling_specials.all(), "special"),
    }


KIT_TAKEN = HenchmanItemGap.KIT_TAKEN


def _gaps(member, links: list) -> list[dict]:
    """The loadout rows a member lacks, as the battle shows them (henchmen loadouts): he starts without each."""
    rows = {row.pk: row for row in links}
    gaps = []
    for gap in getattr(member, "gap_entries", None) or []:
        row = rows.get(gap["row_id"])
        if row is not None:
            gaps.append({"rowId": row.pk, "itemId": row.item_id, "name": row.item.name, "reason": gap["reason"]})
    return gaps


def _out_reason(gaps: list[dict]) -> str | None:
    """Why prebattle leaves a member out at first (he may still be brought): his kit went to the stash."""
    taken = [gap["name"] for gap in gaps if gap["reason"] == KIT_TAKEN]
    return f"His kit went to the stash ({', '.join(taken)}); re-equip him to bring him back." if taken else None


def henchman_entry(group: HenchmenGroup, member, links: list, number: int = 1) -> dict:
    """One member: the group's profile and skills, and the loadout rows he carries (none he has a gap on), so he
    rides the group's mount only if he carries it. A member without a name is called by the group's type and his
    number in it ("Giant Rat 2", a creature group's), never by his row id."""
    gaps = _gaps(member, links)
    lacking = {gap["rowId"] for gap in gaps}
    carried = [row for row in links if row.pk not in lacking]
    items = _item_entries(carried)
    return {
        "key": f"henchman:{member.id}",
        "id": member.id,
        "kind": "henchman",
        "displayName": member.name or f"{group.unit_type or 'Henchman'} {number}",
        "unitType": group.unit_type or "Henchman",
        **_missing(group),  # the whole group misses games
        **_profile(group),
        **_companions(group, carried),
        "noLevelUps": bool(group.no_level_ups),
        "items": items,
        "singleUseItems": _single_use(items),
        "gaps": gaps,
        "outReason": _out_reason(gaps),
        "skills": _named(group.henchmen_group_skills.all(), "skill"),
        "spells": [],
        "specials": _named(group.henchmen_group_specials.all(), "special"),
    }


def henchmen_group_entry(group: HenchmenGroup) -> dict:
    links = list(group.henchmen_group_items.all())
    members = [
        henchman_entry(group, member, links, number) for number, member in enumerate(group.henchmen.all(), start=1)
    ]
    name = group.name or f"Henchmen Group {group.id}"
    return {
        "id": group.id,
        "name": name,
        "unitType": group.unit_type or "Henchmen",
        **_missing(group),
        "sourceBeastId": group.source_beast_id,  # recruited from a creature: its beast and kind
        "beastKind": getattr(group, "beast_kind", None),
        "pets": [_beast(row, "henchmen_group") for row in companions(links).pets],  # the group's own: one model each
        "mountWarnings": group_mount_warnings(name, links),  # every member carries the same gear
        "members": members,
    }


def _by_warband(rows: Iterable, entry) -> defaultdict[int, list[dict]]:
    grouped: defaultdict[int, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row.warband_id].append(entry(row))
    return grouped


def _item_rolls() -> ArraySubquery:
    """A copy's item's rules with a pre-battle roll, in the item's order, read with the copy: a shared rule's with
    its name, a rule of the item's own with none (the item names it)."""
    own = Q(rule__isnull=True, prebattle_roll__gt="")
    rules = ItemRuleLink.objects.filter(own | Q(rule__prebattle_roll__gt=""), item_id=OuterRef("item_id"))

    def of(field: str) -> Case:
        return Case(When(rule__isnull=True, then=F(field)), default=F(f"rule__{field}"))

    columns = JSONObject(rule="rule__name", roll=of("prebattle_roll"), text=of("prebattle_text"))
    return ArraySubquery(rules.order_by("position", "id").values(entry=columns))


def _items(relation: str, model) -> Prefetch:
    """A kind's copies in row order with their items, each Animal item's beast and its entries, and their items'
    pre-battle rolls: one query."""
    copies = with_beasts(model.objects.all()).annotate(item_rolls=_item_rolls())
    return Prefetch(relation, queryset=copies.order_by("id"))


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
    living_henchmen = Prefetch("henchmen", queryset=members_with_gaps(on_roster(Henchman.objects.all())))
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
