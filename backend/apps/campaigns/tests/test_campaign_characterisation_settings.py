"""Starting the campaign and changing its settings (BUG-13, BUG-76, BUG-77; CAMP-TEST-06, -22).

Every setting is written by the campaign PATCH: the owner sends any field, an admin only the start flag. Writes that
fail part way need committed transactions, so they live in `test_campaign_transactions.py`; starting gold is in
`test_campaign_starting_gold.py`.
"""

from typing import Any

from apps.campaigns.models import Campaign, CampaignSettings
from apps.restrictions.models import Restriction
from apps.warbands.models import Hero

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

    def test_an_admin_starts_and_unstarts_the_campaign_but_changes_nothing_else(self):
        # BUG-13, CAMP-TEST-06 (decision 2): the PATCH was owner only, so an admin's Start answered 403
        self.assertEqual(self.start(self.player).status_code, 403)
        self.assertEqual(self.start(self.outsider).status_code, 404)

        response = self.start(self.admin)

        self.assertEqual(
            (response.status_code, response.data["in_progress"], response.data["role"]), (200, True, "admin")
        )
        self.assertTrue(self.started())
        self.assertFalse(self.start(self.admin, in_progress=False).data["in_progress"])
        for body in ({"in_progress": True, "max_heroes": 4}, {"starting_gold": 600}, {"enable_locations": True}):
            with self.subTest(body=body):
                refused = self.patch_as(self.admin, self.url(), body)
                self.assertEqual((refused.status_code, refused.data), (403, {"detail": "Forbidden"}))
        self.assertFalse(self.started())
        self.assertEqual(CampaignSettings.objects.get(campaign=self.campaign).max_heroes, 6)

    def test_before_the_start_battles_and_reported_results_warn_and_go_ahead(self):
        # BUG-77, decision 3: nothing read in_progress; now the start only takes the warning away (XP is unchanged)
        self.assertFalse(self.started())
        hero = Hero.objects.create(warband=self.warband, name="Abbess", unit_type="Matriarch")
        warning = {"code": "campaign_not_started", "message": "The campaign hasn't started yet."}
        players = [self.player.id, self.rival.id]

        battle = self.post_as(self.player, self.url("battles/"), {"participant_user_ids": players, "scenario": "Ford"})
        reported = self.report(self.player)
        xp = self.patch_as(self.player, f"/api/warbands/{self.warband.id}/heroes/{hero.id}/", {"xp": 3})

        self.assertEqual((battle.status_code, battle.json()["warnings"]), (201, [warning]))
        self.assertEqual((reported.status_code, reported.json()["warnings"]), (201, [warning]))
        self.assertEqual((xp.status_code, Hero.objects.get(id=hero.id).xp), (200, 3))

        self.start(self.admin)
        after = self.report(self.rival)

        self.assertEqual(after.status_code, 201, after.data)
        self.assertNotIn("warnings", after.json())

    def report(self, user):
        body = {
            "participant_user_ids": [self.player.id, self.rival.id],
            "scenario": "Ambush",
            "battle_date": "2026-10-01",
            "winner_warband_ids": [self.warband.id],
        }
        return self.post_as(user, self.url("battles/report-result/"), body)


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
