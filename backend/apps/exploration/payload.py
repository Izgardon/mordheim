"""The one wording of a chart the API sends: the campaign's exploration endpoint and the post-game rules share it."""

from typing import Any

from .chart import Chart, Place


def place_payload(place: Place, *, rules: bool = True) -> dict[str, Any]:
    body: dict[str, Any] = {"id": place.id, "face": place.face, "name": place.name}
    if rules:
        body["rules"] = place.rules
    return body


def multiples_payload(chart: Chart, *, rules: bool = True) -> list[dict[str, Any]]:
    """Each multiple the chart names places for: its count, its label and its places by face."""
    return [
        {"count": count, "label": places[0].label, "places": [place_payload(place, rules=rules) for place in places]}
        for count, places in chart.multiples()
    ]


def income_payload(chart: Chart) -> list[dict[str, int | None]]:
    """The income table as the post-game shows it: the shards for a total up to `max_total` (None: any higher)."""
    return [{"max_total": band.max_total, "amount": band.amount} for band in chart.income]


def chart_payload(chart: Chart, *, in_play: bool | None = None, setting_id: int | None = None) -> dict[str, Any]:
    """The whole chart: its income table, its dice rule and its places with their rules text."""
    return {
        "id": chart.id,
        "name": chart.name,
        "summary": chart.summary,
        "setting_id": setting_id,
        "in_play": in_play,
        "dice": {
            "per_hero": chart.dice_per_hero,
            "for_win": chart.dice_for_win,
            "max": chart.max_dice,
            "max_chosen": chart.max_chosen,
        },
        "income": income_payload(chart),
        "income_note": chart.income_note,
        "multiples": multiples_payload(chart),
    }
