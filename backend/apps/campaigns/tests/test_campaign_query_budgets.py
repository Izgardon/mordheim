"""Query budgets for the campaign pages at today's counts (CAMP-TEST-01, -03).

Same rule as `apps/core/tests/test_query_budgets.py`: a test fails if an endpoint needs MORE queries than its
budget; when a change makes one cheaper, lower the budget in the same commit. Counts use `force_authenticate`
(production adds one query for the JWT user). The pass 4 targets are in the brief's "Query and request targets".
"""

import re
from datetime import UTC, datetime
from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.battles.models import Battle, BattleParticipant
from apps.campaigns.models import (
    CampaignBulletinEntry,
    CampaignEncampment,
    CampaignHouseRule,
    CampaignLocation,
    CampaignMembership,
    CampaignMessage,
    CampaignRole,
    PivotalMoment,
)
from apps.core.testing import count_get_queries
from apps.warbands.models import Hero, Warband

from .campaign_support import CampaignTestCase, make_user

# name -> (who asks, url suffix, budget)
BUDGETS: dict[str, tuple[str, str, int]] = {
    "detail (owner)": ("owner", "", 3),
    "detail (player)": ("player", "", 4),  # + the player's codes; target ≤ 3 for every role
    "players": ("player", "players/", 7),  # target ≤ 6, and ?fields=basic ≤ 2 (PERF-41)
    "completed trades": ("player", "trade-requests/?status=completed", 2),
    "battle history": ("player", "battle-history/", 3),
    "pivotal moments": ("player", "pivotal-moments/", 2),
    "top killers": ("player", "top-killers/", 2),
    "members": ("admin", "members/", 4),
    "permissions": ("player", "permissions/", 1),  # served from the constants (BUG-15)
    "permissions/me (player)": ("player", "permissions/me/", 2),
    "messages": ("player", "messages/", 2),
    "bulletin": ("player", "bulletin/", 2),
    "encampments": ("player", "encampments/", 3),
    "locations": ("player", "locations/", 3),
    "house rules": ("player", "rules/", 2),
    "active battles": ("owner", "active-battles/", 3),
}
# The overview's four list requests on every mount (players, completed trades, history, pivotal moments)
OVERVIEW = ("players", "completed trades", "battle history", "pivotal moments")
OVERVIEW_BUDGET = 14  # target 0 on a revisit within the stale time (CAMP-TEST-04)
JOIN_BUDGET = 9  # 7 queries + its transaction (BUG-49: checks and insert under the campaign row's lock)


class CampaignQueryBudgetTests(CampaignTestCase):
    """The shared campaign with a little of everything each page lists."""

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        campaign = cls.campaign
        campaign.settings.enable_encampments = campaign.settings.enable_locations = True
        campaign.settings.save()
        for user in (cls.player, cls.rival):
            CampaignMessage.objects.create(campaign=campaign, user=user, username=user.first_name, body="Hi")
            CampaignBulletinEntry.objects.create(campaign=campaign, user=user, username=user.first_name, body="WTB")
            CampaignEncampment.objects.create(campaign=campaign, name=f"Camp {user.first_name}", owner=user)
            CampaignLocation.objects.create(campaign=campaign, name=f"Ruin {user.first_name}")
        CampaignHouseRule.objects.create(campaign=campaign, title="No running")
        Hero.objects.create(warband=cls.warband, name="Abbess", unit_type="Matriarch", kills=3)
        Hero.objects.create(warband=cls.rival_warband, name="Grey Seer", unit_type="Seer", kills=2)
        ended = cls._battle(Battle.STATUS_ENDED)
        PivotalMoment.objects.create(
            campaign=campaign,
            battle=ended,
            warband=cls.warband,
            kind="giant_slayer",
            headline="Giant Slayer",
            battle_ended_at=datetime(2026, 3, 24, tzinfo=UTC),
        )
        cls._battle(Battle.STATUS_ACTIVE)

    @classmethod
    def _battle(cls, status: str) -> Battle:
        battle = Battle.objects.create(
            campaign=cls.campaign, created_by_user=cls.player, scenario="Bridge", status=status
        )
        for user, warband in ((cls.player, cls.warband), (cls.rival, cls.rival_warband)):
            BattleParticipant.objects.create(battle=battle, user=user, warband=warband)
        return battle

    def count(self, user: Any, suffix: str) -> int:
        self.client.force_authenticate(user=user)
        return count_get_queries(self.client, self.url(suffix))

    def measure(self, name: str) -> int:
        who, suffix, _budget = BUDGETS[name]
        return self.count(getattr(self, who), suffix)

    def test_campaign_pages_stay_within_their_budgets(self):
        for name, (_who, _suffix, budget) in BUDGETS.items():
            with self.subTest(endpoint=name):
                queries = self.measure(name)
                self.assertLessEqual(queries, budget, f"{name} ran {queries} queries (budget {budget})")

    def test_the_overview_mount_stays_within_its_budget(self):
        total = sum(self.measure(name) for name in OVERVIEW)
        self.assertLessEqual(total, OVERVIEW_BUDGET, f"the overview's list requests ran {total} queries")

    def test_list_pages_do_not_grow_with_rows(self):
        # CAMP-TEST-01: players with 2 vs 8 warbands; the others with a few more rows each
        names = ("players", "members", "messages", "bulletin", "encampments", "battle history", "active battles")
        before = {name: self.measure(name) for name in names}
        player_role = CampaignRole.objects.get(slug="player")
        for index in range(6):
            user = make_user(f"extra{index}@example.com", f"Extra {index}")
            CampaignMembership.objects.create(campaign=self.campaign, user=user, role=player_role)
            Warband.objects.create(campaign=self.campaign, user=user, name=f"Band {index}", faction="Mercenaries")
            CampaignMessage.objects.create(campaign=self.campaign, user=user, username=user.first_name, body="Hi")
            CampaignBulletinEntry.objects.create(campaign=self.campaign, user=user, username=user.first_name, body="X")
            CampaignEncampment.objects.create(campaign=self.campaign, name=f"Camp {index}", owner=user)
        self._battle(Battle.STATUS_ENDED)
        self._battle(Battle.STATUS_INVITING)
        self.assertEqual(Warband.objects.filter(campaign=self.campaign).count(), 8)

        for name in names:
            with self.subTest(endpoint=name):
                self.assertEqual(self.measure(name), before[name])

    def test_a_join_reads_no_role_or_code_and_costs_the_same_every_time(self):
        # BUG-15 / CAMP-CQ-03: the role and the join grant are subqueries of their INSERTs; no first-call extra
        first, first_sql = self.join_queries("late@example.com")
        second, _sql = self.join_queries("later@example.com")

        self.assertEqual((first, second), (JOIN_BUDGET, JOIN_BUDGET))
        lookups = [
            sql
            for sql in first_sql
            if sql.startswith("SELECT") and re.search(r'FROM "campaign_(role|permission)"', sql)
        ]
        self.assertEqual(lookups, [])

    def join_queries(self, email: str) -> tuple[int, list[str]]:
        newcomer = make_user(email, "Lou")
        with CaptureQueriesContext(connection) as captured:
            self.assertEqual(self.join(newcomer).status_code, 201)
        return len(captured), [query["sql"] for query in captured]

    def test_a_players_feature_write_costs_three_queries_before_any_work(self):
        # CAMP-PERF-06: membership, the feature flag, then the grant; a 400 after them shows the preamble alone
        self.grant(self.player, "manage_encampments")
        self.client.force_authenticate(user=self.player)

        with CaptureQueriesContext(connection) as captured:
            response = self.client.post(self.url("encampments/"), {"name": " "}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(len(captured), 3)

    def test_history_reads_only_the_participant_columns_it_shows(self):
        # PERF-45: the participants prefetch read every JSON column of every participant
        self.client.force_authenticate(user=self.player)
        with CaptureQueriesContext(connection) as captured:
            self.client.get(self.url("battle-history/"))

        participant_sql = next(query["sql"] for query in captured if 'FROM "battle_participant"' in query["sql"])
        self.assertIn('"postbattle_json"', participant_sql)
        unread = (
            "roster_json",
            "unit_information_json",
            "custom_units_json",
            "selected_unit_keys_json",
            "battle_notes",
        )
        self.assertEqual([column for column in unread if f'"{column}"' in participant_sql], [])
