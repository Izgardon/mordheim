"""What a preset dictates, in words: the server words it once and the pages show it (there is no client wording).

A preset-set control is greyed and still operable, so each line is either what the preset sets (`sets`) or the
warning a campaign that departs from it carries (`departure`).
"""

from typing import Any

from .models import DICTATED, CampaignPreset, Dictated


def shown(entry: Dictated, value: Any, chart_names: dict[int, str] | None = None) -> str:
    """A dictated value as the pages show it: "on", "6", "D66", the chart's name."""
    if isinstance(value, bool):
        return "on" if value else "off"
    if entry.field == "exploration_chart_id":
        return (chart_names or {}).get(int(value), "another chart")
    if entry.field == "hero_death_roll":
        return str(value).upper()
    return str(value)


def sets(preset: CampaignPreset, chart_names: dict[int, str] | None = None) -> list[dict[str, Any]]:
    """What the preset dictates, in the pages' order: the campaign settings field, its label and its value in
    words, and the warning for a campaign that departs from it. A field the preset says nothing about is left
    out."""
    lines = []
    for entry in DICTATED:
        value = entry.value(preset)
        if value is None:
            continue
        lines.append(
            {
                "field": entry.settings_field,
                "label": entry.label,
                "value": value,
                "text": shown(entry, value, chart_names),
                # the warning to show beside the control once it is departed from, worded here too
                "departure": departure(preset.name, entry, value, chart_names),
            }
        )
    return lines


def departure(preset_name: str, entry: Dictated, value: Any, chart_names: dict[int, str] | None = None) -> str:
    """The warning a campaign whose own value differs carries: what the preset sets."""
    return f"{preset_name} sets {entry.label}: {shown(entry, value, chart_names)}."
