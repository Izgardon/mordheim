"""The random scenario (William, 24 Nov 2026): a weighted draw among the campaign's list.

Every row with a weight above 0 may be drawn, whoever plays (William, 25 Nov 2026: "just dont disregard
multiplayer"; the players icon is there to be seen, not to filter). A row's weight is its chance against the others'
(Mordheim's from their 2D6 tables, so the draw rolls the table); weight 0 keeps a scenario listed and pickable but never
drawn. The server draws; the page shows what it drew.
"""

import random
from decimal import Decimal

from ..models import CampaignScenario
from .campaign_list import campaign_rows


def draw(campaign_id: int, rng: random.Random | None = None) -> CampaignScenario | None:
    """A row of the campaign's list drawn by weight, or None when none weighs above 0 (one query)."""
    rows = [row for row in campaign_rows(campaign_id) if row.weight > 0]
    if not rows:
        return None
    total = sum((row.weight for row in rows), Decimal(0))
    point = Decimal(str((rng or random.SystemRandom()).random())) * total
    for row in rows:
        point -= row.weight
        if point < 0:
            return row
    return rows[-1]
