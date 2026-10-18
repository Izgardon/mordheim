"""seed_catalogue_if_empty seeds an empty catalogue and leaves a loaded one alone (gunicorn runs it on start)."""

from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import TestCase

from apps.items.models import Item

COMMAND = "apps.campaigns.management.commands.seed_catalogue_if_empty.call_command"


class SeedCatalogueIfEmptyTests(TestCase):
    def test_an_empty_catalogue_runs_seed_all(self):
        with mock.patch(COMMAND) as seed:
            call_command("seed_catalogue_if_empty", stdout=StringIO())

        seed.assert_called_once()
        self.assertEqual(seed.call_args.args, ("seed_all",))

    def test_a_loaded_catalogue_is_left_alone(self):
        Item.objects.create(name="Club", type="Melee")

        with mock.patch(COMMAND) as seed:
            call_command("seed_catalogue_if_empty", stdout=StringIO())

        seed.assert_not_called()
