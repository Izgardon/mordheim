"""A campaign's scenarios and plots, built by its preset alone (William, 26 Nov 2026: "Why are the settings doing
anything here related to scenarios and plots? They should both be built and affected by purely the preset. The
settings are just there for content.").

A preset gives the `SettingScenario` rows of the settings it names, at their weights (a scenario two of them add takes
the higher); no preset, or one whose settings add none (Mordheim's names none), gives Mordheim 1a's, the rulebook's
nine. Its plots are the book plots of those settings as the campaign's catalogue shows them (its version in place of
the book's, one it removed left out), given only while campaign points are on; no preset gives none. Ticking or
unticking a setting touches neither list.

Creation builds both (`build_lists`); switching campaign points on gives the preset's plots to a campaign holding
none (`give_plots`); a new preset swaps them (`swap_lists`): the old one's leave unless a battle names the scenario
or a warband follows the plot, the new one's arrive (one already listed kept as it is), and what neither gave (added
by hand) stays. Every step is a fixed number of queries, whatever the lists hold.
"""

from collections.abc import Iterable
from decimal import Decimal

from django.db.models import Model, Q, QuerySet

from apps.battles.models import Battle
from apps.campaigns.models import CampaignSettings
from apps.core.catalogue import merge
from apps.core.catalogue.cache import bump
from apps.plots.models import CampaignPlot, Plot
from apps.scenarios.models import CampaignScenario, Scenario, SettingScenario
from apps.scenarios.services.campaign_list import KIND as SCENARIOS
from apps.warbands.models import Warband

RULEBOOK = "mordheim"  # Mordheim 1a's slug: the rulebook's nine, the scenarios when the preset gives none
PLOTS = "plots"  # the `catalogue.changed` kind of the campaign's plots

Known = dict[int, frozenset[int]]  # an entry the preset gives -> the ids the campaign knows it by


def _highest(links: QuerySet[SettingScenario]) -> dict[int, Decimal]:
    weights: dict[int, Decimal] = {}
    for scenario_id, weight in links.values_list("scenario_id", "weight"):
        weights[scenario_id] = max(weight, weights.get(scenario_id, weight))
    return weights


def scenario_weights(preset_id: int | None) -> dict[int, Decimal]:
    """The book scenarios the preset gives, at their weights: its settings', else Mordheim 1a's (one or two queries)."""
    weights = _highest(SettingScenario.objects.filter(setting__campaign_presets=preset_id)) if preset_id else {}
    return weights or _highest(SettingScenario.objects.filter(setting__slug=RULEBOOK))


def _scenario_ids(campaign_id: int, book_ids: Iterable[int]) -> Known:
    """Each book scenario -> itself and the campaign's version of it, which its list rows follow (one query)."""
    known = {pk: {pk} for pk in book_ids}
    versions = Scenario.objects.filter(campaign_id=campaign_id, replaces_id__in=list(known))
    for pk, replaces in versions.values_list("id", "replaces_id"):
        known[replaces].add(pk)
    return {pk: frozenset(ids) for pk, ids in known.items()}


def plot_ids(campaign_id: int, preset_id: int | None) -> Known:
    """The book plots of the preset's settings as the campaign's catalogue shows them, each -> the ids the campaign
    knows it by (the version and the book plot it replaces); none for no preset (one query)."""
    if preset_id is None:
        return {}
    from apps.core.catalogue.kinds import PLOTS as PLOT_KIND  # the registry imports this app's services

    book = Q(campaign__isnull=True) | Q(replaces__isnull=False)  # never one of the campaign's own
    rows = merge.campaign_list(PLOT_KIND, Plot.objects.all(), campaign_id).filter(
        book, campaign_type__campaign_presets=preset_id
    )
    found = rows.order_by("name", "id").values_list("id", "replaces_id")
    return {pk: frozenset({pk} if replaces is None else {pk, replaces}) for pk, replaces in found}


def _held(model: type[Model], field: str, campaign_id: int) -> set[int]:
    return set(model._default_manager.filter(campaign_id=campaign_id).values_list(field, flat=True))


def _current(book_id: int, ids: frozenset[int]) -> int:
    """The campaign's version of the book entry, else the entry itself."""
    return next(iter(ids - {book_id}), book_id)


def _add_scenarios(campaign_id: int, weights: dict[int, Decimal], known: Known) -> bool:
    """The scenarios not yet listed join at their weights, each as the campaign's current entry (two queries)."""
    held = _held(CampaignScenario, "scenario_id", campaign_id)
    rows = [
        CampaignScenario(campaign_id=campaign_id, scenario_id=_current(pk, known[pk]), weight=weight)
        for pk, weight in weights.items()
        if not known[pk] & held
    ]
    CampaignScenario.objects.bulk_create(rows)
    return bool(rows)


def _add_plots(campaign_id: int, known: Known) -> bool:
    """The plots not yet held join the campaign's list (two queries)."""
    held = _held(CampaignPlot, "plot_id", campaign_id)
    rows = [CampaignPlot(campaign_id=campaign_id, plot_id=pk) for pk, ids in known.items() if not ids & held]
    CampaignPlot.objects.bulk_create(rows)
    return bool(rows)


def _drop(rows: QuerySet, field: str, leaving: Iterable[frozenset[int]], holders: QuerySet, held_by: str) -> bool:
    """`rows` (the campaign's list, by `field`) lose each leaving entry none of `holders` (the campaign's battles or
    warbands) names by any of its ids in `held_by` (two queries)."""
    groups = list(leaving)
    if not groups:
        return False
    ids = frozenset().union(*groups)
    kept = set(holders.filter(**{f"{held_by}__in": ids}).values_list(held_by, flat=True))
    gone = {pk for group in groups if not group & kept for pk in group}
    deleted, _ = rows.filter(**{f"{field}__in": gone}).delete()
    return bool(deleted)


def build_lists(campaign_id: int, preset_id: int | None, *, plots: bool) -> None:
    """A new campaign's scenarios, and its plots when campaign points are on from the start."""
    weights = scenario_weights(preset_id)
    if _add_scenarios(campaign_id, weights, {pk: frozenset({pk}) for pk in weights}):  # nothing has a version yet
        bump(campaign_id, SCENARIOS)
    if plots:
        give_plots(campaign_id, preset_id)


def give_plots(campaign_id: int, preset_id: int | None) -> None:
    """Campaign points switched on: the preset's plots, unless the campaign already holds a list of its own (one that
    unticked them all holds none, never falling back to this)."""
    if CampaignPlot.objects.filter(campaign_id=campaign_id).exists():
        return
    if _add_plots(campaign_id, plot_ids(campaign_id, preset_id)):
        bump(campaign_id, PLOTS)


def swap_lists(campaign_id: int, old_id: int | None, new_id: int | None) -> None:
    """The preset changed from `old_id` to `new_id`: the old one's scenarios and plots leave unless a battle names
    the scenario or a warband follows the plot, the new one's arrive (plots while campaign points are on), and what
    neither gave stays."""
    if old_id == new_id:
        return
    old, new = scenario_weights(old_id), scenario_weights(new_id)
    known = _scenario_ids(campaign_id, {*old, *new})
    battles = Battle.objects.filter(campaign_id=campaign_id)  # a reported result is a battle too
    leaving = (known[pk] for pk in old if pk not in new)
    rows = CampaignScenario.objects.filter(campaign_id=campaign_id)
    dropped = _drop(rows, "scenario_id", leaving, battles, "scenario_ref_id")
    if _add_scenarios(campaign_id, new, known) or dropped:
        bump(campaign_id, SCENARIOS)
    old_plots, new_plots = plot_ids(campaign_id, old_id), plot_ids(campaign_id, new_id)
    warbands = Warband.objects.filter(campaign_id=campaign_id)
    leaving = (ids for pk, ids in old_plots.items() if pk not in new_plots)
    dropped = _drop(CampaignPlot.objects.filter(campaign_id=campaign_id), "plot_id", leaving, warbands, "plot_id")
    points = CampaignSettings.objects.filter(campaign_id=campaign_id, enable_campaign_points=True).exists()
    if (points and _add_plots(campaign_id, new_plots)) or dropped:
        bump(campaign_id, PLOTS)
