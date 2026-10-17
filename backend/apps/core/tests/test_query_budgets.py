"""Query budgets for the endpoints behind the main screens.

Each budget is the query count measured on the reference campaign (3 of each unit
type, 3 battles). A test fails if an endpoint needs MORE queries than its budget;
when a change makes an endpoint cheaper, lower its budget in the same commit so the
gain is locked in. Endpoints marked "N+1" still grow with data and are fixed in
their feature pass (see docs/review/PERFORMANCE.md).
"""

from typing import Any

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext

from apps.core.testing import (
    ReferenceCampaign,
    add_items_to_units,
    add_units_with_items,
    build_reference_campaign,
    count_get_queries,
)
from apps.warbands.models import HenchmenGroup, Hero, HiredSword

# endpoint name -> (url template, budget)
QUERY_BUDGETS: dict[str, tuple[str, int]] = {
    # Campaign overview
    "campaign_list": ("/api/campaigns/", 2),
    "campaign_detail": ("/api/campaigns/{campaign}/", 3),
    "campaign_players": (
        "/api/campaigns/{campaign}/players/",
        7,
    ),  # constant in warbands (apps/warbands/tests/test_summary_service.py)
    "battle_history": ("/api/campaigns/{campaign}/battle-history/", 3),
    "pivotal_moments": ("/api/campaigns/{campaign}/pivotal-moments/", 2),
    "top_killers": ("/api/campaigns/{campaign}/top-killers/", 2),
    "open_battles": ("/api/campaigns/{campaign}/battles/?open=1", 2),
    "battle_list": ("/api/campaigns/{campaign}/battles/", 3),
    "permissions_me": ("/api/campaigns/{campaign}/permissions/me/", 1),
    "notifications": ("/api/notifications/", 1),
    # Warband sheet
    "warband_detail": ("/api/warbands/{warband}/", 3),
    "warband_summary": ("/api/warbands/{warband}/summary/", 7),
    "warband_sheet": ("/api/warbands/{warband}/sheet/", 15),  # constant in units (test below); one request for 5
    "warband_heroes": ("/api/warbands/{warband}/heroes/", 4),  # constant in units
    "warband_henchmen": ("/api/warbands/{warband}/henchmen-groups/", 5),  # constant in units
    "warband_hired_swords": ("/api/warbands/{warband}/hired-swords/", 4),  # constant in units
    "warband_hero": ("/api/warbands/{warband}/heroes/{hero}/", 7),
    "warband_henchmen_group": ("/api/warbands/{warband}/henchmen-groups/{group}/", 8),
    "warband_hired_sword": ("/api/warbands/{warband}/hired-swords/{sword}/", 7),
    "warband_hero_kill_history": ("/api/warbands/{warband}/heroes/{hero}/kill-history/", 4),
    "warband_heroes_detail": ("/api/warbands/{warband}/heroes/detail/", 7),  # constant in units (test below)
    "warband_henchmen_detail": (
        "/api/warbands/{warband}/henchmen-groups/detail/",
        8,
    ),  # constant in units
    "warband_hired_swords_detail": (
        "/api/warbands/{warband}/hired-swords/detail/",
        7,
    ),  # constant in units
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
    "battle_state": ("/api/campaigns/{campaign}/battles/{battle}/state/", 6),  # first read writes presence once
}

# Unit writes the roster screen sends on every XP click and level-up: name -> (method, url, body, budget).
# Each answers with one fresh read of the unit through the shared detail prefetch (PERF-23), so the
# count doesn't grow with the unit's items (test below). Every write runs in transaction.atomic(), which
# inside the test's own transaction is a SAVEPOINT and a RELEASE (2 queries).
WRITE_QUERY_BUDGETS: dict[str, tuple[str, str, dict[str, Any], int]] = {
    "hero_patch_xp": ("patch", "/api/warbands/{warband}/heroes/{hero}/", {"xp": 3}, 11),
    "henchmen_group_patch_xp": ("patch", "/api/warbands/{warband}/henchmen-groups/{group}/", {"xp": 3}, 12),
    "hired_sword_patch_xp": ("patch", "/api/warbands/{warband}/hired-swords/{sword}/", {"xp": 3}, 11),
    "hero_level_up": (
        "post",
        "/api/warbands/{warband}/heroes/{hero}/level-up/",
        {"payload": {"advance": {"id": "WS"}}},
        12,
    ),
    "henchmen_group_level_up": (
        "post",
        "/api/warbands/{warband}/henchmen-groups/{group}/level-up/",
        {"payload": {"advance": {"id": "WS"}}},
        13,
    ),
    "hired_sword_level_up": (
        "post",
        "/api/warbands/{warband}/hired-swords/{sword}/level-up/",
        {"payload": {"advance": {"id": "WS"}}},
        12,
    ),
}


class QueryBudgetTests(TestCase):
    ref: ReferenceCampaign
    unit_ids: dict[str, int]

    @classmethod
    def setUpTestData(cls):
        cls.ref = build_reference_campaign()
        warband = cls.ref.warband
        cls.unit_ids = {
            "hero": Hero.objects.filter(warband=warband).order_by("id")[0].id,
            "group": HenchmenGroup.objects.filter(warband=warband).order_by("id")[0].id,
            "sword": HiredSword.objects.filter(warband=warband).order_by("id")[0].id,
        }

    def _url(self, template: str) -> str:
        return template.format(
            campaign=self.ref.campaign_id, warband=self.ref.warband.id, battle=self.ref.ended_battle.id, **self.unit_ids
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

    def test_unit_detail_queries_do_not_grow_with_units_or_items(self):
        client = self.ref.owner_client
        client.force_authenticate(user=self.ref.owner)
        endpoints = [
            "warband_sheet",
            "warband_heroes",
            "warband_henchmen",
            "warband_hired_swords",
            "warband_heroes_detail",
            "warband_henchmen_detail",
            "warband_hired_swords_detail",
        ]
        # Start from a warband that already has restriction-linked items: the first link adds
        # one fixed query (restrictions are only fetched when some exist), which isn't growth.
        add_units_with_items(self.ref.warband, count=1, label="Seed")
        before = {name: count_get_queries(client, self._url(QUERY_BUDGETS[name][0])) for name in endpoints}

        add_units_with_items(self.ref.warband, count=4, label="Extra")

        for name in endpoints:
            with self.subTest(endpoint=name):
                self.assertEqual(count_get_queries(client, self._url(QUERY_BUDGETS[name][0])), before[name])

    def test_unit_writes_stay_within_query_budget(self):
        client = self.ref.owner_client
        client.force_authenticate(user=self.ref.owner)
        Hero.objects.filter(warband=self.ref.warband).update(level_up=1)
        HenchmenGroup.objects.filter(warband=self.ref.warband).update(level_up=1)
        HiredSword.objects.filter(warband=self.ref.warband).update(level_up=1)
        for name, (method, template, body, budget) in WRITE_QUERY_BUDGETS.items():
            with self.subTest(endpoint=name):
                with CaptureQueriesContext(connection) as captured:
                    response = getattr(client, method)(self._url(template), body, format="json")
                self.assertEqual(response.status_code, 200, response.data)
                self.assertLessEqual(len(captured), budget, f"{name} ran {len(captured)} queries (budget {budget}).")

    def test_roster_batch_stays_within_query_budget(self):
        # The recruit queue's Save (decision 1): a fixed cost (access, the answer's roster and summary) plus a
        # few queries per entry, never per roster unit (apps/warbands/tests/test_roster_batch.py).
        client = self.ref.owner_client
        client.force_authenticate(user=self.ref.owner)
        url = self._url("/api/warbands/{warband}/heroes/batch/")
        heroes = list(Hero.objects.filter(warband=self.ref.warband).order_by("id").values_list("id", flat=True))
        cases: list[tuple[str, dict[str, Any], int]] = [
            ("empty", {}, 14),
            ("one update", {"update": [{"id": heroes[0], "xp": 5}]}, 16),
            ("two updates", {"update": [{"id": heroes[0], "xp": 6}, {"id": heroes[1], "xp": 6}]}, 17),
            ("one create", {"create": [{"name": "New", "unit_type": "Champion", "price": 5}]}, 23),
            ("one dismissal", {"dismiss": [heroes[-1]]}, 22),
        ]
        for name, body, budget in cases:
            with self.subTest(batch=name):
                with CaptureQueriesContext(connection) as captured:
                    response = client.post(url, body, format="json")
                self.assertEqual(response.status_code, 200, response.data)
                self.assertLessEqual(len(captured), budget, f"{name} ran {len(captured)} queries (budget {budget}).")

    def test_unit_writes_do_not_grow_with_items(self):
        client = self.ref.owner_client
        client.force_authenticate(user=self.ref.owner)
        warband = self.ref.warband
        Hero.objects.filter(warband=warband).update(level_up=2)
        HenchmenGroup.objects.filter(warband=warband).update(level_up=2)
        HiredSword.objects.filter(warband=warband).update(level_up=2)

        def count(name: str, xp: int) -> int:
            method, template, body, _ = WRITE_QUERY_BUDGETS[name]
            body = {"xp": xp} if "xp" in body else body
            with CaptureQueriesContext(connection) as captured:
                response = getattr(client, method)(self._url(template), body, format="json")
            self.assertEqual(response.status_code, 200, response.data)
            return len(captured)

        units = (
            Hero.objects.get(id=self.unit_ids["hero"]),
            HenchmenGroup.objects.get(id=self.unit_ids["group"]),
            HiredSword.objects.get(id=self.unit_ids["sword"]),
        )
        # Seed one restriction-linked item first: the first link adds one fixed query, which isn't growth.
        add_items_to_units(*units, count=1, label="Seed")
        before = {name: count(name, xp=1) for name in WRITE_QUERY_BUDGETS}
        add_items_to_units(*units, count=4, label="Extra")
        for name in WRITE_QUERY_BUDGETS:
            with self.subTest(endpoint=name):
                self.assertEqual(count(name, xp=1), before[name])

    def test_repeat_battle_state_reads_do_not_write(self):
        client = self.ref.owner_client
        client.force_authenticate(user=self.ref.owner)
        url = self._url(QUERY_BUDGETS["battle_state"][0])
        first = count_get_queries(client, url)

        with CaptureQueriesContext(connection) as captured:
            self.assertEqual(client.get(url).status_code, 200)

        writes = [query["sql"] for query in captured if query["sql"].lstrip().upper().startswith("UPDATE")]
        self.assertEqual(writes, [])
        self.assertEqual(len(captured), first - 1)
