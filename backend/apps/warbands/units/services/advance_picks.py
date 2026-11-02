"""A pick an advance gives (William: "it doesnt allow things to be chosen within that modal which is the entire point"):
a skill, a spell or a boon or bane, made inside the advance or later from the card's "Skill to choose".

A pick names its entry (`id`, any the campaign may use: one outside his lists is the page's warning, never a block) or,
for a spell, a lore and a D6 `roll` on its table. A spell he already knows gets 1 easier for him (his link's
`dc_change`, "Difficulty 7 → 6"); one that is cast automatically stays as it is. A skill or special he already has
isn't added twice. Each addition writes the loadout log row a PATCH would.
"""

from dataclasses import dataclass, replace
from typing import TYPE_CHECKING, Any

from django.db.models import F, Q
from django.db.models.functions import Greatest

from apps.logs.utils import log_warband_event
from apps.spells.models import Spell
from apps.warbands.models import RosterUnit, Warband
from apps.warbands.units.catalogue_scope import current_entry

from .level_up import PICKS, LevelUpRejected, apply_advance, valid_advance_id

if TYPE_CHECKING:
    from apps.warbands.units.kinds import LinkSpec, UnitKindSpec

# The advance that gives a pick -> the list it goes into (and back).
PICK_LISTS = {"Skill": "skills", "Spell": "spells", "Special": "specials"}
PENDING_FIELDS = {PICK_LISTS[code]: field for code, field in PICKS.items()}


@dataclass(frozen=True)
class PickResult:
    """What a pick did: the entry, and for a spell he knew, its difficulty for him before and after."""

    list: str
    entry_id: int
    name: str
    added: bool
    dc_from: str | None = None
    dc_to: str | None = None
    roll: int | None = None

    def log(self) -> dict[str, Any]:
        return {key: value for key, value in self.__dict__.items() if value is not None}


def _link(kind: "UnitKindSpec", list_name: str) -> "LinkSpec":
    link = {"skills": kind.skills, "spells": kind.spells, "specials": kind.specials}.get(list_name)
    if link is None or not kind.pick_advances:
        raise LevelUpRejected("This unit can't take that pick")
    return link


def _rolled_spell(campaign_id: int, lore: str, roll: int) -> Spell:
    """The spell on `roll` of the lore's D6 table among the entries the campaign may use, its own version first."""
    scope = Q(campaign__isnull=True) | Q(campaign_id=campaign_id)
    rows = list(Spell.objects.filter(scope, type__iexact=lore.strip(), roll=roll, archived_at__isnull=True))
    replaced = {row.replaces_id for row in rows if row.replaces_id}
    rows = sorted((row for row in rows if row.id not in replaced), key=lambda row: (row.campaign_id is None, row.id))
    if not rows:
        raise LevelUpRejected(f"No {lore} spell on a roll of {roll}")
    return rows[0]


@dataclass(frozen=True)
class Resolved:
    """The list a pick goes into, its join (`link`) and the campaign's current entry it names."""

    list: str
    link: "LinkSpec"
    entry: Any
    roll: int | None = None


def resolve_pick(kind: "UnitKindSpec", campaign_id: int, pick: dict[str, Any]) -> Resolved:
    """What a validated pick (AdvancePickSerializer) names; LevelUpRejected for an unknown entry or an empty roll."""
    link = _link(kind, pick["list"])
    if "id" in pick:
        entry = current_entry(link.catalogue._default_manager.all(), pick["id"], campaign_id)
        if entry is None:
            raise LevelUpRejected("Unknown entry")
        return Resolved(pick["list"], link, entry)
    return Resolved("spells", link, _rolled_spell(campaign_id, pick["lore"], pick["roll"]), pick["roll"])


def _lowered(dc: str, change: int) -> str | None:
    """The difficulty `dc` lowered by `change` more, or None when it isn't a number (Auto)."""
    return str(int(dc) + change) if dc.strip().isdigit() else None


def _add_spell(link: "LinkSpec", unit: RosterUnit, entry: Spell) -> PickResult:
    links = getattr(unit, link.relation)
    same = Q(spell_id=entry.id) | Q(spell__name__iexact=entry.name, spell__type__iexact=entry.type)
    known = links.filter(same).select_related("spell").first()
    if known is None:
        links.create(spell=entry)
        return PickResult("spells", entry.id, entry.name, added=True, dc_to=entry.dc or None)
    dc_from, dc_to = _lowered(known.spell.dc, known.dc_change), _lowered(known.spell.dc, known.dc_change - 1)
    if dc_to is not None:
        links.filter(pk=known.pk).update(dc_change=F("dc_change") - 1)
    return PickResult("spells", known.spell_id, known.spell.name, added=False, dc_from=dc_from, dc_to=dc_to)


def apply_pick(kind: "UnitKindSpec", warband: Warband, unit: RosterUnit, pick: Resolved) -> PickResult:
    """Add the entry to the unit's list (a spell he knows: 1 easier), inside the caller's transaction."""
    link, entry = pick.link, pick.entry
    if pick.list == "spells":
        result = _add_spell(link, unit, entry)
    else:
        links = getattr(unit, link.relation)
        added = not links.filter(**{f"{link.target}_id": entry.id}).exists()
        if added:
            links.create(**{link.target: entry})
        result = PickResult(pick.list, entry.id, entry.name, added=added)
    if result.added and link.log_entry:
        payload = {"hero": unit.name or unit.unit_type or kind.unknown_name, link.target: entry.name}
        log_warband_event(warband.id, "loadout", link.log_entry, {**payload, f"{link.target}_type": entry.type})
    return replace(result, roll=pick.roll)


def pick_later(kind: "UnitKindSpec", warband: Warband, unit: RosterUnit, pick: dict[str, Any]) -> PickResult:
    """A pick an advance left for later, made from the card: the entry joins the list and one pick fewer is left (never
    below 0: a pick with none left still counts, with nothing to take away)."""
    result = apply_pick(kind, warband, unit, resolve_pick(kind, warband.campaign_id, pick))
    field = PENDING_FIELDS[pick["list"]]
    type(unit)._default_manager.filter(pk=unit.pk).update(**{field: Greatest(F(field) - 1, 0)})
    return result


def advance_with_pick(
    kind: "UnitKindSpec", warband: Warband, unit: RosterUnit, payload: dict[str, Any], pick: dict[str, Any]
) -> PickResult:
    """Spend a level-up on a Skill, Spell or Special advance and make its pick now, in one transaction (the advance
    log carries the pick). A pick for another list than the advance's, or for a stat advance, is refused."""
    if PICK_LISTS.get(valid_advance_id(kind, payload)) != pick["list"]:
        raise LevelUpRejected("The pick doesn't match the advance")
    resolved = resolve_pick(kind, warband.campaign_id, pick)
    results: list[PickResult] = []

    def make() -> dict[str, Any]:
        results.append(apply_pick(kind, warband, unit, resolved))
        return results[0].log()

    apply_advance(kind, warband, unit, payload, pick=make)
    return results[0]
