"""POST warbands/<id>/location-visits/ (William, 23 Nov 2026): a warband sends heroes to one of the campaign's
locations. Nothing is refused for game reasons: the hero count and a spent trading action warn; the visit spends the
trading actions it takes and writes one log line."""

from typing import Any

from django.utils import timezone

from apps.campaigns.models import CampaignLocation, CampaignLocationGroup
from apps.warbands.models import Hero
from apps.warbands.services.location_visits import HERO_COUNT
from apps.warbands.services.trading_action import TRADING_ACTION_SPENT

from .roster_support import HERO, RosterTestCase, log_rows, make_unit

VISIT_QUERIES = 8  # the warband, the membership, the location, its heroes locked, the update, the log, a savepoint


class LocationVisitTests(RosterTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.campaign_settings.enable_locations = True
        self.campaign_settings.save()
        group = CampaignLocationGroup.objects.create(campaign=self.campaign, name="The Undercity")
        self.altar = CampaignLocation.objects.create(
            campaign=self.campaign, group=group, name="the Altar", min_heroes=1, max_heroes=1, takes_trading_action=True
        )
        self.bog = CampaignLocation.objects.create(
            campaign=self.campaign, group=group, name="the Bog", min_heroes=2, max_heroes=None
        )
        self.aldric = make_unit(HERO, self.warband, name="Aldric", trading_action=True)
        self.bruno = make_unit(HERO, self.warband, name="Bruno", trading_action=False)

    def visit(self, location: CampaignLocation, *heroes: Hero, status: int = 201) -> Any:
        body = {"location_id": location.id, "hero_ids": [hero.id for hero in heroes]}
        response = self.client.post(f"/api/warbands/{self.warband.id}/location-visits/", body, format="json")
        self.assertEqual(response.status_code, status, response.content)
        return response.json()

    def test_a_trading_action_visit_spends_it_and_logs_one_line(self):
        answer = self.visit(self.altar, self.aldric)

        self.assertEqual(answer["heroes"], [{"id": self.aldric.id, "trading_action": False}])
        self.assertEqual((answer["message"], answer["warnings"]), ("Aldric visited the Altar.", []))
        self.assertFalse(Hero.objects.get(id=self.aldric.id).trading_action)
        self.assertEqual(
            log_rows(self.warband),
            [("location", "visit", {"location": "the Altar", "heroes": ["Aldric"], "trading_action": True}, None)],
        )

    def test_too_many_heroes_and_a_spent_action_warn_and_go_ahead(self):
        answer = self.visit(self.altar, self.aldric, self.bruno)

        self.assertEqual(
            [(warning["code"], warning["message"]) for warning in answer["warnings"]],
            [
                (HERO_COUNT, "the Altar is for 1 hero; 2 went."),
                (TRADING_ACTION_SPENT, "Bruno already used their trading action this round."),
            ],
        )
        self.assertEqual(answer["message"], "Aldric and Bruno visited the Altar.")
        self.assertFalse(Hero.objects.filter(warband=self.warband, trading_action=True).exists())

    def test_a_location_without_the_trading_action_leaves_it_alone(self):
        answer = self.visit(self.bog, self.aldric, self.bruno)

        self.assertEqual(answer["warnings"], [])
        self.assertEqual([hero["trading_action"] for hero in answer["heroes"]], [True, False])
        self.assertTrue(Hero.objects.get(id=self.aldric.id).trading_action)

    def test_all_counts_the_heroes_on_the_roster(self):
        self.bog.min_heroes = None
        self.bog.save()
        make_unit(HERO, self.warband, name="Gone", dead=True)

        self.assertEqual(self.visit(self.bog, self.aldric, self.bruno)["warnings"], [])
        warning = self.visit(self.bog, self.aldric)["warnings"][0]["message"]
        self.assertEqual(warning, "the Bog is for all heroes; 1 of 2 went.")

    def test_too_few_heroes_warn(self):
        self.assertEqual(
            self.visit(self.bog, self.aldric)["warnings"],
            [{"code": HERO_COUNT, "message": "the Bog is for 2 to all heroes; 1 went."}],
        )

    def test_the_query_count_does_not_grow_with_the_heroes_sent(self):
        heroes = [make_unit(HERO, self.warband, name=f"Hero {n}", trading_action=True) for n in range(4)]
        with self.assertNumQueries(VISIT_QUERIES):
            self.visit(self.altar, self.aldric)
        with self.assertNumQueries(VISIT_QUERIES):
            self.visit(self.altar, *heroes)

    def test_a_hero_off_the_roster_or_anothers_is_refused_and_nothing_changes(self):
        dead = make_unit(HERO, self.warband, name="Dead", dead=True, trading_action=True)
        theirs = make_unit(HERO, self.rival, name="Theirs", trading_action=True)
        for hero in (dead, theirs):
            with self.subTest(hero.name):
                self.assertEqual(self.visit(self.altar, self.aldric, hero, status=400)["code"], "invalid")
        self.assertTrue(Hero.objects.get(id=self.aldric.id).trading_action)
        self.assertEqual(log_rows(self.warband), [])
        self.visit(self.altar, status=400)  # nobody went

    def test_a_removed_or_foreign_location_and_the_page_switched_off_are_404(self):
        CampaignLocation.objects.filter(id=self.bog.id).update(removed_at=timezone.now())
        self.visit(self.bog, self.aldric, status=404)
        self.campaign_settings.enable_locations = False
        self.campaign_settings.save()
        self.visit(self.altar, self.aldric, status=404)

    def test_only_those_who_may_edit_the_warband_send_its_heroes(self):
        self.client.force_authenticate(user=self.viewer)
        self.visit(self.altar, self.aldric, status=403)
        self.client.force_authenticate(user=self.outsider)
        self.visit(self.altar, self.aldric, status=404)
