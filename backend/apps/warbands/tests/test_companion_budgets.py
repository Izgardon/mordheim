"""Mounts, pets and creature groups cost no query more for more of them (the bestiary rewrite step 4).

The beasts come with their items (`item_links_prefetch` joins each Animal item's beast) and a group's beast kind with
its row, so the sheet and the unit lists read the same number of queries whatever the number of riders, pets and
creature groups.
"""

from apps.core.testing import count_get_queries
from apps.warbands.models import HenchmenGroupItem, HeroItem, HirelingItem

from .beast_support import beast, raven, wardogs, warhorse
from .roster_support import HENCHMEN, HERO, HIRELING, RosterTestCase, make_unit, unit_url


class CompanionBudgetTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.horse, self.raven, self.dogs = warhorse(), raven(), wardogs()

    def add_beasts(self, count: int) -> None:
        for _ in range(count):
            hero = make_unit(HERO, self.warband)
            HeroItem.objects.create(hero=hero, item=self.horse, companion=True)
            HeroItem.objects.create(hero=hero, item=self.raven, companion=True)
            group = make_unit(HENCHMEN, self.warband, members=("A",))
            HenchmenGroupItem.objects.create(henchmen_group=group, item=self.horse, companion=True)
            make_unit(HENCHMEN, self.warband, source_beast=beast(self.dogs))
            sword = make_unit(HIRELING, self.warband)
            HirelingItem.objects.create(hireling=sword, item=self.horse, companion=True)

    def test_the_sheet_and_the_unit_lists_read_beasts_in_a_fixed_number_of_queries(self):
        urls = [f"/api/warbands/{self.warband.id}/sheet/"]
        for kind in (HERO, HENCHMEN, HIRELING):
            urls += [unit_url(kind, self.warband.id), unit_url(kind, self.warband.id, suffix="detail/")]
        self.add_beasts(1)
        few = {url: count_get_queries(self.client, url) for url in urls}

        self.add_beasts(3)

        self.assertEqual({url: count_get_queries(self.client, url) for url in urls}, few)
