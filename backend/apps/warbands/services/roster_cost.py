"""What a warband's roster is worth, read live (the workshop plan, docs/plans/workshop.md): what a custom warband
"costs" against its budget, and what an imported one pays in one ledger row.

The cost is each hero's and hired sword's `price`, each henchmen group's `price` for each member still in it, and what
every copy the warband owns was paid: a unit's own copies, a group's loadout rows once for each member who carries
them (its living members less their gaps: henchmen loadouts) and the stash's rows by quantity. Dead and dismissed units
and members cost nothing: they have left the roster. A copy whose cost isn't known counts 0. One query, whatever the
roster's size or the number of warbands.

The budget is the gold the warband is raised with in its campaign: the campaign's starting gold plus its template's
difference from 500 in its variant (`payload.raise_gold`), so a Marienburg variant's 600 follows a variant changed in
Settings.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from django.db.models import F, IntegerField, OuterRef, QuerySet, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from apps.warband_templates.services.payload import raise_gold
from apps.warband_templates.services.resolve import templates_for_warbands, warband_variant
from apps.warbands.models import (
    Henchman,
    HenchmanItemGap,
    Hero,
    HeroItem,
    Hireling,
    HirelingItem,
    Warband,
    WarbandItem,
)

DEFAULT_GOLD = 500  # a campaign without its settings row


def _total(rows: QuerySet[Any], by: str, amount: Any) -> Coalesce:
    """The sum of `amount` over `rows` belonging to the outer warband (`by` is their path to its id), 0 for none."""
    summed = rows.filter(**{by: OuterRef("pk")}).order_by().values(by).annotate(total=Sum(amount)).values("total")
    return Coalesce(Subquery(summed[:1], output_field=IntegerField()), Value(0))


def _alive(prefix: str = "") -> dict[str, Any]:
    return {f"{prefix}dead": False, f"{prefix}dismissed_at__isnull": True}


def _members() -> QuerySet[Henchman]:
    """The members still in a group still on the roster."""
    return Henchman.objects.filter(**_alive(), **_alive("group__"))


def _parts() -> dict[str, Coalesce]:
    return {
        "heroes_gc": _total(Hero.objects.filter(**_alive()), "warband_id", F("price")),
        "hirelings_gc": _total(Hireling.objects.filter(**_alive()), "warband_id", F("price")),
        "members_gc": _total(_members(), "group__warband_id", F("group__price")),
        "hero_kit_gc": _total(HeroItem.objects.filter(**_alive("hero__")), "hero__warband_id", F("cost")),
        "hireling_kit_gc": _total(
            HirelingItem.objects.filter(**_alive("hireling__")), "hireling__warband_id", F("cost")
        ),
        # each member carries each of his group's rows ...
        "group_kit_gc": _total(_members(), "group__warband_id", F("group__henchmen_group_items__cost")),
        # ... but the ones he has a gap on
        "gaps_gc": _total(
            HenchmanItemGap.objects.filter(**_alive("henchman__"), **_alive("henchman__group__")),
            "henchman__group__warband_id",
            F("group_item__cost"),
        ),
        "stash_gc": _total(WarbandItem.objects.all(), "warband_id", F("cost") * F("quantity")),
    }


def roster_costs(warband_ids: Iterable[int]) -> dict[int, int]:
    """Each warband's roster cost in gold (one query, whatever their number and size)."""
    parts = _parts()
    rows = Warband.objects.filter(pk__in=list(warband_ids)).annotate(**parts).values("pk", *parts)
    return {
        row["pk"]: sum(int(row[name] or 0) for name in parts if name != "gaps_gc") - int(row["gaps_gc"] or 0)
        for row in rows
    }


def roster_cost(warband: Warband) -> int:
    """The warband's roster cost in gold (one query)."""
    return roster_costs([warband.pk]).get(warband.pk, 0)


def roster_budgets(warbands: Iterable[Warband]) -> dict[int, int]:
    """The gold each warband is raised with in its campaign, as its template and variant now read (three queries;
    each warband read with its campaign's settings)."""
    rows = list(warbands)
    templates = templates_for_warbands(rows)
    budgets = {}
    for warband in rows:
        settings = getattr(warband.campaign, "settings", None)
        campaign_gold = abs(settings.starting_gold) if settings is not None else DEFAULT_GOLD
        template = templates[warband.pk]
        variant = warband_variant(warband, template) if template is not None else ""
        budgets[warband.pk] = raise_gold(campaign_gold, template, variant)
    return budgets


@dataclass(frozen=True)
class RosterValue:
    cost: int
    budget: int

    @property
    def over(self) -> bool:
        return self.cost > self.budget


def roster_values(warbands: Iterable[Warband]) -> dict[int, RosterValue]:
    """Each warband's cost and budget (four queries)."""
    rows = list(warbands)
    costs, budgets = roster_costs(warband.pk for warband in rows), roster_budgets(rows)
    return {warband.pk: RosterValue(cost=costs.get(warband.pk, 0), budget=budgets[warband.pk]) for warband in rows}


def roster_value(warband: Warband) -> RosterValue:
    """The warband's cost and budget (four queries)."""
    return roster_values([warband])[warband.pk]
