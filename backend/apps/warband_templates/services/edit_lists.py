"""The editor's Lists (the templates plan, phase 4): an equipment list added, saved with its lines and who uses it, or
taken out. A list's `key` is made once, unique in the template, as a fighter's is. A save sends the whole list: its
name and note, the fighters who buy from it (by key) and its lines, each an item (the campaign's current entry for
it) at its list price, with who may take it by fighter key; a line keeps its row (and id) while it is sent."""

from collections.abc import Iterable
from typing import Any

from django.db.models import Max
from django.utils.text import slugify
from rest_framework.exceptions import NotFound, ValidationError

from ..models import TemplateFighter, TemplateFighterList, TemplateList, TemplateListItem, WarbandTemplate
from .resolve import variant_keys
from .sync import sync_rows

LIST_FIELDS = ("name", "note")


def list_at(template: WarbandTemplate, key: str) -> TemplateList:
    found = TemplateList.objects.filter(template=template, key=key).first()
    if found is None:
        raise NotFound("Not found")
    return found


def _new_key(template: WarbandTemplate, name: str) -> str:
    base = (slugify(name) or "list")[:72]
    taken = set(TemplateList.objects.filter(template=template).values_list("key", flat=True))
    key, number = base, 2
    while key in taken:
        key, number = f"{base}-{number}", number + 1
    return key


def check_who(who: dict[str, Any], keys: Iterable[str], label: str) -> None:
    """Who may take a line or an upgrade names the template's fighters only."""
    named = [*who.get("fighters", []), *who.get("except", [])]
    unknown = [key for key in named if key not in set(keys)]
    if unknown:
        raise ValidationError({label: [f"{key} isn't one of this template's fighters." for key in unknown]})


def check_variant(template: WarbandTemplate, variant: str, label: str) -> None:
    """A line or a rule for one variant names one the template has."""
    if variant and variant not in variant_keys(template):
        raise ValidationError({label: [f"{variant} isn't one of this template's variants."]})


def add_list(template: WarbandTemplate, data: dict[str, Any]) -> TemplateList:
    last = TemplateList.objects.filter(template=template).aggregate(last=Max("position"))["last"]
    made = TemplateList.objects.create(
        template=template,
        key=_new_key(template, data["name"]),
        position=0 if last is None else last + 1,
        name=data["name"],
        note=data["note"],
    )
    _write_contents(template, made, data)
    return made


def write_list(template: WarbandTemplate, key: str, data: dict[str, Any]) -> TemplateList:
    found = list_at(template, key)
    for field in LIST_FIELDS:
        setattr(found, field, data[field])
    found.save(update_fields=list(LIST_FIELDS))
    _write_contents(template, found, data)
    return found


def remove_list(template: WarbandTemplate, key: str) -> None:
    list_at(template, key).delete()  # its lines and who buys from it go with it


def _write_contents(template: WarbandTemplate, found: TemplateList, data: dict[str, Any]) -> None:
    """Who buys from the list, and its lines in the order sent (a book template's first save: its lines' ids are the
    book's, which the copy maps: `copied_ids`)."""
    fighters = dict(TemplateFighter.objects.filter(template=template).values_list("key", "id"))
    unknown = [key for key in data["fighters"] if key not in fighters]
    if unknown:
        raise ValidationError({"fighters": [f"{key} isn't one of this template's fighters." for key in unknown]})
    for line in data["lines"]:
        check_who(line["who"], fighters, "lines")
        check_variant(template, line["variant"], "lines")
    TemplateFighterList.objects.filter(equipment_list=found).delete()
    TemplateFighterList.objects.bulk_create(
        TemplateFighterList(fighter_id=fighters[key], equipment_list=found) for key in dict.fromkeys(data["fighters"])
    )
    copied = getattr(template, "copied_ids", {}).get("lists__lines", {})
    sync_rows(TemplateListItem, found.lines.all(), data["lines"], parent={"equipment_list": found}, copied=copied)
