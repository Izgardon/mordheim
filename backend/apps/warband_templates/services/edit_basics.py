"""The editor's Basics (the templates plan, phase 4): the name, the setting, the book's starting gold and most warriors,
the variants with their own terms, and the warband types the template serves with each one's preset variant.

A variant taken out takes its own rules and list lines with it, and its changes to each fighter; a type that preset it
is picked again when raising. Warbands already raised keep their variant as it is (a roster is never changed)."""

from typing import Any

from ..models import TemplateFighter, TemplateListItem, TemplateRule, WarbandTemplate, WarbandTemplateType

BASIC_FIELDS = ("name", "campaign_type", "starting_gold", "max_models", "variants")


def unchanged(template: WarbandTemplate, data: dict[str, Any]) -> bool:
    """The Basics sent are the template's as they stand (one query, for its types): saving them writes nothing, so a
    book template gets no house version (William, 5 Nov)."""
    setting = data["campaign_type"]
    own = (
        template.name,
        template.campaign_type_id,
        template.starting_gold,
        template.max_models,
        template.variants or [],
    )
    sent = (data["name"], setting.pk if setting else None, data["starting_gold"], data["max_models"], data["variants"])
    types = {link.warband_type_id: link.variant for link in template.type_links.all()}
    return own == sent and types == {row["id"]: row["variant"] for row in data["types"]}


def write_basics(template: WarbandTemplate, data: dict[str, Any]) -> None:
    """Save the Basics: the template's own fields, its types, and what a variant taken out leaves behind."""
    kept = {entry["key"] for entry in data["variants"]}
    dropped = {str(entry.get("key")) for entry in template.variants or []} - kept
    for field in BASIC_FIELDS:
        setattr(template, field, data[field])
    template.save(update_fields=list(BASIC_FIELDS))
    if dropped:
        _drop_variants(template, dropped)
    _write_types(template, data["types"])


def _drop_variants(template: WarbandTemplate, dropped: set[str]) -> None:
    TemplateRule.objects.filter(template=template, variant__in=dropped).delete()
    TemplateListItem.objects.filter(equipment_list__template=template, variant__in=dropped).delete()
    fighters = [fighter for fighter in template.fighters.all() if set(fighter.variant_changes or {}) & dropped]
    for fighter in fighters:
        fighter.variant_changes = {key: value for key, value in fighter.variant_changes.items() if key not in dropped}
    if fighters:
        TemplateFighter.objects.bulk_update(fighters, ["variant_changes"])


def _write_types(template: WarbandTemplate, types: list[dict[str, Any]]) -> None:
    """The types it serves become those sent (`{"id", "variant"}`); a type kept keeps its row."""
    links = {link.warband_type_id: link for link in template.type_links.all()}
    sent = {row["id"]: row["variant"] for row in types}
    WarbandTemplateType.objects.filter(pk__in=[link.pk for key, link in links.items() if key not in sent]).delete()
    changed = []
    for type_id, link in links.items():
        if type_id in sent and link.variant != sent[type_id]:
            link.variant = sent[type_id]
            changed.append(link)
    if changed:
        WarbandTemplateType.objects.bulk_update(changed, ["variant"])
    WarbandTemplateType.objects.bulk_create(
        WarbandTemplateType(
            template=template, campaign_id=template.campaign_id, warband_type_id=type_id, variant=variant
        )
        for type_id, variant in sent.items()
        if type_id not in links
    )
