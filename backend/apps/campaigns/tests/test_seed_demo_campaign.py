"""`seed_demo_campaign`: the demo campaign built through the API on an empty database (it seeds the catalogue
first), the demo users' password, re-running it, and the guard that keeps it to DEBUG and a local database."""

from contextlib import redirect_stdout
from io import StringIO
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.db.models import Sum
from django.test import TestCase, override_settings

from apps.battles.models import Battle, BattleKill
from apps.bounties.models import Bounty
from apps.campaigns.demo.cast import CAMPAIGN_NAME, CAPTAIN_EMAIL, EMAIL_DOMAIN, PASSWORD
from apps.campaigns.demo.guard import check_local, remote_password
from apps.campaigns.models import Campaign, CampaignMembership, PivotalMoment
from apps.trades.models import TradeRequest
from apps.warbands.models import Hero, Warband, WarbandLog, WarbandTrade

NEON_HOST = "ep-quiet-sun-123456.eu-west-2.aws.neon.tech"


def seed(**options) -> str:
    """Run the command with DEBUG on (tests run with it off) and return what it and seed_all printed."""
    output = StringIO()
    with override_settings(DEBUG=True), redirect_stdout(output):
        call_command("seed_demo_campaign", stdout=output, force_local=True, **options)
    return output.getvalue()


def demo_campaign() -> Campaign:
    return Campaign.objects.get(name=CAMPAIGN_NAME)


class SeedDemoCampaignTests(TestCase):
    output: str

    @classmethod
    def setUpTestData(cls) -> None:
        cls.output = seed()

    def test_it_builds_the_campaign_with_four_players_four_warbands_and_seven_battles_played(self):
        campaign = demo_campaign()
        self.assertIn(f"Sign in as {CAPTAIN_EMAIL} with the password 'password'", self.output)
        self.assertNotIn("Not in the catalogue", self.output)
        self.assertNotIn("Advance not taken", self.output)
        members = CampaignMembership.objects.filter(campaign=campaign)
        self.assertEqual(members.count(), 4)
        self.assertEqual(members.get(role__slug="owner").user.username, CAPTAIN_EMAIL)
        self.assertEqual(Warband.objects.filter(campaign=campaign).count(), 4)
        battles = Battle.objects.filter(campaign=campaign)
        self.assertEqual(battles.filter(status=Battle.STATUS_ENDED).count(), 7)
        self.assertEqual(battles.exclude(status=Battle.STATUS_ENDED).count(), 0)  # every warband Ready
        self.assertEqual(battles.filter(flow_type=Battle.FLOW_TYPE_REPORTED_RESULT).count(), 1)

    def test_every_demo_user_signs_in_with_password(self):
        users = get_user_model().objects.filter(username__endswith=EMAIL_DOMAIN)
        self.assertEqual(users.count(), 4)
        for user in users:
            self.assertTrue(user.check_password(PASSWORD), user.username)

    def test_the_season_left_its_marks(self):
        campaign = demo_campaign()
        heroes = Hero.objects.filter(warband__campaign=campaign)
        self.assertEqual(heroes.filter(dead=True).count(), 1)
        self.assertEqual(heroes.filter(pending_skills=1).count(), 1)  # a Skill to choose
        self.assertTrue(BattleKill.objects.filter(campaign_id=campaign.id, killer_kind="henchman").exists())
        self.assertTrue(BattleKill.objects.filter(campaign_id=campaign.id, victim_kind="creature").exists())
        kinds = set(PivotalMoment.objects.filter(campaign=campaign).values_list("kind", flat=True))
        self.assertTrue({"first_blood", "hero_slayer", "bounty_claimed"} <= kinds, kinds)
        self.assertEqual(
            sorted(Bounty.objects.filter(campaign=campaign).values_list("status", flat=True)), ["open", "paid"]
        )
        self.assertEqual(TradeRequest.objects.get(campaign=campaign).status, TradeRequest.STATUS_COMPLETED)
        advances = WarbandLog.objects.filter(warband__campaign=campaign, feature="advance")
        self.assertTrue(advances.exists())
        for entry in advances:  # labelled as the Aftermath labels them: the Log shows the label
            self.assertTrue(entry.payload["advance"]["label"], entry.payload)
        for warband in Warband.objects.filter(campaign=campaign):  # the stored gold is the ledger's sum
            ledger = WarbandTrade.objects.filter(warband=warband).aggregate(total=Sum("price"))["total"]
            self.assertEqual(warband.gold, ledger, warband.name)

    def test_running_it_again_rebuilds_it_and_touches_nothing_else(self):
        old_id = demo_campaign().id
        other_user = get_user_model().objects.create_user(username="someone@example.com", password="secret-words")
        other = Campaign.objects.create(name=CAMPAIGN_NAME, join_code="OTHER1")  # same name, not the captain's

        output = seed(with_open_battle=True)

        self.assertIn("Removed the earlier demo campaign (1).", output)
        self.assertFalse(Campaign.objects.filter(id=old_id).exists())
        self.assertTrue(Campaign.objects.filter(id=other.id).exists())
        self.assertTrue(get_user_model().objects.get(id=other_user.id).check_password("secret-words"))
        rebuilt = Campaign.objects.exclude(id=other.id).get(name=CAMPAIGN_NAME)
        battles = Battle.objects.filter(campaign=rebuilt)
        self.assertEqual(battles.filter(status=Battle.STATUS_ENDED).count(), 7)
        self.assertEqual(battles.filter(status=Battle.STATUS_PREBATTLE).count(), 1)  # --with-open-battle
        self.assertEqual(get_user_model().objects.filter(username__endswith=EMAIL_DOMAIN).count(), 4)


class GuardTests(TestCase):
    def test_it_refuses_with_debug_off(self):
        with self.assertRaisesMessage(CommandError, "only runs with DEBUG on"):
            call_command("seed_demo_campaign", stdout=StringIO())  # tests run with DEBUG off
        self.assertFalse(Campaign.objects.exists())

    @override_settings(DEBUG=True)
    def test_it_refuses_a_database_that_isnt_local_unless_told_it_is(self):
        with mock.patch.dict(connection.settings_dict, {"HOST": NEON_HOST}):
            with self.assertRaisesMessage(CommandError, "only runs against a local database"):
                call_command("seed_demo_campaign", stdout=StringIO())
            check_local(force_local=True)  # --force-local: the caller vouches for it
        self.assertFalse(Campaign.objects.exists())

    @override_settings(DEBUG=True)
    def test_the_docker_hosts_are_local(self):
        for host in ("db", "localhost", "127.0.0.1"):
            with mock.patch.dict(connection.settings_dict, {"HOST": host}):
                check_local()

    def test_remote_needs_a_demo_password_of_its_own(self):
        for password in ("", "short", PASSWORD):
            with self.subTest(password=password), mock.patch.dict("os.environ", {"DEMO_PASSWORD": password}):
                with self.assertRaisesMessage(CommandError, "--remote needs DEMO_PASSWORD"):
                    call_command("seed_demo_campaign", remote=True, stdout=StringIO())
        with mock.patch.dict("os.environ", {"DEMO_PASSWORD": "long enough secret"}):
            self.assertEqual(remote_password(), "long enough secret")
        self.assertFalse(Campaign.objects.exists())


class RemoteSeedTests(TestCase):
    def test_remote_seeds_any_database_with_the_demo_password_and_never_prints_it(self):
        output = StringIO()
        with (
            mock.patch.dict("os.environ", {"DEMO_PASSWORD": "long enough secret"}),
            mock.patch.dict(connection.settings_dict, {"HOST": NEON_HOST}),
            redirect_stdout(output),
        ):
            call_command("seed_demo_campaign", remote=True, stdout=output)  # with DEBUG off, as tests run

        captain = get_user_model().objects.get(username=CAPTAIN_EMAIL)
        self.assertTrue(captain.check_password("long enough secret"))
        self.assertFalse(captain.check_password(PASSWORD))
        self.assertIn("with the password in DEMO_PASSWORD", output.getvalue())
        self.assertNotIn("long enough secret", output.getvalue())
        self.assertTrue(Campaign.objects.filter(name=CAMPAIGN_NAME).exists())
