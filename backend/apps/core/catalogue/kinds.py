"""The catalogue kinds registry (design 0.29 for the catalogue, IMP-79): each kind as data.

Items, skills, skill groups, spells, specials, races, bestiary entries, hired swords, dramatis personae and warband
templates, plus the add-only shared item rules. A spec (specs.py) names the kind's model and serializers, how its
list is filtered, the child rows an entry carries (what a version copies), the tables whose rows hold an entry (`holders`:
what a delete can't take with it, what `usage/` counts, and what a version's first edit moves onto it and Revert
moves back), the rows that follow an entry without holding it (`followers`: a campaign's skill group links)
and the entry of another kind that goes everywhere it goes (`twin`: a beast's Animal item). Differences that are
behaviour are hooks (hooks.py), as pass 1 did for units (`warbands/units/kinds.py`).
"""

from collections.abc import Mapping

from django.db.models import Model, Q

from apps.bestiary.models import (
    BestiaryEntry,
    BestiaryEntryItem,
    BestiaryEntrySkill,
    BestiaryEntrySpecial,
    BestiaryEntrySpell,
)
from apps.bestiary.selectors import by_kind
from apps.bestiary.serializers import BestiaryEntryWriteSerializer
from apps.hirelings.models import DramatisPersona, HiredSword
from apps.hirelings.serializers import DramatisPersonaWriteSerializer, HiredSwordWriteSerializer
from apps.items.models import Item, ItemRule
from apps.items.selectors import by_listing
from apps.items.serializers import ItemRuleSerializer, ItemWriteSerializer
from apps.races.models import Race
from apps.races.serializers import RaceCreateSerializer
from apps.skills.models import Skill, SkillGroup, SkillGroupSkill
from apps.skills.serializers import SkillCreateSerializer, SkillGroupWriteSerializer
from apps.special.models import Special
from apps.special.serializers import SpecialCreateSerializer
from apps.spells.models import Spell
from apps.spells.serializers import SpellCreateSerializer
from apps.warband_templates.models import (
    TemplateFighter,
    TemplateFighterSkill,
    TemplateFighterSpecial,
    TemplateListItem,
    TemplateUpgrade,
    WarbandTemplate,
)
from apps.warbands.models import HenchmenGroup, WarbandItem
from apps.warbands.units.kinds import KINDS as UNIT_KINDS

from .hooks import (
    BestiaryHooks,
    HirelingProfileHooks,
    ItemHooks,
    ItemRuleHooks,
    RaceHooks,
    SkillGroupHooks,
    SkillHooks,
    SpellHooks,
    WarbandTemplateHooks,
)
from .rows import (
    BestiaryEntryDetailRowSerializer,
    BestiaryEntryRowSerializer,
    DramatisPersonaDetailRowSerializer,
    DramatisPersonaRowSerializer,
    HiredSwordDetailRowSerializer,
    HiredSwordRowSerializer,
    ItemRowSerializer,
    RaceRowSerializer,
    SkillGroupRowSerializer,
    SkillRowSerializer,
    SpecialRowSerializer,
    SpellRowSerializer,
    WarbandTemplateDetailRowSerializer,
    WarbandTemplateRowSerializer,
)
from .specs import CatalogueKindSpec, Filter, Holder, Move, Twin, UsageKey


def _copies(link: str, *others: Holder) -> tuple[Holder, ...]:
    """The units' copies of an entry (each unit kind's `link` list: items, skills, specials or spells), and `others`."""
    copies = [
        Holder(
            model=spec.model,
            field=spec.target,
            campaign=f"{unit.parent_field}__warband__campaign_id",
            holder_id=f"{unit.parent_field}_id",
            warband=f"{unit.parent_field}__warband_id",
            unit_kind=unit.key,
        )
        for unit in UNIT_KINDS.values()
        if (spec := getattr(unit, link)) is not None
    ]
    return (*copies, *others)


def _linked_by(model: type[Model], target: str, unique: tuple[str, ...] = ()) -> Holder:
    return Holder(
        model=model,
        field=target,
        campaign="bestiary_entry__campaign_id",
        unique=unique,
        counts_as="bestiary_entries",
        holder_id="bestiary_entry_id",
    )


HIRELING_CATALOGUES: tuple[tuple[type[Model], UsageKey], ...] = (
    (HiredSword, "hired_swords"),
    (DramatisPersona, "dramatis_personae"),
)


def _listed_by_hirelings(links: str, target: str) -> tuple[Holder, ...]:
    """The hired swords' and dramatis personae's links of one kind (`links`: "skill_links") holding `target`; a kit
    lists an item once (its quantity says how many), so a moved item link meeting one merges into it, quantities
    added."""
    holders = []
    for model, counts_as in HIRELING_CATALOGUES:
        relation = model._meta.get_field(links)
        owner = relation.field.name  # type: ignore[union-attr]
        holders.append(
            Holder(
                model=relation.related_model,  # type: ignore[arg-type]
                field=target,
                campaign=f"{owner}__campaign_id",
                unique=(f"{owner}_id",) if target == "item" else (),
                adds="quantity" if target == "item" else None,  # a merged kit line keeps both quantities
                counts_as=counts_as,
                holder_id=f"{owner}_id",
            )
        )
    return tuple(holders)


def _held_by_templates(model: type[Model], target: str, template: str) -> Holder:
    """A warband template's child rows holding `target` (a list line's item, a fighter's race, rule or starting skill,
    an upgrade's special); `template` is the path from a row to its template."""
    return Holder(
        model=model,
        field=target,
        campaign=f"{template}__campaign_id",
        counts_as="warband_templates",
        holder_id=f"{template}_id",
    )


HIRELING_RACES = tuple(
    Holder(model=model, field="race", campaign="campaign_id", counts_as=counts_as)
    for model, counts_as in HIRELING_CATALOGUES
)


STASH = Holder(
    model=WarbandItem,
    field="item",
    campaign="warband__campaign_id",
    unique=("warband_id", "cost"),  # one stash row per item and cost (BUG-117): copies join the row of their cost
    adds="quantity",
    counts_as="stashes",
    holder_id="warband_id",
    warband="warband_id",
)
BEAST_GROUPS = Holder(  # a henchmen group recruited from a creature: joining and back to item need its beast
    model=HenchmenGroup,
    field="source_beast",
    campaign="warband__campaign_id",
    warband="warband_id",
    unit_kind="henchmen_group",
)
NAME_AND_TYPE: Mapping[str, Filter] = {
    "type": lambda value: Q(type__iexact=value),
    "search": lambda value: Q(name__icontains=value),
}

ITEMS = CatalogueKindSpec(
    key="items",
    noun="item",
    model=Item,
    url_kwarg="item_id",
    row_serializer=ItemRowSerializer,
    entry_serializer=ItemRowSerializer,
    write_serializer=ItemWriteSerializer,
    named=True,
    versioned=True,
    filters={**NAME_AND_TYPE, "listed": by_listing},  # the shop's list: ?listed=1
    reread=True,
    children=("rule_links", "availabilities", "availabilities__warband_links"),
    holders=_copies(
        "items",
        STASH,
        _linked_by(BestiaryEntryItem, "item", unique=("bestiary_entry_id",)),
        *_listed_by_hirelings("item_links", "item"),
        _held_by_templates(TemplateListItem, "item", "equipment_list__template"),
    ),
    hooks=ItemHooks(),
)
SKILLS = CatalogueKindSpec(
    key="skills",
    noun="skill",
    model=Skill,
    url_kwarg="skill_id",
    row_serializer=SkillRowSerializer,
    entry_serializer=SkillRowSerializer,
    write_serializer=SkillCreateSerializer,
    named=True,
    versioned=True,
    filters={"search": NAME_AND_TYPE["search"]},
    lists=("skills", "skill_groups"),  # a write may move it into or out of groups
    holders=_copies(
        "skills",
        _linked_by(BestiaryEntrySkill, "skill"),
        *_listed_by_hirelings("skill_links", "skill"),
        _held_by_templates(TemplateFighterSkill, "skill", "fighter__template"),  # a fighter's starting skills
    ),
    followers=(Move(SkillGroupSkill, "skill", "group__campaign_id", ("group_id",)),),  # the campaign's groups' links
    hooks=SkillHooks(),
)
SKILL_GROUPS = CatalogueKindSpec(  # skill groups (phase 1a): units name them in their skill access, nothing holds one
    key="skill_groups",
    noun="skill group",
    model=SkillGroup,
    url_kwarg="group_id",
    row_serializer=SkillGroupRowSerializer,
    entry_serializer=SkillGroupRowSerializer,
    write_serializer=SkillGroupWriteSerializer,
    named=True,
    versioned=True,
    filters={"search": NAME_AND_TYPE["search"]},
    reread=True,
    lists=("skill_groups", "skills"),
    children=("skill_links", "warband_links"),  # its skills and who learns from it
    hooks=SkillGroupHooks(),
)
SPELLS = CatalogueKindSpec(
    key="spells",
    noun="spell",
    model=Spell,
    url_kwarg="spell_id",
    row_serializer=SpellRowSerializer,
    entry_serializer=SpellRowSerializer,
    write_serializer=SpellCreateSerializer,
    named=True,
    versioned=True,
    filters=NAME_AND_TYPE,
    hooks=SpellHooks(),
    holders=_copies("spells", _linked_by(BestiaryEntrySpell, "spell"), *_listed_by_hirelings("spell_links", "spell")),
)
SPECIALS = CatalogueKindSpec(
    key="specials",
    noun="special",
    model=Special,
    url_kwarg="special_id",
    row_serializer=SpecialRowSerializer,
    entry_serializer=SpecialRowSerializer,
    write_serializer=SpecialCreateSerializer,
    named=True,
    versioned=True,
    filters=NAME_AND_TYPE,
    holders=_copies(
        "specials",
        _linked_by(BestiaryEntrySpecial, "special"),
        *_listed_by_hirelings("special_links", "special"),
        _held_by_templates(TemplateFighterSpecial, "special", "fighter__template"),
        _held_by_templates(TemplateUpgrade, "special", "template"),
    ),
)
RACES = CatalogueKindSpec(
    key="races",
    noun="race",
    model=Race,
    url_kwarg="race_id",
    row_serializer=RaceRowSerializer,
    entry_serializer=RaceRowSerializer,
    write_serializer=RaceCreateSerializer,
    named=True,
    versioned=True,
    filters={"search": NAME_AND_TYPE["search"]},
    lists=("races", "hired_swords", "dramatis_personae"),  # their rows name their race
    holders=(
        *(
            Holder(
                model=unit.model,
                field="race",
                campaign="warband__campaign_id",
                warband="warband_id",
                unit_kind=unit.key,
            )
            for unit in UNIT_KINDS.values()
        ),
        *HIRELING_RACES,
        _held_by_templates(TemplateFighter, "race", "template"),
    ),
    hooks=RaceHooks(),
)
BESTIARY = CatalogueKindSpec(
    key="bestiary",
    noun="bestiary entry",
    model=BestiaryEntry,
    url_kwarg="entry_id",
    row_serializer=BestiaryEntryRowSerializer,
    entry_serializer=BestiaryEntryDetailRowSerializer,
    write_serializer=BestiaryEntryWriteSerializer,
    named=True,
    versioned=True,
    filters={"kind": by_kind, "search": NAME_AND_TYPE["search"]},
    reread=True,
    lists=("bestiary", "items"),  # its Animal item is written with it
    children=("bestiary_entry_skills", "bestiary_entry_specials", "bestiary_entry_spells", "bestiary_entry_items"),
    holders=(BEAST_GROUPS,),  # units copy their profile from it; only a group recruited from it holds it
    twin=Twin(ITEMS, "bestiary_entry"),
    hooks=BestiaryHooks(),
)
HIRELING_LINKS = ("skill_links", "special_links", "spell_links", "item_links", "warband_links")
HIRED_SWORDS = CatalogueKindSpec(
    key="hired_swords",
    noun="hired sword",
    model=HiredSword,
    url_kwarg="hired_sword_id",
    row_serializer=HiredSwordRowSerializer,
    entry_serializer=HiredSwordDetailRowSerializer,
    write_serializer=HiredSwordWriteSerializer,
    named=True,
    versioned=True,
    filters={"search": NAME_AND_TYPE["search"]},
    reread=True,
    children=HIRELING_LINKS,  # hirelings copy what they take from one on hire: nothing holds it
    hooks=HirelingProfileHooks(HiredSword),
)
DRAMATIS_PERSONAE = CatalogueKindSpec(
    key="dramatis_personae",
    noun="dramatis persona",
    model=DramatisPersona,
    url_kwarg="dramatis_persona_id",
    row_serializer=DramatisPersonaRowSerializer,
    entry_serializer=DramatisPersonaDetailRowSerializer,
    write_serializer=DramatisPersonaWriteSerializer,
    named=True,
    versioned=True,
    filters={"search": NAME_AND_TYPE["search"]},
    reread=True,
    children=HIRELING_LINKS,
    hooks=HirelingProfileHooks(DramatisPersona),
)
WARBAND_TEMPLATES = CatalogueKindSpec(  # written by the template editor's own routes (the templates plan, phase 4)
    key="warband_templates",
    noun="warband template",
    model=WarbandTemplate,
    url_kwarg="template_id",
    row_serializer=WarbandTemplateRowSerializer,
    entry_serializer=WarbandTemplateDetailRowSerializer,
    named=True,
    versioned=True,
    filters={"search": NAME_AND_TYPE["search"]},
    lists=("warband_templates", "specials"),  # an editor write may add the template's own specials
    children=(  # parents first: a fighter's lists point at the copy's lists (versions.py)
        "type_links",
        "rules",
        "lists",
        "lists__lines",
        "fighters",
        "fighters__special_links",
        "fighters__skill_links",
        "fighters__list_links",
        "upgrades",
    ),
    hooks=WarbandTemplateHooks(),
)
ITEM_RULES = CatalogueKindSpec(  # the shared rules: added, never edited or deleted
    key="item_rules",
    noun="item rule",
    model=ItemRule,
    url_kwarg="rule_id",
    row_serializer=ItemRuleSerializer,
    entry_serializer=ItemRuleSerializer,
    write_serializer=ItemRuleSerializer,
    filters={"search": NAME_AND_TYPE["search"]},
    order=("name", "id"),
    hooks=ItemRuleHooks(),
)

CATALOGUE_KINDS: Mapping[str, CatalogueKindSpec] = {
    kind.key: kind
    for kind in (
        ITEMS,
        SKILLS,
        SKILL_GROUPS,
        SPELLS,
        SPECIALS,
        RACES,
        BESTIARY,
        HIRED_SWORDS,
        DRAMATIS_PERSONAE,
        WARBAND_TEMPLATES,
    )
}
LIST_KINDS: Mapping[str, CatalogueKindSpec] = {
    **CATALOGUE_KINDS,
    "item_rules": ITEM_RULES,
}
