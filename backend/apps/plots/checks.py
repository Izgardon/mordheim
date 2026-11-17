"""What a plot is missing, as warnings (as apps/warband_templates/services/checks.py warns): never a refusal.

A write answers with these in `warnings`; only broken data is refused (the serializer's). A ladder without a
40-point rung can never be won, a plot with no scoring line earns nothing, and a blank `who_text` leaves the player
to decide on his own — each worth saying once, and none worth blocking.
"""

from collections.abc import Iterable

from .models import WINNING_POINTS, Plot


def plot_warnings(plot: Plot, scoring: Iterable[object], achievements: Iterable[int]) -> list[str]:
    """`scoring`: the plot's scoring lines; `achievements`: the points of its rungs."""
    warnings = []
    if not list(scoring):
        warnings.append("This plot has no scoring lines, so it earns no campaign points.")
    if WINNING_POINTS not in set(achievements):
        warnings.append(f"The ladder has no rung at {WINNING_POINTS} campaign points, which is the campaign win.")
    if not plot.who_text.strip():
        warnings.append("Nothing says who may follow this plot.")
    return warnings


def warnings_for(plot: Plot) -> list[str]:
    """The warnings for a plot as it stands now (two queries)."""
    return plot_warnings(
        plot,
        list(plot.scoring_lines.values_list("id", flat=True)),
        list(plot.achievements.values_list("points", flat=True)),
    )
