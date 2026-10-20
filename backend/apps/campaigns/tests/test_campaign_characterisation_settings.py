"""Starting the campaign and changing its settings (BUG-13, BUG-76, BUG-77, BUG-78; CAMP-TEST-06, -22, -23).

Every setting is written by the campaign PATCH, which only the owner may send. The 500s from out-of-range numbers
abort the test's transaction, so they live in `test_campaign_transactions.py`.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.campaigns.models import Campaign, CampaignSettings
from apps.restrictions.models import Restriction
from apps.warbands.models import Hero, LedgerAction, Warband, WarbandLog, WarbandTrade
from apps.warbands.services import ledger
from apps.warbands.tests.roster_support import clear_ledger, trade_rows

from .campaign_support import CampaignTestCase

STARTING = ("Starting gold", "Starting Gold")


class CampaignStartTests(CampaignTestCase):
    def start(self, user, in_progress=True):
        return self.patch_as(user, self.url(), {"in_progress": in_progress})

    def started(self) -> bool:
        self.campaign.refresh_from_db()
        return self.campaign.in_progress

    def test_the_owner_starts_the_campaign_and_can_unstart_it(self):
        response = self.start(self.owner)

        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.data["in_progress"], response.data["role"]), (True, "owner"))
        self.assertTrue(self.started())

        self.assertFalse(self.start(self.owner, in_progress=False).data["in_progress"])
        self.assertFalse(self.started())

    def test_an_admin_cannot_start_the_campaign(self):
        # Characterises current behaviour (BUG-13, CAMP-TEST-06, pinned; flips in PR A: decision 2)
        response = self.start(self.admin)

        self.assertEqual((response.status_code, response.data), (403, {"detail": "Forbidden"}))
        self.assertEqual(self.start(self.player).status_code, 403)
        self.assertEqual(self.start(self.outsider).status_code, 404)
        self.assertFalse(self.started())

    def test_nothing_on_the_server_reads_in_progress(self):
        # Characterises current behaviour (BUG-77, pinned; flips in PR A: decision 3 warns `campaign_not_started`)
        self.assertFalse(self.started())
        hero = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch")

        battle = self.post_as(
            self.player,
            self.url("battles/"),
            {"participant_user_ids": [self.player.id, self.rival.id], "scenario": "Street Fight"},
        )
        xp = self.patch_as(self.player, f"/api/warbands/{self.warband.id}/heroes/{hero.id}/", {"xp": 3})

        self.assertEqual(battle.status_code, 201, battle.data)
        self.assertNotIn("warnings", battle.json())
        self.assertEqual(xp.status_code, 200)
        self.assertEqual(Hero.objects.get(id=hero.id).xp, 3)


class CampaignSettingsTests(CampaignTestCase):
    def test_only_the_owner_changes_settings(self):
        for user, expected in ((self.admin, 403), (self.player, 403), (self.outsider, 404)):
            with self.subTest(user=user.first_name):
                response = self.patch_as(user, self.url(), {"enable_encampments": True})
                self.assertEqual(response.status_code, expected)
        self.assertFalse(CampaignSettings.objects.get(campaign=self.campaign).enable_encampments)

    def test_name_join_code_and_seats_are_not_editable(self):
        # The PATCH ignores fields it doesn't know: no rename, no new join code (CAMP-NEW-01), no seat change
        before = (self.campaign.name, self.campaign.join_code)
        for body in ({"name": "Renamed"}, {"join_code": "NEWONE"}, {"max_players": 12}, {}):
            with self.subTest(body=body):
                response = self.patch_as(self.owner, self.url(), body)
                self.assertEqual((response.status_code, response.data), (400, {"detail": "No updates provided."}))
        self.campaign.refresh_from_db()
        self.assertEqual((self.campaign.name, self.campaign.join_code), before)
        self.assertEqual(CampaignSettings.objects.get(campaign=self.campaign).max_players, 8)

    def test_settings_are_validated_and_normalised(self):
        invalid: list[dict[str, Any]] = [
            {"max_heroes": -1},
            {"max_hired_swords": -1},
            {"max_heroes": 32768},  # past the smallint column (BUG-76: a 500)
            {"max_hired_swords": 40000},
            {"starting_gold": -5},
            {"starting_gold": 2_147_483_648},  # past the ledger's 32-bit ceiling
            {"hero_death_roll": "d6"},
            {"hero_level_thresholds": []},
            {"henchmen_level_thresholds": [0]},
        ]
        for body in invalid:
            with self.subTest(body=body):
                self.assertEqual(self.patch_as(self.owner, self.url(), body).status_code, 400)

        setting = Restriction.objects.create(type="Setting", restriction="Cathay Setting")
        warband_only = Restriction.objects.create(type="Warband", restriction="Reiklanders")
        response = self.patch_as(
            self.owner,
            self.url(),
            {
                "max_heroes": 0,
                "max_hired_swords": 32767,  # the smallint column's ceiling
                "hero_level_thresholds": [9, 2, 2, 5],
                "hero_death_roll": "d100",
                "item_setting_ids": [setting.id, warband_only.id, 999999],
            },
        )

        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertEqual((data["max_heroes"], data["max_hired_swords"], data["hero_death_roll"]), (0, 32767, "d100"))
        self.assertEqual(data["hero_level_thresholds"], [2, 5, 9])
        self.assertEqual([row["restriction"] for row in data["item_settings"]], ["Cathay Setting"])

    def test_create_validates_every_number_against_its_column(self):
        # BUG-76, CAMP-TEST-22: only max_players was checked; the others reached the columns unchecked
        for seats in (1, 17):
            with self.subTest(max_players=seats):
                response = self.post_as(self.owner, "/api/campaigns/", {"name": "Tiny", "max_players": seats})
                self.assertEqual(response.status_code, 400)
                self.assertEqual(list(response.data), ["max_players"])
        too_big = {"max_heroes": 32768, "max_hired_swords": -1, "max_games": 40000, "starting_gold": 2**31}
        for field, value in too_big.items():
            with self.subTest(**{field: value}):
                response = self.post_as(self.owner, "/api/campaigns/", {"name": "Odd", field: value})
                self.assertEqual((response.status_code, list(response.data)), (400, [field]))
        self.assertFalse(Campaign.objects.filter(name="Odd").exists())

        created = self.post_as(
            self.owner,
            "/api/campaigns/",
            {"name": "Wide", "max_heroes": 32767, "max_hired_swords": 0, "max_games": 0, "starting_gold": 0},
        )

        self.assertEqual(created.status_code, 201)
        self.assertEqual((created.data["max_heroes"], created.data["max_players"]), (32767, 8))


class StartingGoldTests(CampaignTestCase):
    """The rival's ledger starts with a purchase, not with its starting gold (CAMP-TEST-23)."""

    def setUp(self) -> None:
        super().setUp()
        clear_ledger(self.rival_warband)
        ledger.record(self.rival_warband, LedgerAction.BUY, -40, "Shield")
        ledger.record(self.rival_warband, LedgerAction.REWARD, 10, "Purse")

    def set_starting_gold(self, amount):
        return self.patch_as(self.owner, self.url(), {"starting_gold": amount})

    def gold(self, warband: Warband) -> int:
        return Warband.objects.values_list("gold", flat=True).get(id=warband.id)

    def test_a_new_starting_gold_rewrites_each_warbands_oldest_row_whatever_its_action(self):
        # Characterises current behaviour (BUG-78, pinned; flips in PR A: decision 6, one Adjustment per warband)
        self.assertEqual(trade_rows(self.warband), [(*STARTING, 500, None)])

        response = self.set_starting_gold(600)

        self.assertEqual((response.status_code, response.data["starting_gold"]), (200, 600))
        self.assertEqual(trade_rows(self.warband), [(*STARTING, 600, None)])
        self.assertEqual(self.gold(self.warband), 600)
        self.assertEqual(trade_rows(self.rival_warband), [(*STARTING, 600, None), ("Reward", "Purse", 10, None)])
        self.assertEqual(self.gold(self.rival_warband), 610)  # the Shield is gone from the ledger
        self.assertFalse(WarbandLog.objects.filter(warband__campaign=self.campaign).exists())  # and nothing logs it

    def test_saving_the_same_amount_still_rewrites(self):
        # BUG-78: the save asks nothing and compares nothing
        self.set_starting_gold(500)

        self.assertEqual(trade_rows(self.rival_warband)[0], (*STARTING, 500, None))
        self.assertEqual(self.gold(self.rival_warband), 510)

    def test_a_warband_without_rows_gets_one_and_new_warbands_get_the_new_amount(self):
        clear_ledger(self.warband)

        self.set_starting_gold(450)
        created = self.post_as(
            self.admin, "/api/warbands/", {"name": "Ravens", "faction": "Mercenaries", "campaign_id": self.campaign.id}
        )

        self.assertEqual(trade_rows(self.warband), [(*STARTING, 450, None)])
        self.assertEqual(trade_rows(Warband.objects.get(id=created.data["id"])), [(*STARTING, 450, None)])

    def test_each_warband_is_rewritten_in_its_own_transaction(self):
        # Characterises current behaviour (BUG-78, pinned; PR A writes every adjustment in one INSERT and one UPDATE)
        def rewrite_queries(amount: int) -> list[str]:
            with CaptureQueriesContext(connection) as captured:
                self.assertEqual(self.set_starting_gold(amount).status_code, 200)
            return [query["sql"] for query in captured]

        two = rewrite_queries(600)
        self.post_as(
            self.admin, "/api/warbands/", {"name": "Ravens", "faction": "Merc", "campaign_id": self.campaign.id}
        )
        three = rewrite_queries(700)

        self.assertEqual(len(three) - len(two), 5)  # SAVEPOINT, the locked oldest row, its UPDATE, the balance, RELEASE
        self.assertEqual(
            sum(sql.startswith("SAVEPOINT") for sql in three), 1 + 3
        )  # the PATCH's own (BUG-76), then one each
        self.assertEqual(WarbandTrade.objects.filter(warband__campaign=self.campaign).count(), 4)
