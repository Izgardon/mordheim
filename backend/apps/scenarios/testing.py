"""The book's scenarios in tests: the import's real `out/scenarios.json`, seeded as `seed_scenarios` seeds it, with
Mordheim 1a (always on) made first when the test hasn't seeded the settings, so its nine are given to every campaign
created after with no preset (apps/campaign_presets/services/preset_lists.py)."""

from apps.campaigns.models import CampaignType

from .seeding import seed_book_scenarios

MORDHEIM = {"slug": "mordheim", "name": "Mordheim 1a", "grade": "1a", "always_on": True}


def seed_book_scenarios_for_tests() -> CampaignType:
    """Mordheim 1a, with the book's scenarios seeded and its nine linked to it."""
    setting, _ = CampaignType.objects.get_or_create(slug=MORDHEIM["slug"], defaults=MORDHEIM)
    seed_book_scenarios()
    return setting
