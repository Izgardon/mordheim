"""Search everything's campaign half (next step 7a): `GET campaigns/<id>/search/?q=` finds this campaign's warbands
and the units on their rosters by name, in a fixed number of queries."""

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.warbands.models import Henchman, HenchmenGroup, Hero, Hireling, Warband

from .campaign_support import CampaignTestCase


class CampaignSearchTests(CampaignTestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        super().setUpTestData()
        Hero.objects.create(warband=cls.warband, name="Abbess Grete", unit_type="Matriarch")
        Hero.objects.create(warband=cls.warband, name="Sister Grete", unit_type="Augur", dead=True)
        Hero.objects.create(warband=cls.rival_warband, name="Grey Seer", unit_type="Seer")
        group = HenchmenGroup.objects.create(warband=cls.rival_warband, name="Gutter runners", unit_type="Verminkin")
        Henchman.objects.create(group=group, name="Skritch")
        Henchman.objects.create(group=group, name="Gretchik", dismissed_at=timezone.now())
        Hireling.objects.create(warband=cls.warband, name="", unit_type="Ogre Bodyguard")
        other = Warband.objects.create(campaign=cls.elsewhere, user=cls.outsider, name="Grete's own")
        Hero.objects.create(warband=other, name="Grete Elsewhere", unit_type="Witch")

    def search(self, query: str):
        response = self.get_as(self.player, self.url(f"search/?q={query}"))
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_finds_warbands_by_name_or_type_and_units_on_a_roster_by_name_or_type(self):
        found = self.search("grete")
        self.assertEqual(found["warbands"], [])
        self.assertEqual(
            [(unit["kind"], unit["name"], unit["warband_name"]) for unit in found["units"]],
            [("hero", "Abbess Grete", "Monks")],  # not the dead sister, nor another campaign's witch
        )
        self.assertEqual([band["name"] for band in self.search("mercen")["warbands"]], ["Monks", "Rats"])
        ogre = self.search("ogre")["units"]
        self.assertEqual([(unit["kind"], unit["unit_type"]) for unit in ogre], [("hireling", "Ogre Bodyguard")])

    def test_a_group_is_found_by_a_member_still_in_it(self):
        self.assertEqual([unit["name"] for unit in self.search("skritch")["units"]], ["Gutter runners"])
        self.assertEqual(self.search("gretchik")["units"], [])

    def test_a_short_search_finds_nothing_and_asks_nothing(self):
        self.assertEqual(self.search("g"), {"warbands": [], "units": []})

    def test_the_query_count_is_fixed(self):
        self.client.force_authenticate(user=self.player)
        with CaptureQueriesContext(connection) as before:
            self.client.get(self.url("search/?q=gr"))
        for index in range(5):
            Hero.objects.create(warband=self.rival_warband, name=f"Grunt {index}", unit_type="Clanrat")
        with CaptureQueriesContext(connection) as after:
            self.client.get(self.url("search/?q=gr"))
        self.assertEqual(len(after), len(before))
