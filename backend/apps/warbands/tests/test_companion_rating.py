"""A mount adds its rating bonus to the warband rating (the bestiary rewrite step 4): each rider's first switched-on
mount, a hero or hired sword riding one, a henchmen group one per living member. A mount that isn't switched on, a
pet, and a dead or dismissed unit's mount add nothing. The summary, the sheet and the campaign's warband list agree,
and read the bonuses with the units' rows: no query more, however many units ride.
"""

from decimal import Decimal

from django.utils import timezone

from apps.core.testing import count_get_queries
from apps.warbands.models import HenchmenGroupItem, HeroItem, HirelingItem

from .beast_support import make_animal, raven, warhorse
from .roster_support import HENCHMEN, HERO, HIRELING, RosterTestCase, make_unit


class MountRatingTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.horse, self.raven = warhorse(), raven()  # rating bonus 5; a pet
        self.pony = make_animal("Pony", "mount", rating_bonus=3)

    def rating(self) -> float:
        return float(self.client.get(f"/api/warbands/{self.warband.id}/summary/").data["rating"])

    def sheet_rating(self) -> float:
        return float(self.client.get(f"/api/warbands/{self.warband.id}/sheet/").data["summary"]["rating"])

    def test_a_rider_adds_his_first_mounts_bonus(self):
        hero = make_unit(HERO, self.warband, xp=Decimal("2"))
        HeroItem.objects.create(hero=hero, item=self.horse, companion=True)
        HeroItem.objects.create(hero=hero, item=self.pony, companion=True)  # a second mount: warned, not counted
        HeroItem.objects.create(hero=hero, item=self.pony)  # not switched on
        HeroItem.objects.create(hero=hero, item=self.raven, companion=True)  # a pet

        self.assertEqual((self.rating(), self.sheet_rating()), (5 + 2 + 5, 5 + 2 + 5))

    def test_a_hired_sword_adds_its_mounts_bonus_to_its_own_rating(self):
        sword = make_unit(HIRELING, self.warband, rating=20)
        HirelingItem.objects.create(hireling=sword, item=self.pony, companion=True)

        self.assertEqual((self.rating(), self.sheet_rating()), (23, 23))

    def test_a_group_rides_one_mount_per_living_member(self):
        group = make_unit(HENCHMEN, self.warband, members=("A", "B", "C"))
        for _ in range(4):
            HenchmenGroupItem.objects.create(henchmen_group=group, item=self.horse, companion=True)

        self.assertEqual((self.rating(), self.sheet_rating()), (3 * 5 + 3 * 5, 3 * 5 + 3 * 5))  # the fourth: no rider
        spare = HenchmenGroupItem.objects.filter(henchmen_group=group).order_by("-id").values_list("id", flat=True)[:2]
        HenchmenGroupItem.objects.filter(id__in=list(spare)).delete()
        self.assertEqual(self.rating(), 3 * 5 + 2 * 5)

    def test_the_summary_names_the_mounts_part_of_the_rating_a_group_on_mixed_mounts_included(self):
        group = make_unit(HENCHMEN, self.warband, members=("A", "B"))
        HenchmenGroupItem.objects.create(henchmen_group=group, item=self.horse, companion=True)
        HenchmenGroupItem.objects.create(henchmen_group=group, item=self.pony, companion=True)
        HeroItem.objects.create(hero=make_unit(HERO, self.warband), item=self.pony, companion=True)

        summary = self.client.get(f"/api/warbands/{self.warband.id}/summary/").data
        sheet = self.client.get(f"/api/warbands/{self.warband.id}/sheet/").data["summary"]

        self.assertEqual((summary["mounts_rating"], sheet["mounts_rating"]), (5 + 3 + 3, 5 + 3 + 3))
        self.assertEqual(float(summary["rating"]), 2 * 5 + 5 + 5 + 3 + 3)

    def test_a_dead_or_dismissed_riders_mount_adds_nothing(self):
        for fields in ({"dead": True}, {"dismissed_at": timezone.now()}):
            HeroItem.objects.create(hero=make_unit(HERO, self.warband, **fields), item=self.horse, companion=True)

        self.assertEqual(self.rating(), 0)

    def test_the_bonuses_cost_no_query_more_for_more_riders(self):
        url = f"/api/warbands/{self.warband.id}/summary/"
        HeroItem.objects.create(hero=make_unit(HERO, self.warband), item=self.horse, companion=True)
        few = count_get_queries(self.client, url)
        for _ in range(3):
            HeroItem.objects.create(hero=make_unit(HERO, self.warband), item=self.horse, companion=True)
            group = make_unit(HENCHMEN, self.warband)
            HenchmenGroupItem.objects.create(henchmen_group=group, item=self.pony, companion=True)

        self.assertEqual(count_get_queries(self.client, url), few)
