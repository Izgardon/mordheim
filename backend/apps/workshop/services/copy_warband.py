"""The warband deep copy (the workshop plan's imports): a warband copied whole into another campaign (a workshop's
imported into a campaign or another player's workshop, or a campaign's copied into its owner's workshop), owned by
the importer, in its exact state.

Copied: the warband's own fields (name, type and what it counts as, variant, dice colour, backstory, link, most
warriors, the mobile loadout switch), its rules (not a plot's: those are written from the plot it follows), its stash,
and every unit still on its roster (heroes, henchmen groups and their members still in them, hired swords) with
everything each holds: kit (a mount or pet switched on stays so), a group's loadout rows and its members' gaps,
skills, spells (and how much easier each has got), specials, pending picks, XP, level-ups and their history, fighter
keys, notes and deeds. A dead or dismissed unit or member has left the roster and stays behind. Not copied: the ledger
and the log, resources, campaign points and the plot, battles, wins and losses, encampments and bounties. Every
catalogue link becomes the target's current entry (`relink.py`). When the warband reads its campaign's own list (a
workshop's list it names, or a campaign's own or house template for its type), that list comes too as the target's
own template (`copy_list.py`). In a workshop the copy is a workshop's warband: its own code, and the list it names
(that copy, else the book's template it read); one made with no list stays so there, and reads its type's template in
a campaign.

A fixed number of queries whatever the roster's size: each table is read once and written in one INSERT.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from django.db.models import Model

from apps.campaigns.models import Campaign
from apps.warband_templates.models import WarbandTemplate
from apps.warband_templates.services.raising import open_treasury
from apps.warband_templates.services.resolve import template_for_type, template_for_warband, warband_variant
from apps.warbands.models import (
    Henchman,
    HenchmanItemGap,
    HenchmenGroup,
    HenchmenGroupItem,
    HenchmenGroupSkill,
    HenchmenGroupSpecial,
    Hero,
    HeroItem,
    HeroSkill,
    HeroSpecial,
    HeroSpell,
    Hireling,
    HirelingItem,
    HirelingSkill,
    HirelingSpecial,
    HirelingSpell,
    Warband,
    WarbandItem,
    WarbandRule,
)

from .codes import unique_share_code
from .content import Target, carry, foreign_types
from .copy_list import CopiedList, copy_list
from .relink import Relinker, Warning

SERVES_NONE = (
    "Its list {name} came too, serving no warband type, so recruiting reads this campaign's list for its type: "
    "someone who edits the catalogue can make it serve its type."
)
ALIVE = {"dead": False, "dismissed_at__isnull": True}
# the warband's own fields a copy keeps (the rest: its campaign, owner, gold, plot, points, wins and losses, dates)
WARBAND_FIELDS = (
    "name",
    "warband_type_id",
    "dice_color",
    "backstory",
    "warband_link",
    "max_units",
    "template_variant",
    "show_loadout_on_mobile",
)


@dataclass(frozen=True)
class Table:
    """A table of rows the warband owns: under `parent` (the attname of its link to a copied row of `parent_model`),
    the rows `keep` keeps, and its links to other copied rows (`links`: attname -> model)."""

    model: type[Model]
    parent: str
    parent_model: type[Model]
    keep: Mapping[str, Any] = field(default_factory=dict)
    links: Mapping[str, type[Model]] = field(default_factory=dict)


# parents before their children
TABLES: tuple[Table, ...] = (
    Table(WarbandItem, "warband_id", Warband),
    Table(WarbandRule, "warband_id", Warband, keep={"from_plot__isnull": True}),
    Table(Hero, "warband_id", Warband, keep=ALIVE),
    Table(HeroItem, "hero_id", Hero),
    Table(HeroSkill, "hero_id", Hero),
    Table(HeroSpecial, "hero_id", Hero),
    Table(HeroSpell, "hero_id", Hero),
    Table(Hireling, "warband_id", Warband, keep=ALIVE),
    Table(HirelingItem, "hireling_id", Hireling),
    Table(HirelingSkill, "hireling_id", Hireling),
    Table(HirelingSpecial, "hireling_id", Hireling),
    Table(HirelingSpell, "hireling_id", Hireling),
    Table(HenchmenGroup, "warband_id", Warband, keep=ALIVE),
    Table(Henchman, "group_id", HenchmenGroup, keep=ALIVE),
    Table(HenchmenGroupItem, "henchmen_group_id", HenchmenGroup),
    Table(HenchmanItemGap, "henchman_id", Henchman, links={"group_item_id": HenchmenGroupItem}),
    Table(HenchmenGroupSkill, "henchmen_group_id", HenchmenGroup),
    Table(HenchmenGroupSpecial, "henchmen_group_id", HenchmenGroup),
)


@dataclass
class CopiedWarband:
    warband: Warband
    template: WarbandTemplate | None  # the list that came with it, as the target's own; None: none came
    warnings: list[Warning] = field(default_factory=list)


def _read(source: Warband) -> dict[type[Model], list[Model]]:
    """Every row the warband owns that a copy takes, table by table (one query each)."""
    ids: dict[type[Model], list[int]] = {Warband: [source.pk]}
    rows: dict[type[Model], list[Model]] = {}
    for table in TABLES:
        parents = ids.get(table.parent_model, [])
        found = list(
            table.model._default_manager.filter(**{f"{table.parent}__in": parents}, **table.keep).order_by("pk")
        )
        rows[table.model] = found
        ids[table.model] = [row.pk for row in found]
    return rows


def _clone(row: Model, **changes: Any) -> Model:
    values = {f.attname: getattr(row, f.attname) for f in row._meta.concrete_fields if not f.primary_key}
    return type(row)(**{**values, **changes})


def _write(
    rows: dict[type[Model], list[Model]], source: Warband, warband: Warband, relinker: Relinker, renamed: dict[str, str]
) -> None:
    """Each table's copies in one INSERT, linked to their copied parents and rows and the target's entries (a unit's
    skill access naming a group copied under a new name names the copy)."""
    copied: dict[type[Model], dict[int, int]] = {Warband: {source.pk: warband.pk}}
    for table in TABLES:
        clones, originals = [], []
        for row in rows[table.model]:
            links = {table.parent: copied[table.parent_model].get(getattr(row, table.parent))}
            links.update({attname: copied[model].get(getattr(row, attname)) for attname, model in table.links.items()})
            if any(value is None for value in links.values()):
                continue  # its parent or a row it links was left out
            clone: Any = _clone(row, **links)
            if renamed and isinstance(getattr(clone, "available_skills", None), dict):
                clone.available_skills = {renamed.get(key, key): on for key, on in clone.available_skills.items()}
            if relinker.relink(clone):
                clones.append(clone)
                originals.append(row)
        made = table.model._default_manager.bulk_create(clones) if clones else []
        copied[table.model] = {old.pk: new.pk for old, new in zip(originals, made, strict=True)}


def _list_for(source_template: WarbandTemplate | None, source: Warband, target: Target) -> CopiedList | None:
    """The source's own list copied into the target (its campaign's own or house template, a workshop's list), or
    None for a book template or none; a workshop's copy gets its own code."""
    if source_template is None or source_template.campaign_id != source.campaign_id:
        return None
    code = unique_share_code() if target.campaign.is_workshop else None
    return copy_list(source_template, target, share_code=code)


def _named(target: Campaign, copied: WarbandTemplate | None, read: WarbandTemplate | None) -> WarbandTemplate | None:
    """The list a copy names in a workshop: the copy of its own, else the book's template it read; none elsewhere."""
    if not target.is_workshop:
        return None
    if copied is not None:
        return copied
    return read if read is not None and read.campaign_id is None else None


def _types(source: Warband, target: Campaign, relinker: Relinker) -> tuple[int | None, list[int]]:
    """The copy's type and the types it counts as: another campaign's own one is left out, and said so (one query)."""
    counted = list(source.counts_as.values_list("pk", "name"))
    names = dict(counted)
    if source.warband_type is not None:
        names[source.warband_type.pk] = source.warband_type.name
    foreign = foreign_types(target.pk, set(names))
    relinker.left_out += [str(names[pk]) for pk in sorted(foreign)]
    kept_type = source.warband_type_id if source.warband_type_id not in foreign else None
    return kept_type, [pk for pk, _ in counted if pk not in foreign]


def copy_warband(source: Warband, target: Campaign, user: Any, editor: bool = True) -> CopiedWarband:
    """The copy, in the caller's transaction, with its Starting Gold row (`raising.open_treasury`: the target's gold
    and the copy's template) and nothing paid yet, and the custom content it uses (content.py); the warnings in the
    server's words. `editor`: the importer may edit the target's catalogue (always, in his own workshop).

    A list that comes with it serves its types in a campaign only for an editor, because a campaign's own template
    serves its type for every warband there; otherwise it arrives serving none, so the copy keeps its list's rules
    and nobody else's list changes, and the custom content arrives archived. In a workshop the copy names its list,
    so the list keeps the types it serves."""
    goal = Target(campaign=target, user=user, live=editor)
    source_template = template_for_warband(source)  # its named list, else its type's in its campaign
    listed = _list_for(source_template, source, goal)
    if listed is not None and not editor and not target.is_workshop:
        listed.template.type_links.all().delete()
        name = listed.template.name
        listed.warnings.append({"code": "list_serves_none", "message": SERVES_NONE.format(name=name), "names": [name]})
    rows = _read(source)
    carried = carry(source.campaign_id, goal, rows, listed.carried.own if listed else {})
    relinker = Relinker(target.pk, carried.own)
    relinker.prepare(rows)
    if source.warband_type is not None:
        relinker.note(source.warband_type)
    type_id, counts_as = _types(source, target, relinker)
    named = _named(target, listed.template if listed else None, source_template)
    fields = {name: getattr(source, name) for name in WARBAND_FIELDS}
    warband = Warband.objects.create(
        campaign=target,
        user=user,
        in_workshop=target.is_workshop,
        share_code=unique_share_code() if target.is_workshop else None,
        template=named,
        no_list=source.no_list and target.is_workshop,  # one with no list stays so in a workshop
        **{**fields, "warband_type_id": type_id},
    )
    warband.counts_as.set(counts_as)
    template = None
    if not warband.no_list:
        template = named or (listed.template if listed else template_for_type(target.pk, warband.warband_type_id))
    open_treasury(warband, template, warband_variant(warband, template) if template is not None else "")
    _write(rows, source, warband, relinker, {**(listed.carried.renamed if listed else {}), **carried.renamed})
    warnings = [*(listed.warnings if listed else []), *relinker.warnings(), *carried.warnings(editor)]
    return CopiedWarband(warband=warband, template=listed.template if listed else None, warnings=_merged(warnings))


def _merged(warnings: list[Warning]) -> list[Warning]:
    """One warning per code: the list's and the roster's names together."""
    merged: dict[str, Warning] = {}
    for warning in warnings:
        held = merged.get(warning["code"])
        if held is None:
            merged[warning["code"]] = dict(warning)
            continue
        names = sorted(set(held.get("names", [])) | set(warning.get("names", [])))
        held["names"] = names
        held["message"] = warning["message"].split(":")[0] + ": " + ", ".join(names) + "."
    return list(merged.values())
