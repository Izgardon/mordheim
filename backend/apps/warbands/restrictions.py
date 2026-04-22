from django.core.exceptions import ObjectDoesNotExist

from apps.restrictions.models import Restriction


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
    return sorted(
        campaign_restrictions,
        key=lambda restriction: (restriction.type, restriction.restriction.lower(), restriction.id),
    )
