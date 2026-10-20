"""The stuck-battles banner's data (decision 7, CAMP-NEW-05): Settings > Active Battles says how long each open
battle has been idle and whether it has been idle for 24 hours, for battle managers only."""

from datetime import timedelta

from django.utils import timezone

from apps.battles.models import Battle

from .campaign_support import CampaignTestCase


class StuckBattleTests(CampaignTestCase):
    def idle_for(self, battle: Battle, idle: timedelta) -> None:
        Battle.objects.filter(id=battle.id).update(last_activity_at=timezone.now() - idle)

    def test_each_open_battle_says_how_long_it_has_been_idle_and_whether_it_is_stuck(self):
        stuck = self.open_battle(Battle.STATUS_PREBATTLE)
        recent = self.open_battle(Battle.STATUS_PREBATTLE)
        borderline = self.open_battle(Battle.STATUS_PREBATTLE)
        self.idle_for(stuck, timedelta(days=5))
        self.idle_for(recent, timedelta(hours=1))
        self.idle_for(borderline, timedelta(hours=23, minutes=59))

        rows = {row["battle"]["id"]: row for row in self.get_as(self.admin, self.url("active-battles/")).json()}

        self.assertEqual(
            {battle_id: row["stuck"] for battle_id, row in rows.items()},
            {stuck.id: True, recent.id: False, borderline.id: False},
        )
        self.assertAlmostEqual(rows[stuck.id]["idle_seconds"], 5 * 24 * 3600, delta=60)
        self.assertAlmostEqual(rows[recent.id]["idle_seconds"], 3600, delta=60)

    def test_only_battle_managers_read_them(self):
        self.assertEqual(self.get_as(self.player, self.url("active-battles/")).status_code, 403)
        self.grant(self.player, "manage_battles")
        self.assertEqual(self.get_as(self.player, self.url("active-battles/")).status_code, 200)
