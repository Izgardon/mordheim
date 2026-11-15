"""`seed_e2e`: the end-to-end suite's campaign built through the API on an empty database, the states it promises
the suite (a warband at its starting gold, a player with none, a battle parked at each stage), the fixture it emits
and the guard it shares with seed_demo_campaign."""

import json
import tempfile
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from apps.battles.models import Battle
from apps.campaigns.e2e_seed.cast import CAMPAIGN_NAME, JOIN_CODE, PASSWORD, PLAYERS
from apps.campaigns.models import Campaign, CampaignMembership
from apps.warbands.models import HenchmenGroup, Hero, Warband, WarbandItem


def seed(**options) -> str:
    """Run the command with DEBUG on (tests run with it off) and return what it and seed_all printed."""
    output = StringIO()
    with override_settings(DEBUG=True), redirect_stdout(output):
        call_command("seed_e2e", stdout=output, force_local=True, **options)
    return output.getvalue()


def campaign() -> Campaign:
    return Campaign.objects.get(name=CAMPAIGN_NAME)


class SeedE2ETests(TestCase):
    output: str

    @classmethod
    def setUpTestData(cls) -> None:
        cls.output = seed()

    def test_it_builds_the_campaign_its_six_players_and_five_warbands(self):
        self.assertNotIn("Not in the catalogue", self.output)
        self.assertEqual(campaign().join_code, JOIN_CODE)
        self.assertTrue(campaign().in_progress)
        members = CampaignMembership.objects.filter(campaign=campaign())
        self.assertEqual(members.count(), len(PLAYERS))
        self.assertEqual(members.get(role__slug="owner").user.username, PLAYERS["owner"][0])
        self.assertEqual(Warband.objects.filter(campaign=campaign()).count(), 5)
        for email, _name in PLAYERS.values():
            self.assertTrue(get_user_model().objects.get(username=email).check_password(PASSWORD), email)

    def test_the_owners_warband_has_heroes_groups_a_hired_sword_and_a_stash(self):
        warband = Warband.objects.get(campaign=campaign(), name="Steel Vigil")
        self.assertEqual(Hero.objects.filter(warband=warband, dead=False).count(), 3)
        self.assertEqual(HenchmenGroup.objects.filter(warband=warband).count(), 2)
        self.assertEqual(warband.hirelings.count(), 1)
        self.assertTrue(WarbandItem.objects.filter(warband=warband).exists())  # the stash
        self.assertFalse(Hero.objects.filter(warband__campaign=campaign(), fighter_key="").exists())

    def test_one_player_has_an_untouched_warband_and_one_has_none(self):
        """What the recruit and the raise tests stand on: a warband at its template's starting gold with nothing in
        it, and a member who can raise one."""
        fresh = Warband.objects.get(campaign=campaign(), name="Pale Lanterns")
        self.assertEqual(fresh.gold, 500)
        self.assertEqual((fresh.heroes.count(), fresh.henchmen_groups.count()), (0, 0))
        newcomer = get_user_model().objects.get(username=PLAYERS["newcomer"][0])
        self.assertFalse(Warband.objects.filter(campaign=campaign(), user=newcomer).exists())

    def test_a_battle_is_parked_at_each_stage_and_nobody_died(self):
        battles = Battle.objects.filter(campaign=campaign())
        self.assertEqual(battles.filter(status=Battle.STATUS_ENDED).count(), 2)
        self.assertEqual(battles.filter(status=Battle.STATUS_PREBATTLE).count(), 1)
        self.assertEqual(battles.filter(status=Battle.STATUS_ACTIVE).count(), 1)
        self.assertEqual(battles.filter(status=Battle.STATUS_POSTBATTLE).count(), 1)
        self.assertEqual(battles.count(), 5)
        self.assertFalse(Hero.objects.filter(warband__campaign=campaign(), dead=True).exists())

    def test_it_emits_the_ids_the_suite_navigates_to(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "nested" / "seed.json"
            seed(emit=str(path))
            facts = json.loads(path.read_text())
        self.assertEqual(facts["campaign"]["join_code"], JOIN_CODE)
        self.assertEqual(facts["password"], PASSWORD)
        self.assertEqual(facts["fresh_gold"], 500)
        self.assertEqual(sorted(facts["battles"]), ["active", "ended_first", "ended_second", "postbattle", "prebattle"])
        self.assertIsNone(facts["users"]["newcomer"]["warband_id"])
        self.assertEqual(facts["users"]["owner"]["email"], PLAYERS["owner"][0])
        for stage, battle_id in facts["battles"].items():
            self.assertTrue(Battle.objects.filter(id=battle_id).exists(), stage)

    def test_running_it_again_rebuilds_it_and_keeps_the_join_code(self):
        old_id = campaign().id
        output = seed()
        self.assertIn("Removed the earlier e2e campaign (1).", output)
        self.assertFalse(Campaign.objects.filter(id=old_id).exists())
        self.assertEqual(campaign().join_code, JOIN_CODE)
        self.assertEqual(get_user_model().objects.filter(username__in=[e for e, _ in PLAYERS.values()]).count(), 6)


class GuardTests(TestCase):
    def test_it_refuses_with_debug_off(self):
        with self.assertRaisesMessage(CommandError, "seed_e2e only runs with DEBUG on"):
            call_command("seed_e2e", stdout=StringIO())  # tests run with DEBUG off
        self.assertFalse(Campaign.objects.exists())

    @override_settings(DEBUG=True)
    def test_it_refuses_a_database_that_isnt_local_unless_told_it_is(self):
        from unittest import mock

        from django.db import connection

        with mock.patch.dict(connection.settings_dict, {"HOST": "ep-quiet-sun-123456.eu-west-2.aws.neon.tech"}):
            with self.assertRaisesMessage(CommandError, "seed_e2e only runs against a local database"):
                call_command("seed_e2e", stdout=StringIO())
        self.assertFalse(Campaign.objects.exists())
