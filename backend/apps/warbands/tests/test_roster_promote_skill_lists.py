"""Lad's Got Talent picks two skill lists (William, 27 Nov 2026: "When a henchman gets lads got talent they can choose 2
skills lists out of the skill lists the current heroes in their warband have taken").

GET .../henchmen-groups/<id>/promote/ offers the lists the warband's living heroes on the roster hold (not its hired
swords'), and the promotion's `skill_lists` become the new hero's `available_skills`. A choice outside the offer, or
other than two (fewer when the heroes hold fewer), warns and saves; only a malformed choice is refused.
"""

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.warbands.models import Hero

from .roster_support import HENCHMEN, HERO, HIRELING, RosterTestCase, make_unit, unit_url


class TalentSkillListsTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = make_unit(HENCHMEN, self.warband, name="Zealots", level_up=1, members=("Alpha", "Beta"))
        self.alpha = self.group.henchmen.order_by("id").first()

    def _url(self) -> str:
        return unit_url(HENCHMEN, self.warband.id, self.group.id, "promote/")

    def _promote(self, **body: Any) -> Any:
        return self.client.post(self._url(), {"henchman_id": self.alpha.id, **body}, format="json")

    def _heroes(self) -> None:
        make_unit(HERO, self.warband, name="Captain", is_leader=True, available_skills=["Combat", "Academic"])
        make_unit(HERO, self.warband, name="Champion", available_skills=["combat", "Strength"])
        make_unit(HERO, self.warband, name="Fallen", dead=True, available_skills=["Shooting"])
        make_unit(HERO, self.warband, name="Gone", dismissed_at="2026-01-01T00:00:00Z", available_skills=["Speed"])
        make_unit(HERO, self.rival, name="Rival", available_skills=["Rival lore"])
        make_unit(HIRELING, self.warband, name="Ogre", available_skills=["Ogre lore"])

    def test_the_offer_is_the_living_heroes_lists_once_each_leader_first(self):
        make_unit(HERO, self.warband, name="Youngblood", available_skills={"Sp": True, "Spc": True})  # the old form
        self._heroes()

        response = self.client.get(self._url())

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.json(), {"skill_lists": ["Combat", "Academic", "Speed", "Strength"], "pick": 2})

    def test_the_offer_reads_in_a_fixed_number_of_queries(self):
        self._heroes()
        with CaptureQueriesContext(connection) as first:
            self.client.get(self._url())
        for index in range(4):
            make_unit(HERO, self.warband, name=f"Extra {index}", available_skills=["Combat", f"Lore {index}"])
        with self.assertNumQueries(len(first)):
            self.client.get(self._url())

    def test_the_new_hero_takes_the_two_lists_chosen(self):
        self._heroes()

        response = self._promote(skill_lists=["Academic", "Strength"])

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.json()["warnings"], [])
        hero = Hero.objects.get(id=response.json()["hero"]["id"])
        self.assertEqual(hero.available_skills, ["Academic", "Strength"])
        self.assertEqual(response.json()["hero"]["available_skills"], ["Academic", "Strength"])

    def test_with_fewer_than_two_on_offer_he_takes_what_there_is(self):
        make_unit(HERO, self.warband, name="Captain", available_skills=["Combat"])

        offer = self.client.get(self._url()).json()
        response = self._promote(skill_lists=["Combat"])

        self.assertEqual(offer, {"skill_lists": ["Combat"], "pick": 1})
        self.assertEqual((response.status_code, response.json()["warnings"]), (201, []))
        self.assertEqual(Hero.objects.get(id=response.json()["hero"]["id"]).available_skills, ["Combat"])

    def test_with_no_heroes_there_is_nothing_to_choose_and_nothing_to_warn_of(self):
        response = self._promote()

        self.assertEqual((response.status_code, response.json()["warnings"]), (201, []))
        self.assertEqual(Hero.objects.get(id=response.json()["hero"]["id"]).available_skills, [])

    def test_a_choice_outside_the_offer_or_short_of_two_warns_and_saves(self):
        self._heroes()

        outside = self._promote(skill_lists=["Combat", "Ogre lore"])
        self.group.refresh_from_db()
        self.group.level_up_history = []
        self.group.level_up = 1
        self.group.save()
        self.alpha = self.group.henchmen.filter(dismissed_at__isnull=True).first()
        short = self._promote(skill_lists=["Combat"])

        self.assertEqual(outside.status_code, 201, outside.data)
        self.assertEqual(
            outside.json()["warnings"],
            [{"code": "skill_list_not_offered", "message": "None of the warband's heroes has Ogre lore."}],
        )
        self.assertEqual(Hero.objects.get(id=outside.json()["hero"]["id"]).available_skills, ["Combat", "Ogre lore"])
        self.assertEqual(short.status_code, 201, short.data)
        self.assertEqual(
            short.json()["warnings"],
            [{"code": "skill_list_count", "message": "The lad's got talent picks two skill lists; one was picked."}],
        )

    def test_a_malformed_choice_is_refused_and_changes_nothing(self):
        self._heroes()
        for lists in (["Combat", "combat"], ["Combat", ""], "Combat", ["A", "B", "C", "D", "E", "F", "G", "H", "I"]):
            with self.subTest(lists=lists):
                response = self._promote(skill_lists=lists)
                self.assertEqual(response.status_code, 400)
                self.assertEqual([field.split(".")[0] for field in response.json()["fields"]], ["skill_lists"])
        self.assertFalse(Hero.objects.filter(warband=self.warband, name="Alpha").exists())

    def test_a_viewer_reads_the_offer_and_an_outsider_does_not(self):
        self.client.force_authenticate(user=self.viewer)
        self.assertEqual(self.client.get(self._url()).status_code, 200)
        self.client.force_authenticate(user=self.outsider)
        self.assertEqual(self.client.get(self._url()).status_code, 404)
