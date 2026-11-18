"""The preset's rules as the campaign's own: copied in order, and never twice.

A rule whose title the campaign already holds is left alone (`POST warbands/<id>/rules/from-template/` does the
same for a warband), so changing preset, or adding its rules again after editing one, copies only what is missing.
"""

from django.db.models import Max

from apps.campaigns.models import Campaign, CampaignRule

from ..models import CampaignPreset, CampaignPresetRule


def _titles_held(campaign_id: int) -> set[str]:
    return {
        title.strip().lower()
        for title in CampaignRule.objects.filter(campaign_id=campaign_id).values_list("title", flat=True)
    }


def missing_rules(campaign_id: int, preset: CampaignPreset | None) -> list[CampaignPresetRule]:
    """The preset's rules the campaign holds none of by title, in the preset's order (two queries)."""
    if preset is None:
        return []
    held = _titles_held(campaign_id)
    return [rule for rule in preset.rules.all() if rule.title.strip().lower() not in held]


def copy_rules(campaign: Campaign, preset: CampaignPreset | None) -> int:
    """Copy the preset's missing rules onto the campaign's, after the rules it has, in the preset's order (one
    INSERT). How many were copied."""
    rules = missing_rules(campaign.pk, preset)
    if not rules:
        return 0
    last = CampaignRule.objects.filter(campaign=campaign).aggregate(last=Max("order"))["last"]
    start = 0 if last is None else last + 1
    CampaignRule.objects.bulk_create(
        CampaignRule(campaign=campaign, title=rule.title, body=rule.text, order=start + place)
        for place, rule in enumerate(rules)
    )
    return len(rules)
