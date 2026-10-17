"""Postbattle XP: the campaign's level tables and half-rate units (BUG-03).

BATL-TEST-01/02 and ROST-TEST-05. The battles are played through the API by
`RosterTestCase.play_battle`.
"""

from decimal import Decimal

from apps.warbands.tests.roster_support import HENCHMEN, HERO, HIRED_SWORD, RosterTestCase, make_unit


class PostbattleXpTests(RosterTestCase):
    def test_heroes_level_against_the_campaign_hero_table(self):
        # BATL-TEST-01: the default table (2, 4, ...) would give one level-up, not two
        self.set_thresholds(hero_level_thresholds=[1, 3, 10])
        hero = make_unit(HERO, self.warband)

        self.play_battle({f"hero:{hero.id}": 3})

        hero.refresh_from_db()
        self.assertEqual((hero.xp, hero.level_up), (Decimal(3), 2))

    def test_a_thresholds_setting_that_is_not_a_list_falls_back_to_the_default_table(self):
        # BUG-97: an int stored through the admin made finalisation a 500
        self.set_thresholds(hero_level_thresholds=5, henchmen_level_thresholds=5, hired_sword_level_thresholds=5)
        hero = make_unit(HERO, self.warband)
        group = make_unit(HENCHMEN, self.warband, members=("Alpha",))

        self.play_battle({f"hero:{hero.id}": 3, f"henchman:{group.henchmen.get().id}": 3})

        hero.refresh_from_db()
        group.refresh_from_db()
        self.assertEqual((hero.level_up, group.level_up), (1, 1))  # default tables: 2, 4, ... and 2, 5, ...

    def test_henchmen_use_their_table_and_hired_swords_the_hero_table(self):
        # BATL-TEST-02: both used to fall back to the default henchmen table (one level-up at 2). Hired
        # swords advance like heroes and ignore the old hired-sword setting (decision 8).
        self.set_thresholds(
            henchmen_level_thresholds=[3], hero_level_thresholds=[1, 2, 3], hired_sword_level_thresholds=[7]
        )
        group = make_unit(HENCHMEN, self.warband, members=("Alpha",))
        sword = make_unit(HIRED_SWORD, self.warband)

        self.play_battle({f"henchman:{group.henchmen.get().id}": 3, f"hired_sword:{sword.id}": 3})

        group.refresh_from_db()
        sword.refresh_from_db()
        self.assertEqual((group.level_up, sword.level_up), (1, 3))

    def test_half_rate_units_gain_half_the_xp(self):
        # ROST-TEST-05 and decision 6: an odd award leaves half a point
        hero = make_unit(HERO, self.warband, half_rate=True)
        group = make_unit(HENCHMEN, self.warband, half_rate=True, members=("Alpha",))
        sword = make_unit(HIRED_SWORD, self.warband, half_rate=True)

        self.play_battle({f"hero:{hero.id}": 2, f"henchman:{group.henchmen.get().id}": 3, f"hired_sword:{sword.id}": 2})

        for unit in (hero, group, sword):
            unit.refresh_from_db()
        self.assertEqual([unit.xp for unit in (hero, group, sword)], [Decimal("1.0"), Decimal("1.5"), Decimal("1.0")])
        self.assertEqual([unit.level_up for unit in (hero, group, sword)], [0, 0, 0])

    def test_half_rate_units_reach_a_threshold_only_on_whole_xp(self):
        # default tables: heroes 2, 4, ...; henchmen and hired swords 2, 5, ...
        hero = make_unit(HERO, self.warband, half_rate=True, xp=Decimal("1.5"))
        group = make_unit(HENCHMEN, self.warband, half_rate=True, xp=Decimal("4.5"), members=("Alpha",))
        sword = make_unit(HIRED_SWORD, self.warband, half_rate=True, xp=Decimal("4.0"))

        self.play_battle({f"hero:{hero.id}": 1, f"henchman:{group.henchmen.get().id}": 1, f"hired_sword:{sword.id}": 1})

        for unit in (hero, group, sword):
            unit.refresh_from_db()
        self.assertEqual([unit.xp for unit in (hero, group, sword)], [Decimal("2.0"), Decimal("5.0"), Decimal("4.5")])
        self.assertEqual([unit.level_up for unit in (hero, group, sword)], [1, 1, 0])  # 4.5 hasn't reached 5

    def test_no_level_ups_units_still_gain_no_postbattle_xp(self):
        # unchanged by BUG-03: henchmen groups and hired swords flagged no_level_ups keep their XP
        group = make_unit(HENCHMEN, self.warband, no_level_ups=True, members=("Alpha",))
        sword = make_unit(HIRED_SWORD, self.warband, no_level_ups=True, half_rate=True)

        self.play_battle({f"henchman:{group.henchmen.get().id}": 4, f"hired_sword:{sword.id}": 4})

        for unit in (group, sword):
            unit.refresh_from_db()
        self.assertEqual([(unit.xp, unit.level_up) for unit in (group, sword)], [(Decimal(0), 0)] * 2)
