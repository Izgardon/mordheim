"""Query budgets for the endpoints behind the main screens.

Each budget is the query count measured on the reference campaign (3 of each unit
type, 3 battles). A test fails if an endpoint needs MORE queries than its budget;
when a change makes an endpoint cheaper, lower its budget in the same commit so the
gain is locked in. Endpoints marked "N+1" still grow with data and are fixed in
their feature pass (see docs/review/PERFORMANCE.md).
"""

from django.test import TestCase

from apps.core.testing import ReferenceCampaign, build_reference_campaign, count_get_queries

# endpoint name -> (url template, budget)
QUERY_BUDGETS: dict[str, tuple[str, int]] = {
    # Campaign overview
    "campaign_list": ("/api/campaigns/", 2),
    "campaign_detail": ("/api/campaigns/{campaign}/", 3),
    "campaign_players": ("/api/campaigns/{campaign}/players/", 10),  # N+1: 3 queries per warband (PERF-25)
    "battle_history": ("/api/campaigns/{campaign}/battle-history/", 3),
    "pivotal_moments": ("/api/campaigns/{campaign}/pivotal-moments/", 2),
    "top_killers": ("/api/campaigns/{campaign}/top-killers/", 2),
    "open_battles": ("/api/campaigns/{campaign}/battles/?open=1", 2),
    "battle_list": ("/api/campaigns/{campaign}/battles/", 3),
    "permissions_me": ("/api/campaigns/{campaign}/permissions/me/", 1),
    "notifications": ("/api/notifications/", 1),
    # Warband sheet
    "warband_detail": ("/api/warbands/{warband}/", 3),
    "warband_summary": ("/api/warbands/{warband}/summary/", 10),  # PERF-21/41
    "warband_heroes_detail": ("/api/warbands/{warband}/heroes/detail/", 30),  # N+1 per hero (PERF-22, pass 1)
    "warband_henchmen_detail": (
        "/api/warbands/{warband}/henchmen-groups/detail/",
        15,
    ),  # N+1 per group (PERF-22, pass 1)
    "warband_hired_swords_detail": (
        "/api/warbands/{warband}/hired-swords/detail/",
        15,
    ),  # N+1 per sword (PERF-22, pass 1)
    "warband_items": ("/api/warbands/{warband}/items/", 3),
    "warband_logs": ("/api/warbands/{warband}/logs/", 3),
    "warband_trades": ("/api/warbands/{warband}/trades/", 4),
    "warband_resources": ("/api/warbands/{warband}/resources/", 3),
    # Catalogue
    "items": ("/api/items/?campaign_id={campaign}", 7),
    "skills": ("/api/skills/?campaign_id={campaign}", 4),
    "spells": ("/api/spells/?campaign_id={campaign}", 4),
    "specials": ("/api/special/?campaign_id={campaign}", 4),
    "races": ("/api/races/?campaign_id={campaign}", 4),
    "bestiary": ("/api/bestiary/?campaign_id={campaign}", 4),
    "hired_sword_profiles": ("/api/hired-swords/?campaign_id={campaign}", 4),
    # Battles
    "battle_state": ("/api/campaigns/{campaign}/battles/{battle}/state/", 7),
}


class QueryBudgetTests(TestCase):
    ref: ReferenceCampaign

    @classmethod
    def setUpTestData(cls):
        cls.ref = build_reference_campaign()

    def _url(self, template: str) -> str:
        return template.format(
            campaign=self.ref.campaign_id, warband=self.ref.warband.id, battle=self.ref.ended_battle.id
        )

    def test_endpoints_stay_within_query_budget(self):
        client = self.ref.owner_client
        client.force_authenticate(user=self.ref.owner)
        for name, (template, budget) in QUERY_BUDGETS.items():
            with self.subTest(endpoint=name):
                queries = count_get_queries(client, self._url(template))
                self.assertLessEqual(
                    queries,
                    budget,
                    f"{name} ran {queries} queries (budget {budget}). Fix the regression, or if the "
                    "extra queries are intended, raise the budget with a reason in the commit.",
                )
