"""Characterisation: XP and level-ups applied by postbattle finalisation, per kind (pass 1).

Postbattle is where most XP accrues. PR A routes it through the same XP service as the
unit PATCH (BUG-03), so today's divergence from the PATCH path is pinned here.
"""

from decimal import Decimal
from typing import Any

from .roster_support import HENCHMEN, HERO, HIRED_SWORD, RosterTestCase, make_unit


class PostbattleXpCharacterisationTests(RosterTestCase):
    def _result(self, unit_key: str, xp: int) -> dict[str, Any]:
        kind = unit_key.split(":")[0]
        return {
            "unit_name": unit_key,
            "unit_kind": kind,
            "unit_type": "Trooper",
            "group_name": "",
            "out_of_action": False,
            "kill_count": 0,
            "xp_earned": xp,
            "dead": False,
            "special_ids": [],
            "serious_injury_rolls": [],
        }

    def _post(self, user: Any, url: str, body: dict[str, Any]) -> None:
        self.client.force_authenticate(user=user)
        response = self.client.post(url, body, format="json")
        self.assertIn(response.status_code, (200, 201), (url, response.data))

    def _play_battle(self, xp_by_unit_key: dict[str, int]) -> None:
        """Play and finalise a battle of `warband` against `rival`, awarding our units the given XP."""
        rival_key = f"hero:{make_unit(HERO, self.rival).id}"
        sides = ((self.player, {**xp_by_unit_key}), (self.viewer, {rival_key: 0}))
        base = f"/api/campaigns/{self.campaign.id}/battles/"
        self.client.force_authenticate(user=self.player)
        created = self.client.post(
            base, {"participant_user_ids": [self.player.id, self.viewer.id], "scenario": "Bridge"}, format="json"
        )
        self.assertEqual(created.status_code, 201, created.data)
        battle = f"{base}{created.data['battle']['id']}/"
        for user, _ in sides:
            self._post(user, f"{battle}join/", {})
        for user, _ in sides:
            self._post(user, f"{battle}ready/", {"ready": True})
        self._post(self.player, f"{battle}start/", {})
        for user, xp in sides:
            info = {key: {"stats_override": {}, "out_of_action": False, "kill_count": 0} for key in xp}
            config = {"selected_unit_keys_json": list(xp), "unit_information_json": info, "custom_units_json": []}
            self._post(user, f"{battle}config/", config)
        self._post(self.player, f"{battle}finish/", {"winner_warband_ids": [self.warband.id]})
        for user, xp in sides:
            results = {key: self._result(key, earned) for key, earned in xp.items()}
            postbattle = {"exploration": {"dice_values": [], "resource_id": None}, "unit_results": results}
            self._post(user, f"{battle}finalize-postbattle/", {"postbattle_json": postbattle})

    def _roster(self, **fields: Any) -> tuple[Any, Any, Any, dict[str, int]]:
        hero = make_unit(HERO, self.warband, **fields)
        group = make_unit(HENCHMEN, self.warband, **fields)
        sword = make_unit(HIRED_SWORD, self.warband, **fields)
        keys = [f"hero:{hero.id}", f"hired_sword:{sword.id}"]
        keys += [f"henchman:{member_id}" for member_id in group.henchmen.values_list("id", flat=True)]
        return hero, group, sword, dict.fromkeys(keys, 4)

    def test_postbattle_xp_ignores_the_campaign_thresholds(self):
        # Characterises current behaviour (BUG-03); update when fixed
        self.set_thresholds(
            hero_level_thresholds=[3, 7],
            henchmen_level_thresholds=[1, 2, 3],
            hired_sword_level_thresholds=[1, 2, 3],
        )
        hero, group, sword, xp = self._roster()

        self._play_battle(xp)

        for unit in (hero, group, sword):
            unit.refresh_from_db()
        # +4 XP from 0 against the default tables: heroes cross 2 and 4, the others cross 2.
        # With the campaign tables it would be 1, 3 and 3.
        self.assertEqual([unit.xp for unit in (hero, group, sword)], [4, 4, 4])
        self.assertEqual([unit.level_up for unit in (hero, group, sword)], [2, 1, 1])

    def test_half_rate_units_gain_full_postbattle_xp(self):
        # Characterises current behaviour (BUG-03); update when fixed
        hero, group, sword, xp = self._roster(half_rate=True, xp=Decimal("0.5"))

        self._play_battle(xp)

        for unit in (hero, group, sword):
            unit.refresh_from_db()
        self.assertEqual([unit.xp for unit in (hero, group, sword)], [Decimal("4.5")] * 3)
