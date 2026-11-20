"""What the pages read about a campaign's preset: which published campaign it plays, what that preset dictates, and
where the campaign departs from it.

The server words all of it (`wording.py`) and decides what counts as a departure; the pages show it and never
re-derive it. A departure is a warning beside a control that is greyed and still operable — never a refusal.
"""

from typing import Any

from apps.campaigns.models import Campaign

from .models import DICTATED, CampaignPreset
from .selectors import chart_names, preset_of
from .wording import departure, sets


def departures(
    campaign: Campaign, preset: CampaignPreset, charts: dict[int, str] | None = None
) -> list[dict[str, Any]]:
    """Every dictated setting whose value the campaign no longer holds: the field, its label and the warning. A
    campaign with no settings row departs from nothing."""
    settings = getattr(campaign, "settings", None)
    if settings is None:
        return []
    lines = []
    for entry in DICTATED:
        value = entry.value(preset)
        if value is None or getattr(settings, entry.settings_field) == value:
            continue
        lines.append(
            {
                "field": entry.settings_field,
                "label": entry.label,
                "message": departure(preset.name, entry, value, charts),
            }
        )
    return lines


def campaign_preset_payload(campaign: Campaign) -> dict[str, Any]:
    """`GET campaigns/<id>/preset/`: the campaign's preset, what it dictates, where the campaign departs from it and
    which of its rules and charts the campaign lacks. Eight queries; none of them grows with the campaign."""
    preset = preset_of(campaign)
    if preset is None:
        return {
            "preset_id": None,
            "preset_name": "",
            "sets": [],
            "departures": [],
            "rules": [],
            "rule_count": 0,
            "charts": [],
            "chart_count": 0,
        }
    charts = chart_names([preset])
    return {
        "preset_id": preset.pk,
        "preset_name": preset.name,
        "sets": sets(preset, charts),
        "departures": departures(campaign, preset, charts),
        # how many rules and charts it holds: what the dialog says a change would bring in
        "rule_count": len(preset.rules.all()),
        "chart_count": sum(1 for chart in preset.charts.all() if chart.rule_id is None and chart.row_id is None),
    }
