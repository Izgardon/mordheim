from django.core.exceptions import ObjectDoesNotExist

from apps.restrictions.models import Restriction

PERSONAL_RESTRICTION_EXCLUDED_TYPES = {"Artifact", "Setting"}


def get_valid_personal_restrictions_for_campaign(campaign_id, restriction_ids):
    custom = Restriction.objects.filter(id__in=restriction_ids, campaign_id=campaign_id)
    base = Restriction.objects.filter(id__in=restriction_ids, campaign__isnull=True)
    return (custom | base).exclude(type__in=PERSONAL_RESTRICTION_EXCLUDED_TYPES).order_by("type", "restriction", "id")


def get_valid_campaign_item_settings(restriction_ids):
    return Restriction.objects.filter(
        id__in=restriction_ids,
        campaign__isnull=True,
        type="Setting",
    ).order_by("restriction", "id")


def get_effective_restrictions_for_warband(warband):
    campaign_settings = None
    campaign = getattr(warband, "campaign", None)
    if campaign is not None:
        try:
            campaign_settings = campaign.settings
        except ObjectDoesNotExist:
            campaign_settings = None

    campaign_restrictions = list(campaign_settings.item_settings.all()) if campaign_settings else []
    personal_restrictions = [
        restriction
        for restriction in warband.restrictions.all()
        if restriction.type not in PERSONAL_RESTRICTION_EXCLUDED_TYPES
    ]

    deduped = {}
    for restriction in campaign_restrictions + personal_restrictions:
        deduped[restriction.id] = restriction

    return sorted(
        deduped.values(),
        key=lambda restriction: (restriction.type, restriction.restriction.lower(), restriction.id),
    )
