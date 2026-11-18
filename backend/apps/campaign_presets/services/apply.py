"""Applying a preset: the structural settings it dictates, and the settings it guides the content choice towards.

Both are written by the campaign's own services (`campaigns/services/campaigns.py` at creation, `settings.py` for
the PATCH), so a preset never gets a write path of its own: it hands them the values and the ids to tick.

The guide is only ever added to: the settings the preset names are ticked on top of whatever the campaign has, and
the owner unticks them again if he wants ("content is different to rules").
"""

from typing import Any

from apps.campaigns.models import CampaignCampaignType

from ..models import DICTATED, CampaignPreset


def settings_values(preset: CampaignPreset | None) -> dict[str, Any]:
    """What the preset dictates, as `CampaignSettings` fields; {} for no preset, and a field it says nothing about
    is left out, so the campaign keeps its own value."""
    if preset is None:
        return {}
    stated = ((entry.settings_field, entry.value(preset)) for entry in DICTATED)
    return {field: value for field, value in stated if value is not None}


def ticked_with(campaign_id: int, preset: CampaignPreset | None, picked: list[int] | None) -> list[int] | None:
    """The settings in play once the preset's guide is applied: what the request leaves ticked (`picked`, else the
    campaign's own) with the preset's added. None when nothing is to change."""
    if preset is None:
        return picked
    held = (
        picked
        if picked is not None
        else list(
            CampaignCampaignType.objects.filter(campaign_id=campaign_id).values_list("campaign_type_id", flat=True)
        )
    )
    return sorted({*held, *preset.settings.values_list("id", flat=True)})
