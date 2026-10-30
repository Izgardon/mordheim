"""Search everything's campaign half (next step 7a): the warbands and units of a campaign whose names match.

The reference half (items, skills, spells, beasts, hired swords, the rulebook's text, house rules, locations) is
searched on the frontend from the lists its pages already load; no page loads every warband's units at once, so they
come from here. Four queries whatever the campaign's size, none for a search shorter than two letters:

- warbands, by name or faction;
- heroes and hired swords on a roster (alive, not dismissed), by name or type;
- henchmen groups on a roster, by name, type or one of their members' names.
"""

from typing import Any

from django.db.models import Q

from apps.warbands.models import HenchmenGroup, Hero, Hireling, Warband, on_roster

MIN_LENGTH = 2
LIMIT = 20


def _units(kind: str, rows: Any) -> list[dict[str, Any]]:
    return [
        {
            "kind": kind,
            "id": row["id"],
            "name": row["name"],
            "unit_type": row["unit_type"],
            "warband_id": row["warband_id"],
            "warband_name": row["warband__name"],
        }
        for row in rows.order_by("name", "id").values("id", "name", "unit_type", "warband_id", "warband__name")[
            :LIMIT
        ]
    ]


def campaign_search(campaign_id: int, query: str | None) -> dict[str, list[dict[str, Any]]]:
    """`{warbands, units}`: up to 20 of each kind of match, by name; empty for a search under two letters."""
    text = (query or "").strip()
    if len(text) < MIN_LENGTH:
        return {"warbands": [], "units": []}
    named = Q(name__icontains=text) | Q(unit_type__icontains=text)
    warbands = (
        Warband.objects.filter(campaign_id=campaign_id)
        .filter(Q(name__icontains=text) | Q(faction__icontains=text))
        .order_by("name", "id")
        .values("id", "name", "faction", "user_id")[:LIMIT]
    )
    heroes = on_roster(Hero.objects.filter(warband__campaign_id=campaign_id)).filter(named)
    hirelings = on_roster(Hireling.objects.filter(warband__campaign_id=campaign_id)).filter(named)
    member_named = Q(henchmen__name__icontains=text, henchmen__dismissed_at__isnull=True, henchmen__dead=False)
    groups = (
        on_roster(HenchmenGroup.objects.filter(warband__campaign_id=campaign_id))
        .filter(named | member_named)
        .distinct()
    )
    return {
        "warbands": list(warbands),
        "units": [*_units("hero", heroes), *_units("henchmen_group", groups), *_units("hireling", hirelings)],
    }
