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
    CampaignChart,
    CampaignChartRow,
    CampaignEncampment,
    CampaignEncampmentGroup,
    CampaignHouseRule,
    CampaignLocation,
    CampaignLocationGroup,
    CampaignMembership,
    CampaignMessage,
    CampaignRole,
    CampaignRule,
    PivotalMoment,
)
from apps.core.testing import count_get_queries
from apps.warbands.models import Hero, Warband

from .campaign_support import CampaignTestCase, make_user

# name -> (who asks, url suffix, budget)
BUDGETS: dict[str, tuple[str, str, int]] = {
    "detail (owner)": ("owner", "", 3),
    "detail (player)": ("player", "", 3),  # the codes come with the membership (CampaignScopedView, design 0.29)
    "players": ("player", "players/", 6),  # the member check reads the list it returns (PERF-41)
    "completed trades": ("player", "trade-requests/?status=completed", 2),
    "battle history": ("player", "battle-history/", 4),  # + each battle's pivotal moments and its kill counts (step 9)
    "chronicle": ("player", "chronicle/", 4),  # deaths, the log, the bounties (steps 5, 9; no kills)
    "search": ("player", "search/?q=se", 5),  # the membership, then warbands, heroes, groups, hired swords (7a)
    "top killers": ("player", "top-killers/", 2),
    "members": ("admin", "members/", 4),
    "permissions": ("player", "permissions/", 1),  # served from the constants (BUG-15)
    "messages": ("player", "messages/", 2),
    # the warbands he may take one for, the groups, their encampments with their holders, and the encampment rules
    # with their own tables and those's results (the feature flag comes with the membership)
    "encampments": ("player", "encampment-groups/", 7),
    # the groups, their locations, those's own tables, the tables' results and their tables, and the links
    "location groups": ("player", "location-groups/", 8),
    "house rules": ("player", "rules/", 2),
    # the rules, their own tables and those tables' results: three, whatever the campaign holds
    "campaign rules": ("player", "campaign-rules/", 3),
    "active battles": ("owner", "active-battles/", 3),
}
# The overview's list requests on every mount (players, completed trades, the history with its moments)
OVERVIEW = ("players", "completed trades", "battle history")
OVERVIEW_BUDGET = 12  # target 0 on a revisit within the stale time (CAMP-TEST-04)
JOIN_BUDGET = 9  # 7 queries + its transaction (BUG-49: checks and insert under the campaign row's lock)


class CampaignQueryBudgetTests(CampaignTestCase):
    """The shared campaign with a little of everything each page lists."""

    camps: CampaignEncampmentGroup

    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        campaign = cls.campaign
        campaign.settings.enable_encampments = campaign.settings.enable_locations = True
        campaign.settings.save()
        group = CampaignLocationGroup.objects.create(campaign=campaign, name="Old Town")
        cls.camps = CampaignEncampmentGroup.objects.create(campaign=campaign, name="The wall")
        rule = CampaignRule.objects.create(campaign=campaign, kind="encampment", title="Holding")
        table = CampaignChart.objects.create(campaign=campaign, rule=rule, title="Holding", dice="D6")
        CampaignChartRow.objects.create(chart=table, result="1", text="Lost.")
        for user, band in ((cls.player, cls.warband), (cls.rival, cls.rival_warband)):
            CampaignMessage.objects.create(campaign=campaign, user=user, username=user.first_name, body="Hi")
            CampaignEncampment.objects.create(
                campaign=campaign, group=cls.camps, name=f"Camp {user.first_name}", holder=band
            )
            CampaignLocation.objects.create(campaign=campaign, group=group, name=f"Ruin {user.first_name}")
        CampaignHouseRule.objects.create(campaign=campaign, title="No running")
        CampaignRule.objects.create(campaign=campaign, title="Curfew")
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
        names = ("players", "members", "messages", "encampments", "battle history", "active battles")
        before = {name: self.measure(name) for name in names}
        player_role = CampaignRole.objects.get(slug="player")
        for index in range(6):
            user = make_user(f"extra{index}@example.com", f"Extra {index}")
            CampaignMembership.objects.create(campaign=self.campaign, user=user, role=player_role)
            band = Warband.objects.create(campaign=self.campaign, user=user, name=f"Band {index}")
            CampaignMessage.objects.create(campaign=self.campaign, user=user, username=user.first_name, body="Hi")
            CampaignEncampment.objects.create(
                campaign=self.campaign, group=self.camps, name=f"Camp {index}", holder=band
            )
            camps = CampaignEncampmentGroup.objects.create(campaign=self.campaign, name=f"Ward {index}")
            CampaignEncampment.objects.create(campaign=self.campaign, group=camps, name=f"Tower {index}")
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

    def test_a_players_feature_write_costs_one_query_before_any_work(self):
        # CAMP-PERF-06: membership, feature flag and grant are one read (CampaignScopedView; it was 3 queries); a 400
        # after it shows the preamble alone
        self.grant(self.player, "manage_encampments")
        self.client.force_authenticate(user=self.player)

        with CaptureQueriesContext(connection) as captured:
            response = self.client.post(self.url("encampments/"), {"name": " "}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(len(captured), 1)

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
