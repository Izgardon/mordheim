"""A write the battle's current status no longer allows answers `code: "battle_status_changed"` with the status
(BUG-19's server half): a page that slept through a phase change reads the state again when it sees it. The old
`detail` stays, and refusals that already had their own code keep it."""

from apps.battles.models import Battle

from .battle_support import BattleTestCase, status_changed


class BattleStatusChangedTests(BattleTestCase):
    def test_a_config_save_after_the_battle_moved_on(self):
        battle_id = self.to_postbattle()
        Battle.objects.filter(id=battle_id).update(status=Battle.STATUS_ENDED)
        response = self.post_as(self.player, self.url(battle_id, "config"), {"battle_notes": "late"})
        self.assertEqual(
            (response.status_code, response.data), (400, status_changed("Battle configuration is locked", "ended"))
        )

    def test_a_kill_or_an_item_use_after_end_battle(self):
        a = f"hero:{self.warband.heroes.create(name='Abbess', unit_type='Matriarch').id}"
        r = f"hero:{self.rival.heroes.create(name='Rat', unit_type='Assassin').id}"
        battle_id = self.to_postbattle({self.player: [a], self.viewer: [r]})
        response = self.kill(self.player, battle_id, a, r)
        self.assertEqual((response.status_code, response.data), (400, status_changed("Battle is not active", "postbattle")))  # fmt: skip
        response = self.use_item(self.player, battle_id, {"unit_key": a, "item_id": 1})
        detail = "Items can only be used in prebattle or active battle"
        self.assertEqual((response.status_code, response.data), (400, status_changed(detail, "postbattle")))

    def test_a_skip_or_close_outside_postbattle_and_the_codes_that_stay(self):
        battle_id = self.to_prebattle()
        for action in ("skip-postbattle", "close-postbattle", "finalize-postbattle"):
            with self.subTest(action=action):
                response = self.post_as(self.player, self.url(battle_id, action))
                self.assertEqual(response.data, status_changed("Battle is not in postbattle", "prebattle"))
        battle_id = self.to_active()
        response = self.post_as(self.player, self.url(battle_id, "close-postbattle"))
        self.assertEqual(response.data, status_changed("Battle is not in postbattle", "active"))
        self.finish(battle_id, [self.warband])
        response = self.post_as(self.player, self.url(battle_id, "cancel-battle"))  # its own code, as before
        self.assertEqual(response.data, {"detail": "Postbattle can't be cancelled; close it instead", "code": "use_close_postbattle"})  # fmt: skip
