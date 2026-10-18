"""Query budgets for the endpoints behind the main screens.

Each budget is the query count measured on the reference campaign (3 of each unit
type, 3 battles). A test fails if an endpoint needs MORE queries than its budget;
when a change makes an endpoint cheaper, lower its budget in the same commit so the
gain is locked in. Endpoints marked "N+1" still grow with data and are fixed in
their feature pass (see docs/review/PERFORMANCE.md).
"""

from datetime import timedelta
from typing import Any

from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.testing import (
    ReferenceCampaign,
    add_items_to_units,
    add_units_with_items,
    build_reference_campaign,
    count_get_queries,
)
from apps.items.models import Item
from apps.trades.models import TradeRequest
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
    "warband_summary": ("/api/warbands/{warband}/summary/", 6),  # gold is a stored column (decision 4)
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
    "warband_logs_page": ("/api/warbands/{warband}/logs/?limit=25", 4),  # + the features (first page only)
    "warband_trades": ("/api/warbands/{warband}/trades/", 4),
    "warband_trades_page": ("/api/warbands/{warband}/trades/?limit=25", 4),
    "warband_resources": ("/api/warbands/{warband}/resources/", 3),
    # Trades (constant in trades: test below)
    "campaign_trade_requests": ("/api/campaigns/{campaign}/trade-requests/", 2),  # reads no longer expire (BUG-69)
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
        sword = Item.objects.get(name="Sword 0").id
        cases: list[tuple[str, dict[str, Any], int]] = [
            ("empty", {}, 13),
            ("one update", {"update": [{"id": heroes[0], "xp": 5}]}, 15),
            ("two updates", {"update": [{"id": heroes[0], "xp": 6}, {"id": heroes[1], "xp": 6}]}, 16),
            # the recruit's gold: its row and the stored balance (decision 4)
            ("one create", {"create": [{"name": "New", "unit_type": "Champion", "price": 5}]}, 23),
            ("one dismissal", {"dismiss": [heroes[-1]]}, 21),
            # pass 2: a purchase adds the roster ids, its item, the charge, the copies and new updated_at, the log
            ("one purchase", {"purchases": [{"unit_id": heroes[0], "item_id": sword, "price": 5}]}, 22),
            (
                "two purchases",
                {"purchases": [{"unit_id": hero, "item_id": sword, "price": 5} for hero in heroes[:2]]},
                26,  # + the Group header; each line its copies, updated_at and log
            ),
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

    def _count_writes(self, client: APIClient, cases: list[tuple[str, str, dict[str, Any], int]]) -> None:
        for name, url, body, budget in cases:
            with self.subTest(write=name):
                with CaptureQueriesContext(connection) as captured:
                    response = client.post(url, body, format="json")
                self.assertEqual(response.status_code, 200, response.data)
                self.assertLessEqual(len(captured), budget, f"{name} ran {len(captured)} queries (budget {budget}).")

    def test_item_moves_and_sales_stay_within_query_budget(self):
        # ECON-TEST-14 (pass 2). Each answers with both units' detail payloads and the summary, built inside the
        # transaction (ECON-PERF-03). Source and target are resolved with one id-only query each (BUG-06); a stash
        # row is locked and changed in two queries, without re-reading it (BUG-36). Each writes its log entry (+1,
        # ECON-CQ-02); a sale also writes its gold to the stored balance (+1, decision 4); each unit whose copies
        # change gets a new updated_at, the version a roster Save sends back (+1 per unit, pass 2 decision 1).
        client = self.ref.owner_client
        client.force_authenticate(user=self.ref.owner)
        heroes = list(Hero.objects.filter(warband=self.ref.warband).order_by("id").values_list("id", flat=True))
        items = list(Item.objects.filter(name__startswith="Sword ").order_by("name").values_list("id", flat=True))
        moves, sales = (
            self._url("/api/warbands/{warband}/item-transfers/"),
            self._url("/api/warbands/{warband}/item-sales/"),
        )
        stash_to_hero = {"source_type": "stash", "target_type": "hero", "target_id": heroes[0], "item_id": items[0]}
        hero_to_hero = {"source_type": "hero", "source_id": heroes[1], "target_type": "hero", "target_id": heroes[2]}
        hero_to_stash = {"source_type": "hero", "source_id": heroes[1], "target_type": "stash", "item_id": items[2]}
        self._count_writes(
            client,
            [
                ("move stash to hero", moves, {**stash_to_hero, "quantity": 1}, 20),
                ("move hero to hero", moves, {**hero_to_hero, "item_id": items[1], "quantity": 1}, 27),
                ("move hero to stash", moves, {**hero_to_stash, "quantity": 1}, 21),  # onto an existing stash row
                (
                    "sell from the stash",
                    sales,
                    {"source_type": "stash", "item_id": items[2], "quantity": 1, "price": 5},
                    14,
                ),
                (
                    "sell from a hero",
                    sales,
                    {"source_type": "hero", "source_id": heroes[2], "item_id": items[1], "quantity": 1, "price": 5},
                    21,
                ),
            ],
        )

    def test_purchases_stay_within_query_budget(self):
        # BUG-07 (pass 2): one request where a purchase used to take about 8. Access, the item and its prices, the
        # transaction, the "Buy" row and the stored balance, the copies, the log, then the answer: the stash entry
        # or the unit's items (constant in its items) and its new updated_at, and the summary. A rarity roll adds its
        # hero and log.
        client = self.ref.owner_client
        client.force_authenticate(user=self.ref.owner)
        url = self._url("/api/warbands/{warband}/purchases/")
        hero, item = self.unit_ids["hero"], Item.objects.get(name="Sword 0").id
        roll = {"hero_id": hero, "roll": 8, "success": True}
        cases: list[tuple[str, dict[str, Any], int]] = [
            ("to the stash", {"item_id": item, "price": 5, "target_type": "stash"}, 19),
            ("at the current campaign price", {"item_id": item, "target_type": "stash"}, 20),
            ("to a hero", {"item_id": item, "price": 5, "target_type": "hero", "target_id": hero}, 21),
            (
                "with a rarity roll",
                {"item_id": item, "price": 5, "target_type": "hero", "target_id": hero, "rarity_roll": roll},
                24,
            ),
        ]
        for name, body, budget in cases:
            with self.subTest(purchase=name):
                with CaptureQueriesContext(connection) as captured:
                    response = client.post(url, body, format="json")
                self.assertEqual(response.status_code, 201, response.data)
                self.assertLessEqual(len(captured), budget, f"{name} ran {len(captured)} queries (budget {budget}).")

    @override_settings(RATE_LIMIT_ENABLED=False)  # trade writes are throttled; the throttle itself runs no SQL
    def test_trade_writes_stay_within_query_budget(self):
        # ECON-TEST-14 (pass 2), without traders (a trader adds his guarded spend). Every write locks the request in
        # a transaction (BUG-08): SAVEPOINT and RELEASE inside the test's transaction, 2 of each count. Offer reads
        # the stored gold for the cap. The completing lock also locks both warbands and grows with the trade: 3-6
        # queries per offered item (a new stash row on the receiver adds a savepoint); the gold rows are one INSERT
        # and both balances one UPDATE (decision 4).
        owner, player = self.ref.owner_client, APIClient()
        owner.force_authenticate(user=self.ref.owner)
        player.force_authenticate(user=self.ref.player)
        trade = TradeRequest.objects.create(
            campaign_id=self.ref.campaign_id,
            from_user=self.ref.owner,
            to_user=self.ref.player,
            from_warband=self.ref.warband,
            to_warband=self.ref.rival_warband,
            status=TradeRequest.STATUS_ACCEPTED,
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        base = self._url(f"/api/campaigns/{{campaign}}/trade-requests/{trade.id}/")
        item = Item.objects.get(name="Sword 0").id
        self._count_writes(owner, [("offer", f"{base}offer/", {"gold": 10, "items": [{"id": item, "quantity": 1}]}, 6)])
        self._count_writes(player, [("offer back", f"{base}offer/", {"gold": 5}, 5)])
        self._count_writes(owner, [("lock", f"{base}lock/", {}, 4), ("unlock", f"{base}unlock/", {}, 4)])
        self._count_writes(owner, [("lock again", f"{base}lock/", {}, 4)])
        # + both warbands' summaries in the answer and the event (5 queries for both; ECON-PERF-02), which saves
        # each browser its summary GET; + resolving the trade's notifications as it ends (1; decision 8, BUG-69);
        # + both sides' "trade completed" log entries in one INSERT (ECON-CQ-02)
        self._count_writes(player, [("lock that completes the trade", f"{base}lock/", {}, 25)])
        trade.refresh_from_db()
        self.assertEqual(trade.status, TradeRequest.STATUS_COMPLETED)

    def test_campaign_trade_list_does_not_grow_with_trades(self):
        client = self.ref.owner_client
        client.force_authenticate(user=self.ref.owner)
        url = self._url(QUERY_BUDGETS["campaign_trade_requests"][0])

        def add_trades(count: int) -> None:
            TradeRequest.objects.bulk_create(
                TradeRequest(
                    campaign_id=self.ref.campaign_id,
                    from_user=self.ref.owner,
                    to_user=self.ref.player,
                    from_warband=self.ref.warband,
                    to_warband=self.ref.rival_warband,
                    status=status,
                    expires_at=timezone.now() + timedelta(minutes=5),
                )
                for status in ("pending", "accepted", "declined", "completed")[:count]
            )

        add_trades(1)
        before = count_get_queries(client, url)
        add_trades(4)
        self.assertEqual(count_get_queries(client, url), before)

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
