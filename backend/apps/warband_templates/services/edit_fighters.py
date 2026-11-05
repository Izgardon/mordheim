"""The editor's Fighters (the templates plan, phase 4): a hero or a henchman added, saved or taken out.

A fighter's `key` is what a unit remembers it was recruited as (`fighter_key`), so it is made once, unique in the
template, and never changes; a house version copies the keys, so units keep pointing at the right fighter. A save
sends the whole fighter: his figures and profile as written, his skill groups and spell lores, the lists he buys from
(by key) and his rules (specials picked or written: own_specials.py). His variant changes are copied with the template
and kept as they are. Taking him out leaves the units recruited as him as they are, and takes his key out of the lists'
and upgrades' who."""

from collections.abc import Iterable
from typing import Any

from django.db.models import Max
from django.utils.text import slugify
from rest_framework.exceptions import NotFound, ValidationError

from apps.warbands.models.shared import STAT_FIELDS

from ..models import (
    HERO,
    TemplateFighter,
    TemplateFighterList,
    TemplateFighterSpecial,
    TemplateList,
    TemplateListItem,
    TemplateUpgrade,
    WarbandTemplate,
)
from .own_specials import specials_for

FIGHTER_FIELDS = (
    "name",
    "plural",
    "race",
    "cost",
    "starting_xp",
    "min_count",
    "max_count",
    "group_min",
    "group_max",
    "skill_types",
    "spell_types",
    "gains_xp",
    "promotable",
    "is_leader",
    "caster",
    "large",
    "fixed_kit",
    "written_stats",
)


def fighter_at(template: WarbandTemplate, key: str) -> TemplateFighter:
    fighter = TemplateFighter.objects.filter(template=template, key=key).first()
    if fighter is None:
        raise NotFound("Not found")
    return fighter


def new_key(template: WarbandTemplate, name: str) -> str:
    """A key unique in the template, from the fighter's name: "watchmen", then "watchmen-2"."""
    base = (slugify(name) or "fighter")[:72]
    taken = set(TemplateFighter.objects.filter(template=template).values_list("key", flat=True))
    key, number = base, 2
    while key in taken:
        key, number = f"{base}-{number}", number + 1
    return key


def add_fighter(template: WarbandTemplate, data: dict[str, Any]) -> TemplateFighter:
    """A new fighter after the others, with a new key."""
    last = TemplateFighter.objects.filter(template=template).aggregate(last=Max("position"))["last"]
    fighter = TemplateFighter(
        template=template,
        key=new_key(template, data.get("plural") or data["name"]),
        kind=data["kind"],
        position=0 if last is None else last + 1,
    )
    _fill(fighter, data)
    fighter.save()
    _write_links(template, fighter, data)
    return fighter


def write_fighter(template: WarbandTemplate, key: str, data: dict[str, Any]) -> TemplateFighter:
    """The fighter of the key becomes what was sent; his kind and key stay."""
    fighter = fighter_at(template, key)
    _fill(fighter, data)
    fighter.save()
    _write_links(template, fighter, data)
    return fighter


def remove_fighter(template: WarbandTemplate, key: str) -> None:
    fighter_at(template, key).delete()
    _forget_key(template, key)


def _fill(fighter: TemplateFighter, data: dict[str, Any]) -> None:
    for field in (*FIGHTER_FIELDS, *STAT_FIELDS):
        setattr(fighter, field, data[field])
    if fighter.kind == HERO:  # a hero is never a group
        fighter.group_min = fighter.group_max = None


def _write_links(template: WarbandTemplate, fighter: TemplateFighter, data: dict[str, Any]) -> None:
    """His lists (by key, each of the template's) and his rules, in the order sent."""
    lists = dict(TemplateList.objects.filter(template=template).values_list("key", "id"))
    unknown = [key for key in data["lists"] if key not in lists]
    if unknown:
        raise ValidationError({"lists": [f"{key} isn't one of this template's lists." for key in unknown]})
    TemplateFighterList.objects.filter(fighter=fighter).delete()
    TemplateFighterList.objects.bulk_create(
        TemplateFighterList(fighter=fighter, equipment_list_id=lists[key]) for key in dict.fromkeys(data["lists"])
    )
    TemplateFighterSpecial.objects.filter(fighter=fighter).delete()
    special_ids = list(dict.fromkeys(specials_for(template, data["rules"])))
    TemplateFighterSpecial.objects.bulk_create(
        TemplateFighterSpecial(fighter=fighter, special_id=special_id, position=n)
        for n, special_id in enumerate(special_ids)
    )


def _without(who: dict[str, Any], key: str) -> dict[str, Any]:
    """`who` with the key taken out of its names; one left naming nobody is open to everyone again."""
    trimmed = {
        name: [entry for entry in value if entry != key] if isinstance(value, list) else value
        for name, value in who.items()
    }
    if "except" in trimmed:
        return trimmed if trimmed["except"] else {}
    return trimmed if trimmed.get("heroes") or trimmed.get("fighters") else {}


def _naming(rows: Iterable[Any], key: str) -> list[Any]:
    """The rows whose who names the key, with it taken out."""
    named = [row for row in rows if key in [*row.who.get("fighters", []), *row.who.get("except", [])]]
    for row in named:
        row.who = _without(row.who, key)
    return named


def _forget_key(template: WarbandTemplate, key: str) -> None:
    """A fighter taken out leaves no line or upgrade naming him (two reads, two writes at most)."""
    lines = _naming(TemplateListItem.objects.filter(equipment_list__template=template), key)
    if lines:
        TemplateListItem.objects.bulk_update(lines, ["who"])
    upgrades = _naming(TemplateUpgrade.objects.filter(template=template), key)
    if upgrades:
        TemplateUpgrade.objects.bulk_update(upgrades, ["who"])
