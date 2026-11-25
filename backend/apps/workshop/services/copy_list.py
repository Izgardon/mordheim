"""Copying a warband list (a warband template) into another campaign as that campaign's own (the workshop plan's
imports): a list imported into a campaign, a list or a warband's list copied into a workshop.

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
    TemplateListItem,
    TemplateUpgrade,
    WarbandTemplate,
)
from apps.warband_templates.services.own_specials import special_type

from .relink import Relinker, Warning, entry_links

MAX_NAME = 160
# the copied child rows that link catalogue entries, by their path in WARBAND_TEMPLATES.children
LINKED_CHILDREN: tuple[tuple[str, type[Model]], ...] = (
    ("lists__lines", TemplateListItem),
    ("fighters", TemplateFighter),
    ("fighters__special_links", TemplateFighterSpecial),
    ("fighters__skill_links", TemplateFighterSkill),
    ("upgrades", TemplateUpgrade),
)


@dataclass
class CopiedList:
    template: WarbandTemplate
    specials: dict[int, int] = field(default_factory=dict)  # the source's own specials -> their copies
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


def _relink_children(template: Any, relinker: Relinker) -> None:
    """Point the copy's child rows at the target's entries; a row that can't do without a link it lost goes."""
    copied: dict[str, dict[Any, Any]] = template.copied_ids
    for path, model in LINKED_CHILDREN:
        ids = list(copied.get(path, {}).values())
        if not ids:
            continue
        rows = list(model._default_manager.filter(pk__in=ids))
        relinker.prepare({model: rows})
        kept: list[Model] = []
        dropped: list[Model] = []
        for row in rows:
            (kept if relinker.relink(row) else dropped).append(row)
        fields = [attname for attname, _, _ in entry_links(model)]
        if kept:
            model._default_manager.bulk_update(kept, fields)
        if dropped:
            model._default_manager.filter(pk__in=[row.pk for row in dropped]).delete()


def copy_list(source: WarbandTemplate, campaign_id: int, user: Any, name: str | None = None) -> CopiedList:
    """The source list as the campaign's own template, with its own specials, in the caller's transaction; the
    campaign's catalogue lists are bumped (templates and specials)."""
    copy_name = free_name(campaign_id, (name or source.name).strip()[:MAX_NAME])
    specials = _copy_specials(source, copy_name, campaign_id)
    made = copy_entry(
        WARBAND_TEMPLATES,
        source,
        campaign_id,
        version=False,
        name=copy_name,
        slug="",
        copied_from_id=source.pk,
        updated_by_id=user.pk,
        updated_at=timezone.now(),
    )
    assert isinstance(made, WarbandTemplate)
    relinker = Relinker(campaign_id, {Special: specials})
    if source.campaign_id is not None:  # the book's links were pointed at the target's versions by copy_entry
        _relink_children(made, relinker)
    bump(campaign_id, *WARBAND_TEMPLATES.changed_lists)
    return CopiedList(template=made, specials=specials, warnings=relinker.warnings())
