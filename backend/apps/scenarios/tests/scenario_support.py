"""A campaign made through the API after the book's scenarios were seeded, so it starts with Mordheim 1a's sixteen
(apps/campaigns/tests/campaign_support.py's roles: the owner, an admin, two players and an outsider)."""

from typing import Any

from apps.campaigns.models import CampaignType
from apps.campaigns.tests.campaign_support import CampaignTestCase
from apps.scenarios.models import CampaignScenario, Scenario
from apps.scenarios.testing import seed_book_scenarios_for_tests


class ScenarioTestCase(CampaignTestCase):
    mordheim: CampaignType

    @classmethod
    def setUpTestData(cls) -> None:
        cls.mordheim = seed_book_scenarios_for_tests()
        super().setUpTestData()

    def book(self, slug: str) -> Scenario:
        return Scenario.objects.get(campaign=None, slug=slug)

    def row(self, slug: str) -> CampaignScenario:
        return CampaignScenario.objects.get(campaign=self.campaign, scenario__slug=slug)

    def listed(self) -> dict[str, Any]:
        """The campaign's list as the API answers it: slug -> weight."""
        rows = self.get_as(self.player, self.url("scenarios/")).json()
        return {row["scenario"]["slug"]: row["weight"] for row in rows}
