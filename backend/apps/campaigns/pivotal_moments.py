"""Pivotal moments (next step 9): the headlines a normal battle's fight leaves, shown in the overview's and the
Battles page's battle rows (ordinary kills stay in the chronicle).

Battle only, never the post-game: built from the battle's live kills (battle_kill) and its out-of-action data (each
participant's selected units, and which were out of action when the fight ended), with the declared ratings. A kill
moment carries its kill's round and points at it (`source_kill`); result moments come last, with no round. A battle's
moments are written when it ends, in fight order (by round, then kill order; kills logged after the fight after
those), and `regenerate_pivotal_moments` writes them again (its management command, for dev data or after a rules
change: the same battle always gives the same moments).

Kill moments:
- First Blood: the fight's first kill;
- Hero Slayer: a henchman takes out a hero;
- I don't believe in fairies: a Wizard or Priest taken out;
- Giant Slayer: a large victim;
- There can be only one: a leader takes out a leader (once per warband);
- Monster Hunter: a third-party creature slain (once per unit, at its first);
- Sharpshooter and Spellslinger: a unit's second shooting or magic kill;
- Bloody Martyr: a unit with 2+ kills taken out of action, at the kill that took him out (a result moment when no
  recorded kill did).

Result moments, warband by warband: Carried the Fight (a unit with 2+ kills and at least half of its warband's),
Bloody Martyr, Last One Standing (a winner whose other selected units all ended out of action), Untouched Triumph,
Pyrrhic Victory, Wiped Out, and Underdog (a winner whose declared rating was at least 10% under an opponent's).
"""

from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from django.db import transaction
from django.db.models import QuerySet

from apps.battles.models import Battle, BattleKill, BattleParticipant
from apps.battles.models.kill import CREATURE, FIGHT, HENCHMAN, HERO, KILLER_KINDS
from apps.battles.services.kills import live_kills

from .models import PivotalMoment

HEADLINES = {
    "first_blood": "First Blood",
    "hero_slayer": "Hero Slayer",
    "no_fairies": "I don't believe in fairies",
    "giant_slayer": "Giant Slayer",
    "there_can_be_only_one": "There can be only one",
    "monster_hunter": "Monster Hunter",
    "sharpshooter": "Sharpshooter",
    "spellslinger": "Spellslinger",
    "bloody_martyr": "Bloody Martyr",
    "carried_the_fight": "Carried the Fight",
    "last_one_standing": "Last One Standing",
    "untouched_triumph": "Untouched Triumph",
    "pyrrhic_victory": "Pyrrhic Victory",
    "wiped_out": "Wiped Out",
    "underdog": "Underdog",
}
BOUNTY_CLAIMED = "bounty_claimed"  # a bounty paid for a kill in the battle (apps/bounties/services/payment.py)
UNDERDOG_MARGIN = (11, 10)  # the opponent's declared rating is at least 10% over the winner's


@dataclass(frozen=True)
class Unit:
    """The unit a moment is about: its name and, for one of a warband's own, its keys."""

    name: str
    kind: str | None = None
    hero: int | None = None
    henchman: int | None = None
    group: int | None = None
    hireling: int | None = None

    def columns(self) -> dict[str, Any]:
        keys = {"hero_id": self.hero, "henchman_id": self.henchman, "group_id": self.group}
        return {"unit_kind": self.kind, **keys, "hireling_id": self.hireling, "unit_name": self.name[:120]}


def killer(kill: BattleKill) -> Unit:
    return Unit(
        kill.killer_called(start=True),
        kill.killer_kind,
        kill.killer_hero_id,
        kill.killer_henchman_id,
        kill.killer_group_id,
        kill.killer_hireling_id,
    )


def unit_id(kill: BattleKill) -> str:
    """Who scored the kill, to tally a unit's kills: his unit key, or the kill's own when his row is gone."""
    return kill.killer_unit_key or f"kill:{kill.id}"


def fight_order(kill: BattleKill) -> tuple[bool, bool, int, int]:
    """In the fight by round, then the order they were logged; kills logged after the fight last."""
    return (kill.phase != FIGHT, kill.round is None, kill.round or 0, kill.id)


def _plural(count: int, noun: str) -> str:
    return f"{count} {noun}{'' if count == 1 else 's'}"


@dataclass
class Fighter:
    """A participant's side of the fight: his selected units and which ended out of action."""

    participant: BattleParticipant
    selected: list[str]
    out: set[str]

    @classmethod
    def of(cls, participant: BattleParticipant) -> "Fighter":
        raw = participant.selected_unit_keys_json if isinstance(participant.selected_unit_keys_json, list) else []
        selected = list(dict.fromkeys(key.strip() for key in raw if isinstance(key, str) and key.strip()))
        info = participant.unit_information_json if isinstance(participant.unit_information_json, dict) else {}
        out = {key for key in selected if isinstance(info.get(key), dict) and info[key].get("out_of_action")}
        return cls(participant, selected, out)

    @property
    def name(self) -> str:
        return self.participant.warband.name

    def unit(self, unit_key: str) -> Unit:
        """One of his selected units by its key, named from his battle roster (or his temporary units)."""
        roster = self.participant.roster_json if isinstance(self.participant.roster_json, dict) else {}
        kind, _, raw_id = unit_key.partition(":")
        row_id = int(raw_id) if raw_id.isdigit() else None
        for group in roster.get("henchmenGroups", []):
            for member in group.get("members", []):
                if member.get("key") == unit_key:
                    return Unit(member.get("displayName") or "A henchman", HENCHMAN, henchman=row_id, group=group["id"])
        for entry in [*roster.get("heroes", []), *roster.get("hirelings", [])]:
            if entry.get("key") == unit_key and kind in KILLER_KINDS:
                return Unit(entry.get("displayName") or kind.title(), kind, **{kind: row_id})
        for owner in [*roster.get("heroes", []), *roster.get("hirelings", []), *roster.get("henchmenGroups", [])]:
            for pet in owner.get("pets", []):
                if pet.get("key") == unit_key:
                    return Unit(pet.get("name") or "A pet")
        custom = self.participant.custom_units_json if isinstance(self.participant.custom_units_json, list) else []
        named = next((entry for entry in custom if isinstance(entry, dict) and entry.get("key") == unit_key), {})
        return Unit(str(named.get("name") or "A unit"))


class Moments:
    """The battle's moments as they are found, in order."""

    def __init__(self, battle: Battle, fighters: list[Fighter]) -> None:
        self.battle = battle
        self.warbands = {fighter.participant.warband_id for fighter in fighters}
        self.rows: list[PivotalMoment] = []

    def add(self, warband_id: int, kind: str, detail: str, *, unit: Unit | None = None, kill: BattleKill | None = None):
        if warband_id not in self.warbands:  # a warband that left before the fight
            return
        self.rows.append(
            PivotalMoment(
                campaign_id=self.battle.campaign_id,
                battle_id=self.battle.id,
                warband_id=warband_id,
                source_kill=kill,
                round=kill.round if kill else None,
                kind=kind,
                headline=HEADLINES[kind],
                detail=detail,
                battle_ended_at=self.battle.ended_at or self.battle.created_at,
                **(unit.columns() if unit else {}),
            )
        )


def _taken_out_by(kills: list[BattleKill], martyrs: dict[str, int]) -> dict[int, list[str]]:
    """For each martyr (unit key: his warband) a recorded kill took out, that kill's id (the last that did)."""
    found: dict[str, int] = {}
    for kill in kills:
        key = kill.victim_unit_key
        if kill.victim_kind in KILLER_KINDS and key in martyrs and kill.victim_warband_id == martyrs[key]:
            found[key] = kill.id
    by_kill: dict[int, list[str]] = {}
    for key, kill_id in found.items():
        by_kill.setdefault(kill_id, []).append(key)
    return by_kill


def _kill_moments(moments: Moments, kills: list[BattleKill], martyrs: dict[str, tuple[Unit, int, int]]) -> set[str]:
    """Each kill's moments, in fight order; the martyrs placed at the kill that took them out (returned)."""
    totals = {how: Counter(unit_id(kill) for kill in kills if kill.how == how) for how in ("shooting", "magic")}
    creatures = Counter(unit_id(kill) for kill in kills if kill.victim_kind == CREATURE)
    taken_out = _taken_out_by(kills, {key: warband for key, (_unit, warband, _count) in martyrs.items()})
    first = next((kill for kill in kills if kill.phase == FIGHT), None)
    leaders: set[int] = set()
    scored: dict[str, Counter[str]] = {"shooting": Counter(), "magic": Counter()}
    hunters: set[str] = set()
    for kill in kills:
        name, victim, unit, warband, who = (
            kill.killer_called(start=True),
            kill.victim_called(),
            killer(kill),
            kill.killer_warband_id,
            unit_id(kill),
        )

        def add(kind: str, detail: str) -> None:
            moments.add(warband, kind, detail, unit=unit, kill=kill)  # noqa: B023 (used at once)

        if kill is first:
            add("first_blood", f"{name} drew first blood against {victim}.")
        if kill.killer_kind == HENCHMAN and kill.victim_kind == HERO:
            add("hero_slayer", f"{name} took {victim} out of action.")
        if kill.victim_caster:
            add("no_fairies", f"{name} brought down caster {victim}.")
        if kill.victim_large:
            add("giant_slayer", f"{name} slew large target {victim}.")
        if kill.killer_leader and kill.victim_leader and warband not in leaders:
            leaders.add(warband)
            add("there_can_be_only_one", f"{name} slew the enemy leader {victim}.")
        if kill.victim_kind == CREATURE and who not in hunters:
            hunters.add(who)
            count = creatures[who]
            more = f", the first of {count} creatures" if count > 1 else ""
            add("monster_hunter", f"{name} slew {victim}{more}.")
        for how, kind, phrase in (("shooting", "sharpshooter", "shooting"), ("magic", "spellslinger", "magic")):
            if kill.how == how:
                scored[how][who] += 1
                if scored[how][who] == 2:
                    add(kind, f"{name} scored {_plural(totals[how][who], f'{phrase} kill')}.")
        for key in taken_out.get(kill.id, []):
            martyr, martyr_warband, count = martyrs[key]
            moments.add(martyr_warband, "bloody_martyr", _martyr(martyr, count), unit=martyr, kill=kill)
    return {key for keys in taken_out.values() for key in keys}


def _martyr(unit: Unit, count: int) -> str:
    return f"{unit.name} claimed {count} kills before being taken out of action."


def _outcome(fighter: Fighter, won: bool) -> tuple[str, str] | None:
    """Untouched Triumph or Pyrrhic Victory for a winner, Wiped Out for anyone else, from his out-of-action count."""
    selected, out, name = len(fighter.selected), len(fighter.out), fighter.name
    if selected == 0:
        return None
    if won and out == 0:
        return "untouched_triumph", f"{name} won without a single selected unit going out of action."
    if won and out > selected / 2:
        return "pyrrhic_victory", f"{name} won despite {out} of {selected} selected units going out of action."
    if not won and out * 4 >= selected * 3:
        return "wiped_out", f"{name} lost {out} of {selected} selected units."
    return None


def _underdog(fighter: Fighter, losers: list[Fighter]) -> str | None:
    rating = fighter.participant.declared_rating
    rated = [entry for entry in losers if entry.participant.declared_rating is not None]
    if not rating or not rated:
        return None
    strongest = max(rated, key=lambda entry: entry.participant.declared_rating or 0)
    theirs = strongest.participant.declared_rating or 0
    if theirs * UNDERDOG_MARGIN[1] < rating * UNDERDOG_MARGIN[0]:
        return None
    return f"{fighter.name} (rating {rating}) beat {strongest.name} (rating {theirs})."


def _result_moments(
    moments: Moments,
    battle: Battle,
    fighters: list[Fighter],
    kills: list[BattleKill],
    martyrs: dict[str, tuple[Unit, int, int]],
) -> None:
    winners = set(battle.winner_warband_ids_json or [])
    losers = [fighter for fighter in fighters if fighter.participant.warband_id not in winners]
    for fighter in fighters:
        warband = fighter.participant.warband_id
        theirs = [kill for kill in kills if kill.killer_warband_id == warband]
        counts = Counter(unit_id(kill) for kill in theirs)
        units = {unit_id(kill): killer(kill) for kill in theirs}
        for key, count in counts.items():
            if count >= 2 and count * 2 >= len(theirs):
                detail = f"{units[key].name} scored {count} of {len(theirs)} recorded kills."
                moments.add(warband, "carried_the_fight", detail, unit=units[key])
        for martyr, martyr_warband, count in martyrs.values():
            if martyr_warband == warband:
                moments.add(warband, "bloody_martyr", _martyr(martyr, count), unit=martyr)
        won = warband in winners
        standing = [key for key in fighter.selected if key not in fighter.out]
        if won and len(fighter.selected) >= 2 and len(standing) == 1:
            survivor = fighter.unit(standing[0])
            detail = f"{survivor.name} was the last of {fighter.name} standing."
            moments.add(warband, "last_one_standing", detail, unit=survivor)
        if outcome := _outcome(fighter, won):
            moments.add(warband, *outcome)
        if won and (underdog := _underdog(fighter, losers)):
            moments.add(warband, "underdog", underdog)


def _martyrs(fighters: list[Fighter], kills: list[BattleKill]) -> dict[str, tuple[Unit, int, int]]:
    """Units with 2+ kills that ended out of action: unit key → (the unit, his warband, his kills)."""
    out = {(fighter.participant.warband_id, key) for fighter in fighters for key in fighter.out}
    counts = Counter((kill.killer_warband_id, kill.killer_unit_key) for kill in kills if kill.killer_unit_key)
    first: dict[tuple[int, str | None], BattleKill] = {}
    for kill in kills:
        first.setdefault((kill.killer_warband_id, kill.killer_unit_key), kill)
    return {
        key: (killer(first[(warband, key)]), warband, count)
        for (warband, key), count in counts.items()
        if key and count >= 2 and (warband, key) in out
    }


def build_moments(
    battle: Battle, participants: Iterable[BattleParticipant], kills: Iterable[BattleKill]
) -> list[PivotalMoment]:
    """The battle's moments, in order (participants read with their warbands; the live kills)."""
    fighters = [Fighter.of(participant) for participant in participants]
    ordered = sorted(kills, key=fight_order)
    moments = Moments(battle, fighters)
    martyrs = _martyrs(fighters, ordered)
    placed = _kill_moments(moments, ordered, martyrs)
    unplaced = {key: martyr for key, martyr in martyrs.items() if key not in placed}
    _result_moments(moments, battle, fighters, ordered, unplaced)
    return moments.rows


def _moments_for(battle: Battle) -> list[PivotalMoment]:
    participants = (
        BattleParticipant.objects.select_related("warband")
        .filter(battle_id=battle.id)
        .exclude(status__in=BattleParticipant.LEFT_STATUSES)
        .order_by("id")
    )
    return build_moments(battle, participants, live_kills(battle.id))


def _counts(battle: Battle) -> bool:
    return battle.flow_type == Battle.FLOW_TYPE_NORMAL and battle.status == Battle.STATUS_ENDED


def _fight_moments(battle: Battle) -> QuerySet[PivotalMoment]:
    """The moments the fight left: not a bounty claimed in it, which its payment writes and nothing here rebuilds."""
    return PivotalMoment.objects.filter(battle_id=battle.id).exclude(kind=BOUNTY_CLAIMED)


def generate_pivotal_moments_for_battle(battle: Battle) -> None:
    """When the battle ends: its moments, once."""
    if not _counts(battle) or _fight_moments(battle).exists():
        return
    PivotalMoment.objects.bulk_create(_moments_for(battle))


def regenerate_pivotal_moments(battle: Battle) -> int:
    """The battle's moments written again from what it holds now (an ended normal battle; none otherwise): how
    many."""
    with transaction.atomic():
        _fight_moments(battle).delete()
        rows = _moments_for(battle) if _counts(battle) else []
        PivotalMoment.objects.bulk_create(rows)
    return len(rows)
