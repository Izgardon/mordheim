"""Characterisation: XP and level-ups applied by postbattle finalisation, per kind (pass 1).

Postbattle is where most XP accrues. Since BUG-03 it counts level-ups against the same campaign
tables as the unit PATCH and halves the XP of half-rate units (decision 6). More cases live in
apps/battles/tests/test_postbattle_xp.py.
"""

from decimal import Decimal
from typing import Any

from .roster_support import HENCHMEN, HERO, HIRELING, RosterTestCase, make_unit


class PostbattleXpCharacterisationTests(RosterTestCase):
    def _roster(self, **fields: Any) -> tuple[Any, Any, Any, dict[str, int]]:
        hero = make_unit(HERO, self.warband, **fields)
        group = make_unit(HENCHMEN, self.warband, **fields)
        sword = make_unit(HIRELING, self.warband, **fields)
        keys = [f"hero:{hero.id}", f"hireling:{sword.id}"]
        keys += [f"henchman:{member_id}" for member_id in group.henchmen.values_list("id", flat=True)]
        return hero, group, sword, dict.fromkeys(keys, 4)

    def test_postbattle_xp_uses_the_campaign_thresholds(self):
        # BUG-03: the default tables used to be used here (2, 1 and 1 level-ups)
        self.set_thresholds(
            hero_level_thresholds=[3, 7],
            henchmen_level_thresholds=[1, 2, 3],
            hired_sword_level_thresholds=[1, 2, 3],
        )
        hero, group, sword, xp = self._roster()

        self.play_battle(xp)

        for unit in (hero, group, sword):
            unit.refresh_from_db()
        # +4 XP from 0: heroes and hired swords (decision 8: the hero table, the hired-sword setting is
        # ignored) cross 3 of [3, 7]; henchmen cross all of [1, 2, 3]
        self.assertEqual([unit.xp for unit in (hero, group, sword)], [4, 4, 4])
        self.assertEqual([unit.level_up for unit in (hero, group, sword)], [1, 3, 1])

    def test_half_rate_units_gain_half_the_postbattle_xp(self):
        # BUG-03: half-rate units used to gain the full award (4.5 here)
        hero, group, sword, xp = self._roster(half_rate=True, xp=Decimal("0.5"))

        self.play_battle(xp)

        for unit in (hero, group, sword):
            unit.refresh_from_db()
        self.assertEqual([unit.xp for unit in (hero, group, sword)], [Decimal("2.5")] * 3)
        self.assertEqual([unit.level_up for unit in (hero, group, sword)], [1, 1, 1])  # (0.5, 2.5] crosses 2
