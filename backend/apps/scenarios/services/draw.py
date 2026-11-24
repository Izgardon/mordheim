"""The random scenario (William, 24 Nov 2026): a weighted draw among the campaign's list.

Only scenarios that fit the battle are drawn: a 1v1 scenario for two warbands, a multiplayer one for three or more.
A row's weight is its chance against the others' (Mordheim's from their 2D6 tables, so the draw rolls the table);
weight 0 keeps a scenario listed and pickable but never drawn. The server draws; the page shows what it drew.
"""

import random
from decimal import Decimal

from ..models import MULTIPLAYER, ONE_V_ONE, CampaignScenario
from .campaign_list import campaign_rows


def players_for(warbands: int) -> str:
    return ONE_V_ONE if warbands <= 2 else MULTIPLAYER


def draw(campaign_id: int, warbands: int, rng: random.Random | None = None) -> CampaignScenario | None:
    """A row of the campaign's list drawn by weight among those that fit `warbands`, or None when none does (one
    query)."""
    rows = [row for row in campaign_rows(campaign_id).filter(scenario__players=players_for(warbands)) if row.weight > 0]
    if not rows:
        return None
    total = sum((row.weight for row in rows), Decimal(0))
    point = Decimal(str((rng or random.SystemRandom()).random())) * total
    for row in rows:
        point -= row.weight
        if point < 0:
            return row
    return rows[-1]
