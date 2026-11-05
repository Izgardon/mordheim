"""Making a campaign's own warband template (the templates plan, phase 4, "Making your own"): blank, or as a copy of
any template the campaign can see (the book's, a house version or one of its own), with its own copies of every child
row (versions.copy_entry, as a house version is made), its fighters' keys among them. The copy serves the types it is
made for, never its source's: a Night Watch copied from Mercenaries serves no Reiklanders. Another campaign's
templates are never copied (deferred in the plan)."""

from typing import Any

from django.utils import timezone

from apps.core.catalogue.kinds import WARBAND_TEMPLATES
from apps.core.catalogue.versions import copy_entry

from ..models import WarbandTemplate, WarbandTemplateType


def make_template(
    campaign_id: int, name: str, type_ids: list[int], source: WarbandTemplate | None, user: Any
) -> WarbandTemplate:
    """The new template, serving `type_ids` (none preset a variant: picked when raising)."""
    stamp = {"updated_by_id": user.pk, "updated_at": timezone.now()}
    if source is None:
        template = WarbandTemplate.objects.create(campaign_id=campaign_id, name=name, **stamp)
    else:
        made = copy_entry(
            WARBAND_TEMPLATES,
            source,
            campaign_id,
            version=False,
            skip=("type_links",),
            name=name,
            slug="",
            copied_from_id=source.pk,
            **stamp,
        )
        assert isinstance(made, WarbandTemplate)
        template = made
    WarbandTemplateType.objects.bulk_create(
        WarbandTemplateType(template=template, campaign_id=campaign_id, warband_type_id=type_id) for type_id in type_ids
    )
    return template
