"""Each unit's postbattle results applied to the warband's roster, in memory, then written in one UPDATE per kind
(PERF-36).

Heroes and hired swords gain their kills (the live kill events, decision 5), XP and level-ups (`apply_xp_gain`),
kept stat changes and injury effects; a unit that dies loses what he carries (pass 2 decision 7). Henchmen gain
their kills and may die; their group gains the XP and the kept stat changes (all members must agree) and dies with
its last member. The crown then goes to the right living hero (`choose_leader`). A unit dismissed since the battle
started is left out with a warning (BUG-73).
"""

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from django.db.models import Model
from django.utils import timezone

from apps.warbands.models import HenchmenGroup, Hero, HeroSpecial, Hireling
from apps.warbands.units.services.xp import XP_FIELDS, apply_xp_gain
from apps.warbands.utils.leaders import choose_leader

from ...validation.coerce import coerce_int
from ...validation.unit_keys import parse_unit_key
from ..injuries import InjuryOutcome, apply_stat_and_special, injury_outcome
from ..items_lost import henchman_takes_his_share, lost_entry
from ..warnings import Warning, unit_left_warband
from .context import FinaliseContext
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


class _Changes:
    """The rows changed in memory and the fields each kind's single UPDATE writes."""

    def __init__(self) -> None:
        self.rows: dict[type[Model], dict[int, Model]] = defaultdict(dict)
        self.fields: dict[type[Model], dict[str, None]] = defaultdict(dict)
        self.now = timezone.now()

    def mark(self, row: Any, fields: list[str], *, touch: bool = True) -> None:
        if not fields:
            return
        if touch and hasattr(row, "updated_at"):  # what save(update_fields=[..., "updated_at"]) did
            row.updated_at = self.now
            fields = [*fields, "updated_at"]
        self.rows[type(row)][row.pk] = row
        self.fields[type(row)].update(dict.fromkeys(fields))

    def write(self) -> None:
        for model, rows in self.rows.items():
            model._default_manager.bulk_update(list(rows.values()), list(self.fields[model]))


class UnitResults:
    """Applies one participant's unit results to the rows `context` holds locked."""

    def __init__(self, context: FinaliseContext, unit_information: dict[str, dict]) -> None:
        self.context, self.unit_information = context, unit_information
        self.outcome, self.changes = UnitOutcome(), _Changes()
        self.group_xp: dict[int, int] = {}
        self.group_stats: dict[int, dict[str, int | str]] = {}
        self.specials: list[HeroSpecial] = []
        results_henchmen = {member.id: member for member in context.henchmen if member.dismissed_at is None}
        self.henchmen = {key: member for key, member in results_henchmen.items() if member.group_id in context.groups}

    def apply(self, unit_results: dict[str, dict]) -> UnitOutcome:
        handlers = {"hero": self._hero, "hired_sword": self._hired_sword, "henchman": self._henchman}
        for unit_key, raw in unit_results.items():
            parsed = parse_unit_key(unit_key)
            handler = handlers.get(parsed["unit_type"])
            if handler:
                handler(self._result(unit_key, parsed["unit_id"], raw))
        self._apply_groups()
        self._pass_the_crown()
        self.changes.write()
        self._grant_specials()
        return self.outcome

    def _result(self, unit_key: str, unit_id: int, raw: dict) -> _Result:
        name = raw.get("unit_name", "") or unit_key
        injury = injury_outcome(raw, name)  # the last roll, when ticked (decision 7)
        return _Result(
            unit_key=unit_key,
            unit_id=unit_id,
            name=name,
            raw=raw,
            stats_override=self.unit_information.get(unit_key, {}).get("stats_override", {}),
            kills=self.context.kills.get(unit_key, 0),
            xp=coerce_int(raw.get("xp_earned", 0), field_name="xp_earned", minimum=0, maximum=9999),
            injury=injury,
            dead=bool(raw.get("dead", False)) or injury.dead,
        )

    def _left(self, result: _Result) -> None:
        self.outcome.warnings.append(unit_left_warband(result.unit_key, result.name))

    def _apply_to_unit(self, unit: Hero | Hireling, result: _Result, xp: int) -> None:
        """Kept stats, injury effects, kills, XP and death for a hero or hired sword."""
        self.outcome.injury_logs.append(result.injury.log or {})
        fields = (
            kept_stats(unit, result.stats_override, result.name, self.outcome.stat_logs)
            if result.raw["keep_stats"]
            else []
        )
        fields += apply_stat_and_special(unit, result.injury, self.context.battle.campaign_id)
        if result.kills > 0:
            unit.kills += result.kills
            fields.append("kills")
        if apply_xp_gain(unit, xp, self.context.settings):
            fields.extend(XP_FIELDS)
        if result.dead and not unit.dead:
            unit.dead = True
            fields.append("dead")
            self.outcome.items_lost.append(lost_entry(result.name, list(getattr(unit, "carried", None) or [])))
        self.changes.mark(unit, fields)

    def _hero(self, result: _Result) -> None:
        hero = self.context.hero(result.unit_id)
        if not hero:
            return self._left(result)
        self._apply_to_unit(hero, result, result.xp)
        self.specials += [
            HeroSpecial(hero_id=hero.id, special_id=special_id) for special_id in result.raw.get("special_ids", [])
        ]
        return None

    def _hired_sword(self, result: _Result) -> None:
        hired_sword = self.context.hired_swords.get(result.unit_id)
        if not hired_sword or hired_sword.dismissed_at is not None:
            return self._left(result)
        self._apply_to_unit(hired_sword, result, 0 if hired_sword.no_level_ups else result.xp)
        return None

    def _keep_group_stats(self, group: HenchmenGroup, result: _Result) -> None:
        """One Keep for the group: any member's tick; members whose overrides differ refuse it."""
        existing = self.group_stats.get(group.id)
        if existing is None:
            self.group_stats[group.id] = result.stats_override
            group_name = group.name or group.unit_type or result.name
            self.changes.mark(group, kept_stats(group, result.stats_override, group_name, self.outcome.stat_logs))
        elif existing != result.stats_override:
            raise ValueError("All henchmen in a group must share the same stat overrides")

    def _henchman(self, result: _Result) -> None:
        henchman = self.henchmen.get(result.unit_id)
        if not henchman:  # he, or his whole group, was dismissed
            return self._left(result)
        group = self.context.groups[henchman.group_id]
        self.outcome.injury_logs.append(result.injury.log or {})
        if result.stats_override and result.raw["keep_stats"]:
            self._keep_group_stats(group, result)
        fields: list[str] = []
        if result.kills > 0:
            henchman.kills += result.kills
            fields.append("kills")
        if result.dead and not henchman.dead:
            henchman.dead = True
            fields.append("dead")
            self.outcome.items_lost.append(lost_entry(result.name, henchman_takes_his_share(group)))
        self.changes.mark(henchman, fields, touch=False)
        xp = 0 if group.no_level_ups else result.xp
        if self.group_xp.setdefault(group.id, xp) != xp:
            raise ValueError("All henchmen in a group must share the same xp_earned value")
        return None

    def _apply_groups(self) -> None:
        for group_id, group in self.context.groups.items():
            fields: list[str] = []
            if apply_xp_gain(group, 0 if group.no_level_ups else self.group_xp.get(group_id, 0), self.context.settings):
                fields.extend(XP_FIELDS)
            members = [member for member in self.context.henchmen if member.group_id == group_id]
            all_dead = not any(not member.dead and member.dismissed_at is None for member in members)
            if all_dead != group.dead:
                group.dead = all_dead
                fields.append("dead")
            self.changes.mark(group, fields)

    def _pass_the_crown(self) -> None:
        """Exactly one living leader when any hero lives, none otherwise (as ensure_single_living_leader leaves it)."""
        living = [hero for hero in self.context.heroes if not hero.dead and hero.dismissed_at is None]
        leader_id = choose_leader(living)
        for hero in self.context.heroes:
            if hero.is_leader != (hero.id == leader_id):
                hero.is_leader = hero.id == leader_id
                self.changes.mark(hero, ["is_leader"], touch=False)

    def _grant_specials(self) -> None:
        """Injury specials sent with the draft (BUG-47's old path), each granted once."""
        if not self.specials:
            return
        held = set(
            HeroSpecial.objects.filter(hero_id__in={link.hero_id for link in self.specials}).values_list(
                "hero_id", "special_id"
            )
        )
        HeroSpecial.objects.bulk_create(link for link in self.specials if (link.hero_id, link.special_id) not in held)
