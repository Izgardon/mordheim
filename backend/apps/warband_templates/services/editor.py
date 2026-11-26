"""What the template editor reads (the templates plan, phase 4), and what every editor save answers: the whole template
as its detail reads it (with the catalogue's badges), the header's facts and the checks' warnings, in a fixed number
of queries whatever the template holds.

The facts: where it comes from (the book's, the campaign's house version of it, or the campaign's own), what it was
copied from, and how many of the campaign's warbands use it (those of its types for which it comes first: resolve.py).
"""

from typing import Any

from django.db.models import Case, F, OuterRef, Subquery, When

from apps.campaigns.models import CampaignSettings
from apps.core.catalogue.kinds import WARBAND_TEMPLATES
from apps.core.catalogue.payloads import badge_joins
from apps.warbands.models import Warband

from ..models import WarbandTemplate
from ..selectors import template_details
from .checks import template_warnings
from .resolve import in_campaign


def users(template: WarbandTemplate, campaign_id: int) -> int:
    """How many of the campaign's warbands use the template: those naming it (a workshop's, not deleted), and those
    of a type it serves for which it is the first template (one query)."""
    first = in_campaign(campaign_id).filter(type_links__warband_type_id=OuterRef("warband_type_id")).values("pk")
    rows = Warband.objects.filter(campaign_id=campaign_id, deleted_at__isnull=True)
    uses = Case(When(template__isnull=False, then=F("template_id")), default=Subquery(first[:1]))
    return rows.annotate(uses=uses).filter(uses=template.pk).count()


def source(template: WarbandTemplate) -> str:
    if template.campaign_id is None:
        return "book"
    return "house" if template.replaces_id is not None else "custom"


def editor_payload(
    template_id: int, campaign_id: int, settings: CampaignSettings | None, *, workshop: bool = False
) -> dict[str, Any]:
    """The template (its detail's prefetch, one query each), the facts (one query) and the warnings (one query, none
    in a workshop: `workshop`)."""
    rows = WarbandTemplate.objects.select_related(*badge_joins(), "copied_from")
    template = template_details(rows).get(pk=template_id)
    copied = template.copied_from
    facts = {
        "source": source(template),
        "copied_from": {"id": copied.pk, "name": copied.name} if copied is not None else None,
        "warbands": users(template, campaign_id),
    }
    hero_cap = settings.max_heroes if settings is not None else None
    return {
        "template": WARBAND_TEMPLATES.entry_serializer(template).data,
        "facts": facts,
        "warnings": template_warnings(template, campaign_id, hero_cap, workshop=workshop),
    }


def current_template(template: WarbandTemplate, campaign_id: int) -> WarbandTemplate:
    """The campaign's entry for a template it reads in the editor: its house version of a book template, if it has
    one, else the template itself."""
    if template.campaign_id is not None:
        return template
    version = WarbandTemplate.objects.filter(campaign_id=campaign_id, replaces=template).first()
    return version or template
