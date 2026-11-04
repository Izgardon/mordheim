"""Which template a warband uses (the templates plan, phase 2), found from its type and read with its variant applied.

The campaign's own template for the type comes first: one made in the campaign, or its house version of the book's.
Otherwise the book's template for the type, unless the campaign replaced or removed it. Otherwise none, and recruiting
is typed by hand as before. Archived templates serve nobody. The types a warband counts as never pick one. The
variant is the warband's (`template_variant`): its type's preset, else picked when raising, changeable in Settings.
A variant reads its own rules and list lines besides every variant's, and its changes to each fighter.
"""

from collections.abc import Iterable, Mapping
from typing import Any

from django.db.models import Exists, F, OuterRef, Q, QuerySet, Subquery

from apps.core.models import CatalogueRemoval
from apps.warbands.models import Warband
from apps.warbands.models.shared import STAT_FIELDS
from apps.warbands.utils.stats import read_stat

from ..models import TemplateFighter, TemplateListItem, TemplateRule, WarbandTemplate, WarbandTemplateType

KIND = "warband_templates"  # the catalogue kind's key (apps/core/catalogue/kinds.py)
# what a variant may change on a fighter (`variant_changes`): his skill groups, spell lores, profile or group size,
# and the skills he has from the start (`skills`: the Hung's heroes' Ride [Animal])
VARIANT_FIELDS = frozenset(
    {"skill_types", "spell_types", "cost", "starting_xp", "max_count", "group_min", "group_max", "stats", "skills"}
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


def _variant_entry(template: WarbandTemplate, variant: str) -> Mapping[str, Any]:
    return next((entry for entry in template.variants or [] if variant and entry.get("key") == variant), {})


def template_gold(template: WarbandTemplate, variant: str) -> int:
    """The starting gold the template gives in a variant: the variant's own (Marienburg's 600), else the book's."""
    gold = _variant_entry(template, variant).get("starting_gold")
    return int(gold) if gold is not None else template.gold


def template_size(template: WarbandTemplate, variant: str) -> int:
    """The most warriors in a variant: the variant's own (the Hung's 12), else the book's."""
    size = _variant_entry(template, variant).get("max_models")
    return int(size) if size is not None else template.most_warriors


def variant_rules(rules: Iterable[TemplateRule], variant: str, warband_type_id: int | None) -> list[TemplateRule]:
    """The template's rules for a warband of the type in a variant, in the book's order: those for every variant
    and the variant's own, for every type the template serves and the type's own (the Ostermarkers')."""
    return [rule for rule in rules if rule.variant in ("", variant) and rule.warband_type_id in (None, warband_type_id)]


def variant_changes(fighter: TemplateFighter, variant: str) -> Mapping[str, Any]:
    """What the variant changes on the fighter (`variant_changes[variant]`), only the fields a variant may change."""
    changes = (fighter.variant_changes or {}).get(variant) if variant else None
    return {key: value for key, value in (changes or {}).items() if key in VARIANT_FIELDS}


def variant_lines(lines: Iterable[TemplateListItem], variant: str) -> list[TemplateListItem]:
    """A list's lines for the variant: those for every variant and the variant's own (the Kurgan's bows)."""
    return [line for line in lines if line.variant in ("", variant)]


def start_skills(fighter: TemplateFighter) -> list[dict[str, Any]]:
    """The skills the variant gives him from the start, `[{"id", "name"}]` (set by `apply_variant`)."""
    found: list[dict[str, Any]] = getattr(fighter, "start_skills", None) or []
    return found


def apply_variant(fighter: TemplateFighter, variant: str) -> TemplateFighter:
    """The fighter (in memory, never saved) as the variant has him: Middenheim's Champions' skill groups and
    Strength 4, the Hung's heroes' Ride [Animal] (`start_skills`). A changed stat is read as written ("1(2)"), so its
    written value follows it."""
    for field, value in variant_changes(fighter, variant).items():
        if field == "skills":
            fighter.start_skills = [dict(entry) for entry in value or []]  # type: ignore[attr-defined]
        elif field == "stats":
            written = dict(fighter.written_stats or {})
            for stat, shown in dict(value).items():
                if stat not in STAT_FIELDS:
                    continue
                read = read_stat(shown)
                setattr(fighter, stat, read.number)
                written.pop(stat, None)
                if read.written:
                    written[stat] = read.written
            fighter.written_stats = written
        else:
            setattr(fighter, field, value)
    return fighter
