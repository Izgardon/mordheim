"""Which template a warband uses (the templates plan, phase 2), found from its type and read with its variant applied.

The campaign's own template for the type comes first: one made in the campaign, or its house version of the book's.
Otherwise the book's template for the type, unless the campaign replaced or removed it. Otherwise none, and recruiting
is typed by hand as before. Archived templates serve nobody. The types a warband counts as never pick one. The
variant is the warband's (`template_variant`): its type's preset, else picked when raising, changeable in Settings.
"""

from collections.abc import Iterable, Mapping
from typing import Any

from django.db.models import Exists, F, OuterRef, Q, QuerySet, Subquery

from apps.core.models import CatalogueRemoval
from apps.warbands.models import Warband
from apps.warbands.models.shared import STAT_FIELDS

from ..models import TemplateFighter, TemplateRule, WarbandTemplate, WarbandTemplateType

KIND = "warband_templates"  # the catalogue kind's key (apps/core/catalogue/kinds.py)
# what a variant may change on a fighter (`variant_changes`): his skill groups, spell lores, profile or group size
VARIANT_FIELDS = frozenset(
    {"skill_types", "spell_types", "cost", "starting_xp", "group_min", "group_max", *STAT_FIELDS, "written_stats"}
)


def templates_for_type(campaign_id: int, warband_type_id: int | None) -> QuerySet[WarbandTemplate]:
    """The templates serving the type in the campaign, the campaign's own first, each with the variant the type
    presets (`preset_variant`, blank: picked when raising). One query when read."""
    if warband_type_id is None:
        return WarbandTemplate.objects.none()
    ref = OuterRef("pk")
    replaced = WarbandTemplate.objects.filter(campaign_id=campaign_id, replaces_id=ref)
    removed = CatalogueRemoval.objects.filter(campaign_id=campaign_id, kind=KIND, entry_id=ref)
    book = Q(campaign__isnull=True) & ~Exists(replaced) & ~Exists(removed)
    preset = WarbandTemplateType.objects.filter(template_id=ref, warband_type_id=warband_type_id).values("variant")
    rows = WarbandTemplate.objects.filter(
        Q(campaign_id=campaign_id) | book, archived_at__isnull=True, type_links__warband_type_id=warband_type_id
    )
    found: QuerySet[WarbandTemplate] = rows.annotate(preset_variant=Subquery(preset[:1])).order_by(
        F("campaign_id").asc(nulls_last=True), "id"
    )
    return found


def template_for_type(campaign_id: int, warband_type_id: int | None) -> WarbandTemplate | None:
    """The template a warband of the type uses in the campaign, or None (one query)."""
    return templates_for_type(campaign_id, warband_type_id).first()


def template_id_for(warband: Warband) -> Subquery:
    """The warband's template's id as a subquery, for a read that wants its rows in the same query."""
    rows = templates_for_type(warband.campaign_id, warband.warband_type_id)
    return Subquery(rows.values("pk")[:1])


def warband_variant(warband: Warband, template: WarbandTemplate) -> str:
    """The variant the warband's template reads with: its own, else its type's preset (`templates_for_type`), so a
    warband raised before it had one still reads as its type."""
    return warband.template_variant or str(getattr(template, "preset_variant", "") or "")


def variant_keys(template: WarbandTemplate) -> list[str]:
    return [str(entry.get("key")) for entry in template.variants or [] if entry.get("key")]


def variant_rules(rules: Iterable[TemplateRule], variant: str) -> list[TemplateRule]:
    """The template's rules for a variant, in the book's order: those for every variant and the variant's own."""
    return [rule for rule in rules if rule.variant in ("", variant)]


def variant_changes(fighter: TemplateFighter, variant: str) -> Mapping[str, Any]:
    """What the variant changes on the fighter (`variant_changes[variant]`), only the fields a variant may change."""
    changes = (fighter.variant_changes or {}).get(variant) if variant else None
    return {key: value for key, value in (changes or {}).items() if key in VARIANT_FIELDS}


def apply_variant(fighter: TemplateFighter, variant: str) -> TemplateFighter:
    """The fighter (in memory, never saved) as the variant has him: Middenheim's Champions' skill groups."""
    for field, value in variant_changes(fighter, variant).items():
        setattr(fighter, field, value)
    return fighter
