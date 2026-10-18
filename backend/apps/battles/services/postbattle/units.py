"""Each unit's postbattle results applied to the warband's roster.

Heroes and hired swords gain their kills (the live kill events, decision 5), XP and level-ups (`apply_xp_gain`),
kept stat changes and injury effects; a unit that dies loses what he carries (pass 2 decision 7). Henchmen gain
their kills and may die; their group gains the XP and the kept stat changes (all members must agree) and dies with
its last member. A unit dismissed since the battle started is left out with a warning (BUG-73).
"""

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from apps.warbands.models import Henchman, HenchmenGroup, Hero, HeroSpecial, HiredSword, not_dismissed, on_roster
from apps.warbands.units.services.xp import XP_FIELDS, apply_xp_gain
from apps.warbands.utils.leaders import ensure_single_living_leader

from ...models import Battle, BattleParticipant
from ...validation.coerce import coerce_int
from ...validation.unit_keys import parse_unit_key
from ..injuries import InjuryOutcome, apply_stat_and_special, injury_outcome
from ..items_lost import carried_item_names, henchman_takes_his_share, lost_entry
from ..kills import kill_counts_by_unit
from ..warnings import Warning, unit_left_warband
from .stats import kept_stats


@dataclass
class UnitOutcome:
    """What applying the unit results leaves for the answer and the logs."""

    warnings: list[Warning] = field(default_factory=list)
    injury_logs: list[dict] = field(default_factory=list)
    stat_logs: list[dict] = field(default_factory=list)
    items_lost: list[dict | None] = field(default_factory=list)  # what each unit dying here takes with him


@dataclass
class _Result:
    """One unit's result as finalise applies it."""

    unit_key: str
    unit_id: int
    name: str
    raw: dict[str, Any]
    stats_override: dict[str, int | str]
    kills: int
    xp: int
    injury: InjuryOutcome
    dead: bool


def _ids_by_type(unit_results: dict[str, dict]) -> dict[str, list[int]]:
    ids: dict[str, list[int]] = {"hero": [], "hired_sword": [], "henchman": []}
    for unit_key in unit_results:
        parsed = parse_unit_key(unit_key)
        if parsed["unit_type"] in ids:
            ids[parsed["unit_type"]].append(parsed["unit_id"])
    return ids


class UnitResults:
    """Applies one participant's unit results (the caller holds the warband lock)."""

    def __init__(self, battle: Battle, participant: BattleParticipant, settings: Any) -> None:
        self.battle, self.participant, self.settings = battle, participant, settings
        self.outcome = UnitOutcome()
        self.group_xp: dict[int, int] = {}
        self.group_stats: dict[int, dict[str, int | str]] = {}
        self.group_fields: defaultdict[int, set[str]] = defaultdict(set)

    def _lock(self, unit_results: dict[str, dict]) -> None:
        # Units dismissed since the battle started have left the warband: left out, with a warning (BUG-73).
        ids, warband_id = _ids_by_type(unit_results), self.participant.warband_id
        heroes = Hero.objects.select_for_update().filter(id__in=ids["hero"], warband_id=warband_id)
        self.heroes = {hero.id: hero for hero in not_dismissed(heroes)}
        swords = HiredSword.objects.select_for_update().filter(id__in=ids["hired_sword"], warband_id=warband_id)
        self.hired_swords = {sword.id: sword for sword in not_dismissed(swords)}
        henchmen = not_dismissed(Henchman.objects.select_for_update(of=("self",))).select_related("group")
        henchmen = henchmen.filter(
            id__in=ids["henchman"], group__warband_id=warband_id, group__dismissed_at__isnull=True
        )
        self.henchmen = {henchman.id: henchman for henchman in henchmen}
        groups = HenchmenGroup.objects.select_for_update().filter(
            id__in={henchman.group_id for henchman in self.henchmen.values()}, warband_id=warband_id
        )
        self.groups = {group.id: group for group in not_dismissed(groups)}

    def apply(self, unit_results: dict[str, dict], unit_information: dict[str, dict]) -> UnitOutcome:
        self._lock(unit_results)
        kills = kill_counts_by_unit(self.battle.id, self.participant.warband_id)  # the live kill events (decision 5)
        handlers = {"hero": self._hero, "hired_sword": self._hired_sword, "henchman": self._henchman}
        for unit_key, raw in unit_results.items():
            parsed = parse_unit_key(unit_key)
            name = raw.get("unit_name", "") or unit_key
            injury = injury_outcome(raw, name)  # the last roll, when ticked (decision 7)
            result = _Result(
                unit_key=unit_key,
                unit_id=parsed["unit_id"],
                name=name,
                raw=raw,
                stats_override=unit_information.get(unit_key, {}).get("stats_override", {}),
                kills=kills.get(unit_key, 0),
                xp=coerce_int(raw.get("xp_earned", 0), field_name="xp_earned", minimum=0, maximum=9999),
                injury=injury,
                dead=bool(raw.get("dead", False)) or injury.dead,
            )
            handler = handlers.get(parsed["unit_type"])
            if handler:
                handler(result)
        ensure_single_living_leader(self.participant.warband_id)
        self._apply_groups()
        return self.outcome

    def _left(self, result: _Result) -> None:
        self.outcome.warnings.append(unit_left_warband(result.unit_key, result.name))

    def _apply_to_unit(self, unit: Any, result: _Result, xp: int) -> list[str]:
        """Kept stats, injury effects, kills, XP and death for a hero or hired sword; returns the changed fields."""
        self.outcome.injury_logs.append(result.injury.log or {})
        update_fields = (
            kept_stats(unit, result.stats_override, result.name, self.outcome.stat_logs)
            if result.raw["keep_stats"]
            else []
        )
        update_fields += apply_stat_and_special(unit, result.injury, self.battle.campaign_id)
        if result.kills > 0:
            unit.kills += result.kills
            update_fields.append("kills")
        if apply_xp_gain(unit, xp, self.settings):
            update_fields.extend(XP_FIELDS)
        if result.dead and not unit.dead:
            unit.dead = True
            update_fields.append("dead")
            self.outcome.items_lost.append(lost_entry(result.name, carried_item_names(unit)))
        return update_fields

    def _hero(self, result: _Result) -> None:
        hero = self.heroes.get(result.unit_id)
        if not hero:
            return self._left(result)
        update_fields = self._apply_to_unit(hero, result, result.xp)
        if update_fields:
            hero.save(update_fields=[*dict.fromkeys(update_fields), "updated_at"])
        for special_id in result.raw.get("special_ids", []):
            if not HeroSpecial.objects.filter(hero_id=hero.id, special_id=special_id).exists():
                HeroSpecial.objects.create(hero_id=hero.id, special_id=special_id)
        return None

    def _hired_sword(self, result: _Result) -> None:
        hired_sword = self.hired_swords.get(result.unit_id)
        if not hired_sword:
            return self._left(result)
        update_fields = self._apply_to_unit(hired_sword, result, 0 if hired_sword.no_level_ups else result.xp)
        if update_fields:
            hired_sword.save(update_fields=[*dict.fromkeys(update_fields), "updated_at"])
        return None

    def _keep_group_stats(self, group: HenchmenGroup, result: _Result) -> None:
        """One Keep for the group: any member's tick; members whose overrides differ refuse it."""
        existing = self.group_stats.get(group.id)
        if existing is None:
            self.group_stats[group.id] = result.stats_override
            group_name = group.name or group.unit_type or result.name
            self.group_fields[group.id].update(
                kept_stats(group, result.stats_override, group_name, self.outcome.stat_logs)
            )
        elif existing != result.stats_override:
            raise ValueError("All henchmen in a group must share the same stat overrides")

    def _henchman(self, result: _Result) -> None:
        henchman = self.henchmen.get(result.unit_id)
        group = self.groups.get(henchman.group_id) if henchman else None
        if not henchman or not group:  # he, or his whole group, was dismissed
            return self._left(result)
        self.outcome.injury_logs.append(result.injury.log or {})
        if result.stats_override and result.raw["keep_stats"]:
            self._keep_group_stats(group, result)
        if result.kills > 0:
            henchman.kills += result.kills
        if result.dead and not henchman.dead:
            henchman.dead = True
            self.outcome.items_lost.append(lost_entry(result.name, henchman_takes_his_share(group)))
        henchman.save(update_fields=["kills", "dead"])
        xp = 0 if group.no_level_ups else result.xp
        if self.group_xp.setdefault(group.id, xp) != xp:
            raise ValueError("All henchmen in a group must share the same xp_earned value")
        return None

    def _apply_groups(self) -> None:
        for group_id, group in self.groups.items():
            xp = 0 if group.no_level_ups else self.group_xp.get(group_id, 0)
            update_fields = list(self.group_fields.get(group_id, set()))
            if apply_xp_gain(group, xp, self.settings):
                update_fields.extend(XP_FIELDS)
            all_dead = not on_roster(Henchman.objects.filter(group_id=group_id)).exists()
            if all_dead != group.dead:
                group.dead = all_dead
                update_fields.append("dead")
            if update_fields:
                group.save(update_fields=[*dict.fromkeys(update_fields), "updated_at"])
