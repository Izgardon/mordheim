"""seed_catalogue_if_empty seeds a missing or incomplete catalogue and leaves a complete one alone (gunicorn starts it
in the background once the server is listening)."""

from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import TestCase

from apps.campaigns.management.commands.seed_catalogue_if_empty import SEED_LOCK_ID
from apps.campaigns.models import Campaign
from apps.hirelings.models import HiredSword
from apps.items.models import Item

MODULE = "apps.campaigns.management.commands.seed_catalogue_if_empty"
COMMAND = f"{MODULE}.call_command"


def run() -> mock.MagicMock:
    with mock.patch(COMMAND) as seed:
        call_command("seed_catalogue_if_empty", stdout=StringIO())
    return seed


class SeedCatalogueIfEmptyTests(TestCase):
    def _campaign(self) -> Campaign:
        return Campaign.objects.create(name="Shards", join_code="SHARDS")

    def test_an_empty_catalogue_runs_seed_all(self):
        seed = run()

        seed.assert_called_once()
        self.assertEqual(seed.call_args.args, ("seed_all",))

    def test_a_seed_cut_short_before_the_hired_swords_runs_again(self):
        Item.objects.create(name="Club", type="Melee")  # earlier steps landed, the hired swords (last) did not
        HiredSword.objects.create(name="Duellist", campaign=self._campaign())  # a campaign's is not the book's

        run().assert_called_once()

    def test_a_complete_catalogue_is_left_alone(self):
        HiredSword.objects.create(name="Ogre Bodyguard")

        run().assert_not_called()

    def test_it_skips_while_another_process_holds_the_seed_lock(self):
        # Advisory locks are re-entrant within one session, so the other process's hold is simulated.
        with mock.patch(f"{MODULE}.connection.cursor") as cursor:
            cursor.return_value.__enter__.return_value.fetchone.return_value = (False,)
            seed = run()

        seed.assert_not_called()
        executed = [call.args for call in cursor.return_value.__enter__.return_value.execute.call_args_list]
        self.assertEqual(executed, [("SELECT pg_try_advisory_lock(%s)", [SEED_LOCK_ID])])
