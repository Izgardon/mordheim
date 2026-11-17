"""The book's plots in tests: the real source files, seeded as `seed_plots` seeds them.

Tests build their own small catalogue rather than running the seeders, so this writes the plots a test needs (and
the Mordheim settings they belong to, when the test hasn't seeded the settings). A plot whose setting we hold no row
for is skipped, exactly as the seeder skips it.
"""

from apps.campaigns.models import CampaignType

from .models import Plot
from .seeding import seed_book_plots

MUTINY = {"slug": "mutiny-in-marienburg", "name": "Mutiny in Marienburg", "grade": "2b"}


def seed_book_plots_for_tests() -> list[Plot]:
    """Seed every source plot whose setting we hold (Mutiny in Marienburg's among them), and answer them."""
    CampaignType.objects.get_or_create(slug=MUTINY["slug"], defaults=MUTINY)
    seed_book_plots()
    return list(Plot.objects.filter(campaign__isnull=True))
