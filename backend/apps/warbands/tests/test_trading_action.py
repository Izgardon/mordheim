"""The shared trading action helper (services/trading_action.py): one guarded UPDATE that the rare search, a
completed trade and a location visit all spend a hero's action through."""

from apps.warbands.models import Hero
from apps.warbands.services.trading_action import TRADING_ACTION_SPENT, spend_trading_action, spent_warning

from .roster_support import HERO, RosterTestCase, make_unit


class SpendTradingActionTests(RosterTestCase):
    def test_spends_only_the_heroes_who_still_have_it_in_one_update(self):
        ready = make_unit(HERO, self.warband, name="Ana", trading_action=True)
        spent = make_unit(HERO, self.warband, name="Bo", trading_action=False)
        other = make_unit(HERO, self.warband, name="Cy", trading_action=True)

        with self.assertNumQueries(1):
            count = spend_trading_action(Hero.objects.filter(id__in=[ready.id, spent.id]))

        self.assertEqual(count, 1)
        held = dict(Hero.objects.filter(warband=self.warband).values_list("name", "trading_action"))
        self.assertEqual(held, {"Ana": False, "Bo": False, "Cy": True})
        self.assertEqual(spend_trading_action(Hero.objects.filter(id=ready.id)), 0)  # a second spend spends nothing
        self.assertTrue(Hero.objects.get(id=other.id).trading_action)

    def test_the_warning_names_the_hero(self):
        hero = make_unit(HERO, self.warband, name="", trading_action=False)

        self.assertEqual(
            spent_warning(hero),
            {
                "code": TRADING_ACTION_SPENT,
                "message": f"Hero {hero.id} already used their trading action this round.",
                "hero_id": hero.id,
            },
        )
