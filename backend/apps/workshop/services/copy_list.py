"""Copying a warband list (a warband template) into another campaign as that campaign's own (the workshop plan's
imports): a list imported into a campaign, a list or a warband's list copied into a workshop (with its own code), with
the custom content it uses (content.py: its items, races, skills and specials, linked or copied).

The copy is the template editor's copy (`versions.copy_entry` with `version` off: every child row, its fighters' keys,
the types it serves), made across campaigns: the rules the source campaign wrote for it (its own specials, typed
"Warband - <list>", `own_specials.py`) are copied too, typed by the copy's name, and its fighters and upgrades point
at those copies; every other link is the target's current entry (`relink.py`). A name the target already uses gets a
number, "Night Watch (2)". `copied_from` keeps the source.
"""

from dataclasses import dataclass, field
from typing import Any

from django.db.models import Model
from django.utils import timezone

from apps.core.catalogue.cache import bump
from apps.core.catalogue.kinds import WARBAND_TEMPLATES
from apps.core.catalogue.versions import copy_entry
from apps.special.models import Special
from apps.warband_templates.models import (
    TemplateFighter,
    TemplateFighterSkill,
    TemplateFighterSpecial,
    TemplateFighterSpell,
    TemplateListItem,
    TemplateUpgrade,
    WarbandTemplate,
    WarbandTemplateType,
)
from apps.warband_templates.services.own_specials import special_type

from .content import Carried, Target, carry
from .relink import Relinker, Warning, entry_links

MAX_NAME = 160
# the copied child rows that link catalogue entries, by their path in WARBAND_TEMPLATES.children
LINKED_CHILDREN: tuple[tuple[str, type[Model]], ...] = (
    ("lists__lines", TemplateListItem),
    ("fighters", TemplateFighter),
    ("fighters__special_links", TemplateFighterSpecial),
    ("fighters__skill_links", TemplateFighterSkill),
    ("fighters__spell_links", TemplateFighterSpell),
    ("upgrades", TemplateUpgrade),
)


@dataclass
class CopiedList:
    template: WarbandTemplate
    specials: dict[int, int] = field(default_factory=dict)  # the source's own specials -> their copies
    carried: Carried = field(default_factory=Carried)  # its custom content, as the target now holds it
    warnings: list[Warning] = field(default_factory=list)


def free_name(campaign_id: int, name: str) -> str:
    """`name`, or with the first number the campaign's templates don't use (one query)."""
    taken = set(
        WarbandTemplate.objects.filter(campaign_id=campaign_id, name__startswith=name[: MAX_NAME - 6]).values_list(
            "name", flat=True
        )
    )
    if name not in taken:
        return name
    number = 2
    while f"{name[: MAX_NAME - 6]} ({number})" in taken:
        number += 1
    return f"{name[: MAX_NAME - 6]} ({number})"


def _own_specials(source: WarbandTemplate) -> list[Special]:
    """The source campaign's own specials its fighters and upgrades hold (one query)."""
    if source.campaign_id is None:
        return []
    held = Special.objects.filter(campaign_id=source.campaign_id)
    fighters = held.filter(template_fighter_links__fighter__template=source)
    upgrades = held.filter(template_upgrades__template=source)
    return list((fighters | upgrades).distinct().order_by("pk"))


def _copy_specials(source: WarbandTemplate, copy_name: str, campaign_id: int) -> dict[int, int]:
    """Copies of the source's own specials in the campaign, its own type renamed for the copy (one INSERT)."""
    originals = _own_specials(source)
    if not originals:
        return {}
    old_type, new_type = special_type(source), f"Warband - {copy_name}"
    copies = []
    for special in originals:
        values = {f.attname: getattr(special, f.attname) for f in special._meta.concrete_fields if not f.primary_key}
        values.update(campaign_id=campaign_id, replaces_id=None, archived_at=None, archived_by_id=None)
        values.update(updated_at=None, updated_by_id=None)
        if special.type == old_type:
            values["type"] = new_type
        copies.append(Special(**values))
    made = Special.objects.bulk_create(copies)
    return {old.pk: new.pk for old, new in zip(originals, made, strict=True)}


def _children(template: Any) -> dict[type[Model], list[Model]]:
    """The copy's child rows that link catalogue entries, by table (one query each)."""
    copied: dict[str, dict[Any, Any]] = template.copied_ids
    rows: dict[type[Model], list[Model]] = {}
    for path, model in LINKED_CHILDREN:
        ids = list(copied.get(path, {}).values())
        if ids:
            rows[model] = list(model._default_manager.filter(pk__in=ids))
    return rows


def _rename_groups(fighter: Any, renamed: dict[str, str]) -> None:
    """A fighter's skill groups, his own and each variant's, named as their copies are ("Thieving (2)")."""
    fighter.skill_types = [renamed.get(str(name), name) for name in fighter.skill_types]
    for change in fighter.variant_changes.values():
        if isinstance(change, dict) and change.get("skill_types"):
            change["skill_types"] = [renamed.get(str(name), name) for name in change["skill_types"]]


def _relink_children(rows: dict[type[Model], list[Model]], relinker: Relinker, renamed: dict[str, str]) -> None:
    """Point the copy's child rows at the target's entries (a fighter's skill groups at their copies' names); a row
    that can't do without a link it lost goes."""
    relinker.prepare(rows)
    for model, found in rows.items():
        kept: list[Model] = []
        dropped: list[Model] = []
        for row in found:
            (kept if relinker.relink(row) else dropped).append(row)
        fields = [attname for attname, _, _ in entry_links(model)]
        if model is TemplateFighter and renamed:
            for fighter in kept:
                _rename_groups(fighter, renamed)
            fields += ["skill_types", "variant_changes"]
        if kept:
            model._default_manager.bulk_update(kept, fields)
        if dropped:
            model._default_manager.filter(pk__in=[row.pk for row in dropped]).delete()


def _drop_foreign_types(template: Any, target_id: int) -> list[str]:
    """The types the copy serves that are another campaign's own go; their names (two queries, none for none)."""
    ids = list(template.copied_ids.get("type_links", {}).values())
    links = WarbandTemplateType.objects.filter(pk__in=ids, warband_type__campaign__isnull=False).exclude(
        warband_type__campaign_id=target_id
    )
    names = list(links.values_list("warband_type__name", flat=True)) if ids else []
    if names:
        links.delete()
    return names


def copy_list(
    source: WarbandTemplate, target: Target, name: str | None = None, share_code: str | None = None
) -> CopiedList:
    """The source list as the target's own template, with its own specials and the custom content it uses
    (content.py), in the caller's transaction; the target's catalogue lists are bumped (templates and specials).
    `share_code`: a workshop's copy's code."""
    campaign_id = target.campaign.pk
    copy_name = free_name(campaign_id, (name or source.name).strip()[:MAX_NAME])
    specials = _copy_specials(source, copy_name, campaign_id)
    made = copy_entry(
        WARBAND_TEMPLATES,
        source,
        campaign_id,
        version=False,
        name=copy_name,
        slug="",
        share_code=share_code,
        copied_from_id=source.pk,
        updated_by_id=target.user.pk,
        updated_at=timezone.now(),
    )
    assert isinstance(made, WarbandTemplate)
    carried = Carried(own={Special: specials})
    relinker = Relinker(campaign_id, carried.own)
    if source.campaign_id is not None:  # the book's links were pointed at the target's versions by copy_entry
        rows = _children(made)
        carried = carry(source.campaign_id, target, rows, {Special: specials})
        relinker = Relinker(campaign_id, carried.own)
        _relink_children(rows, relinker, carried.renamed)
    relinker.left_out += _drop_foreign_types(made, campaign_id)
    bump(campaign_id, *WARBAND_TEMPLATES.changed_lists)
    warnings = [*relinker.warnings(), *carried.warnings(target.live)]
    return CopiedList(template=made, specials=specials, carried=carried, warnings=warnings)
