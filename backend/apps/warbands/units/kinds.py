"""The unit kinds registry: heroes, henchmen groups and hired swords as data (design 0.28 §4.3).

Everything the three kinds share is written once in this package; each real difference between them is
a field here. Kinds hold no serializers (they are looked up by key in `apps.warbands.serializers`) so that
models, kinds and serializers don't import each other in a circle.
"""

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any, Literal

from django.db import models
from django.db.models import Prefetch, QuerySet

from apps.warbands.models import (
    HenchmenGroup,
    HenchmenGroupItem,
    HenchmenGroupSkill,
    HenchmenGroupSpecial,
    Hero,
    HeroItem,
    HeroSkill,
    HeroSpecial,
    HeroSpell,
    HiredSword,
    HiredSwordItem,
    HiredSwordSkill,
    HiredSwordSpecial,
    HiredSwordSpell,
    LedgerAction,
    RosterUnit,
    Warband,
    on_roster,
)
from apps.warbands.prefetches import (
    alive_henchmen_prefetch,
    entries_array,
    entries_attr,
    item_detail_prefetches,
    links_prefetch,
)
from apps.warbands.utils.henchmen_level import count_new_henchmen_level_ups
from apps.warbands.utils.hero_level import count_new_level_ups

from .hooks import HenchmenHooks, LeaderHooks, UnitHooks

UnitKindKey = Literal["hero", "henchmen_group", "hired_sword"]  # also the item-transfer source/target types

# Level-up advance code -> stat field.
STAT_FIELD_BY_ADVANCE: Mapping[str, str] = {
    "M": "movement",
    "WS": "weapon_skill",
    "BS": "ballistic_skill",
    "S": "strength",
    "T": "toughness",
    "W": "wounds",
    "I": "initiative",
    "A": "attacks",
    "Ld": "leadership",
}
HENCHMEN_ADVANCES = ("WS", "BS", "S", "I", "A", "Ld")


@dataclass(frozen=True)
class LinkSpec:
    """One loadout list: the join model that links a unit to catalogue entries (items, skills, ...)."""

    relation: str  # reverse accessor on the unit, e.g. "hero_skills"
    model: type[models.Model]  # join model, e.g. HeroSkill
    target: str  # catalogue foreign key on the join model, e.g. "skill"
    write_field: str  # the list's key in create and PATCH payloads, e.g. "skill_ids"
    log_entry: str | None = None  # loadout log entry type for entries a PATCH adds; None: not logged

    @property
    def catalogue(self) -> Any:
        """The catalogue model the link points at, e.g. Skill."""
        return self.model._meta.get_field(self.target).related_model


@dataclass(frozen=True)
class RecruitSpec:
    """How recruiting and dismissing the kind is written to the ledger and the log."""

    trade_action: LedgerAction  # Recruit | Hire
    log_new: str
    log_remove: str
    client_may_seed_level_up: bool = False  # Lad's Got Talent creates the promoted hero with level_up=2


def _nobody_exempt(data: Mapping[str, Any]) -> bool:
    return False


@dataclass(frozen=True)
class CapSpec:
    """A hard cap on adding units of the kind directly: the only hard blocks William asked for (decision 12)."""

    setting: str  # CampaignSettings attribute
    default: int  # without campaign settings, or when the setting is empty
    noun: str  # for "Warband already has 6 heroes"
    code: str  # the 400's stable error code, e.g. "hero_cap_reached"
    counted: Callable[[QuerySet[Any]], QuerySet[Any]]  # the warband's units that count towards the cap
    exempt: Callable[[Mapping[str, Any]], bool] = _nobody_exempt  # a new unit that doesn't count


@dataclass(frozen=True)
class UnitKindSpec:
    key: UnitKindKey
    url_segment: str  # "heroes": paths and URL names stay as they are
    url_kwarg: str  # "hero_id": kept so reverse() callers don't change
    collection: str  # the kind's key in the sheet payload, e.g. "heroes"
    model: type[RosterUnit]
    parent_field: str  # the unit foreign key on the join models, e.g. "hero"
    items: LinkSpec
    skills: LinkSpec
    specials: LinkSpec
    spells: LinkSpec | None  # henchmen groups have no spells
    has_members: bool  # henchmen groups list their living members in every payload
    thresholds_setting: str  # CampaignSettings attribute holding the kind's XP table
    count_level_ups: Callable[[Any, Any, Any], int]  # (previous xp, new xp, thresholds) -> thresholds crossed
    has_no_level_ups: bool  # the unit's `no_level_ups` flag stops XP level-ups and spending them
    stat_advances: Mapping[str, str]  # level-up advance code -> stat field
    placeholder_advances: bool  # Skill / Spell / Special advances add a "New ..." entry to resolve later
    advance_log_type: str
    caster_traits: bool  # `caster` keeps the Wizard / Priest specials in step (Large applies to every kind)
    can_lead: bool  # heroes: one living leader per warband
    recruit: RecruitSpec
    cap: CapSpec | None
    unknown_name: str  # the dismiss and loadout logs' fallback for a unit without a name
    unknown_type: str  # the dismiss log's fallback for a unit without a type
    hooks: UnitHooks = field(default_factory=UnitHooks)  # differences that are behaviour (units/hooks.py)

    def links(self) -> tuple[LinkSpec, ...]:
        """The kind's loadout lists, in payload order: items, skills, specials, spells."""
        return tuple(link for link in (self.items, self.skills, self.specials, self.spells) if link)

    @property
    def objects(self) -> models.Manager[Any]:
        return self.model._default_manager

    def visible(self, units: QuerySet[Any]) -> QuerySet[Any]:
        """The units the roster shows, alive and not dismissed (`on_roster`): the one "visible units" rule."""
        return on_roster(units)

    def with_loadout(self, units: QuerySet[Any], *, detail: bool, living_members: bool = True) -> QuerySet[Any]:
        """`units` read for their payloads in a fixed number of queries, whatever the roster and loadout size.

        Skills, specials and spells come with each unit's row (ordered JSON arrays); items are prefetched,
        with their properties and availabilities for the detail payload; henchmen groups' living members too.
        """
        entries = {
            entries_attr(link.relation): entries_array(link.model, self.parent_field, link.target)
            for link in self.links()
            if link is not self.items
        }
        prefetch: list[str | Prefetch] = [links_prefetch(self.items.relation, self.items.model, "item")]
        if detail:
            prefetch += item_detail_prefetches(f"{self.items.relation}__item__")
        if self.has_members and living_members:
            prefetch.append(alive_henchmen_prefetch())
        loaded: QuerySet[Any] = units.annotate(**entries).prefetch_related(*prefetch)
        return loaded

    def roster(self, warband: Warband, *, detail: bool) -> QuerySet[Any]:
        """The warband's visible units in id order, read for the summary or the detail payload."""
        units = self.visible(self.objects.filter(warband=warband)).select_related("race")
        return self.with_loadout(units, detail=detail).order_by("id")

    def detail_queryset(self) -> QuerySet[Any]:
        """Units read for a detail payload (PERF-23)."""
        return self.with_loadout(self.objects.select_related("race"), detail=True)


def _counted_hired_swords(units: QuerySet[Any]) -> QuerySet[Any]:
    """Blood-pacted hired swords don't count towards the hired-sword cap, nor do dead or dismissed ones."""
    return on_roster(units).filter(blood_pacted=False)


HERO = UnitKindSpec(
    key="hero",
    url_segment="heroes",
    url_kwarg="hero_id",
    collection="heroes",
    model=Hero,
    parent_field="hero",
    items=LinkSpec("hero_items", HeroItem, "item", "items"),
    skills=LinkSpec("hero_skills", HeroSkill, "skill", "skill_ids", log_entry="hero_skill"),
    specials=LinkSpec("hero_specials", HeroSpecial, "special", "special_ids", log_entry="hero_special"),
    spells=LinkSpec("hero_spells", HeroSpell, "spell", "spell_ids", log_entry="hero_spell"),
    has_members=False,
    thresholds_setting="hero_level_thresholds",
    count_level_ups=count_new_level_ups,
    has_no_level_ups=False,
    stat_advances=STAT_FIELD_BY_ADVANCE,
    placeholder_advances=True,
    advance_log_type="hero",
    caster_traits=True,
    can_lead=True,
    recruit=RecruitSpec(LedgerAction.RECRUIT, "new_hero", "remove_hero", client_may_seed_level_up=True),
    cap=CapSpec("max_heroes", 6, "heroes", "hero_cap_reached", counted=on_roster),  # living ones only (BUG-29)
    unknown_name="Unknown Hero",
    unknown_type="Unknown Type",
    hooks=LeaderHooks(),
)

HENCHMEN_GROUP = UnitKindSpec(
    key="henchmen_group",
    url_segment="henchmen-groups",
    url_kwarg="group_id",
    collection="henchmen_groups",
    model=HenchmenGroup,
    parent_field="henchmen_group",
    items=LinkSpec("henchmen_group_items", HenchmenGroupItem, "item", "items"),
    skills=LinkSpec("henchmen_group_skills", HenchmenGroupSkill, "skill", "skill_ids"),  # no loadout logs
    specials=LinkSpec("henchmen_group_specials", HenchmenGroupSpecial, "special", "special_ids"),
    spells=None,
    has_members=True,
    thresholds_setting="henchmen_level_thresholds",
    count_level_ups=count_new_henchmen_level_ups,
    has_no_level_ups=True,
    stat_advances={code: STAT_FIELD_BY_ADVANCE[code] for code in HENCHMEN_ADVANCES},
    placeholder_advances=False,
    advance_log_type="henchmen",
    caster_traits=False,
    can_lead=False,
    recruit=RecruitSpec(LedgerAction.RECRUIT, "new_henchmen_group", "remove_henchmen_group"),
    cap=None,  # group max_size and warband max_units only warn (decision 12, BUG-67)
    unknown_name="Unknown",
    unknown_type="Unknown",
    hooks=HenchmenHooks(),
)

HIRED_SWORD = UnitKindSpec(
    key="hired_sword",
    url_segment="hired-swords",
    url_kwarg="hired_sword_id",
    collection="hired_swords",
    model=HiredSword,
    parent_field="hired_sword",
    items=LinkSpec("hired_sword_items", HiredSwordItem, "item", "items"),
    skills=LinkSpec("hired_sword_skills", HiredSwordSkill, "skill", "skill_ids", log_entry="hired_sword_skill"),
    specials=LinkSpec(
        "hired_sword_specials", HiredSwordSpecial, "special", "special_ids", log_entry="hired_sword_special"
    ),
    spells=LinkSpec("hired_sword_spells", HiredSwordSpell, "spell", "spell_ids", log_entry="hired_sword_spell"),
    has_members=False,
    thresholds_setting="hero_level_thresholds",  # hired swords advance like heroes (decision 8)
    count_level_ups=count_new_level_ups,
    has_no_level_ups=True,
    stat_advances=STAT_FIELD_BY_ADVANCE,
    placeholder_advances=True,
    advance_log_type="hired_sword",
    caster_traits=True,
    can_lead=False,
    recruit=RecruitSpec(LedgerAction.HIRE, "new_hired_sword", "remove_hired_sword"),
    cap=CapSpec(
        "max_hired_swords",
        3,
        "hired swords",
        "hired_sword_cap_reached",
        counted=_counted_hired_swords,
        exempt=lambda data: bool(data.get("blood_pacted", False)),
    ),
    unknown_name="Unknown Hired Sword",
    unknown_type="Unknown Type",
)

KINDS: Mapping[UnitKindKey, UnitKindSpec] = {kind.key: kind for kind in (HERO, HENCHMEN_GROUP, HIRED_SWORD)}
KIND_BY_MODEL: Mapping[type[RosterUnit], UnitKindSpec] = {kind.model: kind for kind in KINDS.values()}
