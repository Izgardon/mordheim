"""GET warbands/<id>/roster-stats/: the stat lines the campaign overview's roster expand shows (PERF-42).

The expand fetched three unit lists (3 requests, 13 queries); this answers every on-roster unit's stats in one
request of 3 queries, whatever the warband's size.
"""

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from .roster_support import HENCHMEN, HERO, HIRELING, RosterTestCase, make_unit


class RosterStatsTests(RosterTestCase):
    def url(self, warband=None) -> str:
        return f"/api/warbands/{(warband or self.warband).id}/roster-stats/"

    def stats(self, user=None):
        self.client.force_authenticate(user=user or self.viewer)
        return self.client.get(self.url())

    def test_every_member_reads_the_stat_lines_of_the_units_on_the_roster(self):
        captain = make_unit(HERO, self.warband, name="Captain", movement=4, weapon_skill=4, armour_save=5)
        make_unit(HERO, self.warband, name="Fallen", dead=True)
        make_unit(HERO, self.warband, name="Gone", dismissed_at=timezone.now())
        group = make_unit(HENCHMEN, self.warband, name="Swordsmen", strength=3)
        ogre = make_unit(HIRELING, self.warband, name="Ogre", wounds=3, unit_type="Ogre Bodyguard")

        response = self.stats()

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual([[row["name"] for row in data[kind]] for kind in data], [["Captain"], ["Swordsmen"], ["Ogre"]])
        hero = data["heroes"][0]
        self.assertEqual(
            (hero["id"], hero["movement"], hero["weapon_skill"], hero["armour_save"]), (captain.id, 4, 4, 5)
        )
        self.assertEqual((data["henchmen_groups"][0]["id"], data["henchmen_groups"][0]["strength"]), (group.id, 3))
        self.assertEqual(
            {key: data["hirelings"][0][key] for key in ("id", "unit_type", "wounds")},
            {"id": ogre.id, "unit_type": "Ogre Bodyguard", "wounds": 3},
        )
        expected = {"id", "name", "unit_type", "armour_save", "movement", "weapon_skill", "ballistic_skill"}
        self.assertLessEqual(expected, set(hero))

    def test_outsiders_get_404(self):
        self.assertEqual(self.stats(self.outsider).status_code, 404)
        self.client.force_authenticate(user=self.viewer)
        self.assertEqual(self.client.get("/api/warbands/999999/roster-stats/").status_code, 404)

    def test_three_queries_whatever_the_warbands_size(self):
        def count() -> int:
            with CaptureQueriesContext(connection) as captured:
                self.assertEqual(self.stats().status_code, 200)
            return len(captured)

        for kind in (HERO, HENCHMEN, HIRELING):
            make_unit(kind, self.warband)
        small = count()
        for kind in (HERO, HENCHMEN, HIRELING) * 4:
            make_unit(kind, self.warband)

        self.assertEqual((small, count()), (3, 3))  # the warband, the membership, the units (target <= 4)
