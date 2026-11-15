"""The book's exploration chart in tests: the real source files, seeded as `seed_exploration_charts` seeds them.

Tests build their own small catalogue rather than running the seeders, so this writes the charts the post-game
needs (and the Mordheim setting they belong to, when the test hasn't seeded the settings). A chart whose setting we
hold no row for is skipped, exactly as the seeder skips it.
"""

from apps.campaigns.models import CampaignType

from .models import ExplorationChart
from .seeding import seed_book_charts
from .selectors import BOOK_SLUG

MORDHEIM = {"name": "Mordheim 1a", "grade": "1a", "always_on": True}


def seed_book_chart() -> ExplorationChart:
    """Seed every source chart whose setting we hold, and answer the book's Mordheim one."""
    CampaignType.objects.get_or_create(slug=BOOK_SLUG, defaults=MORDHEIM)
    seed_book_charts()
    return ExplorationChart.objects.get(campaign__isnull=True, slug=BOOK_SLUG)
