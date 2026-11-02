"""A fully played demo campaign for local dev: `manage.py seed_demo_campaign` (apps/campaigns/demo/).

Every demo user's password is "password", so it refuses to run unless DEBUG is on and the database is a local docker
host. Never call it from seed_all, seed_catalogue_if_empty or the server's start. Each run removes the demo campaign an
earlier run made and builds it again.
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.campaigns.demo.api import quiet
from apps.campaigns.demo.build import build
from apps.campaigns.demo.cast import CAMPAIGN_NAME, CAPTAIN_EMAIL, PASSWORD, PLAYERS
from apps.campaigns.demo.catalogue import catalogue_loaded
from apps.campaigns.demo.guard import check_local


class Command(BaseCommand):
    help = "Build the demo campaign 'The Shattered Crown' (local dev only; every password is 'password')."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force-local",
            action="store_true",
            help="Run against a database host other than db, localhost or 127.0.0.1 that is still local.",
        )
        parser.add_argument(
            "--with-open-battle",
            action="store_true",
            help="Also leave one battle in pre-battle, to try the battle screen with.",
        )

    def handle(self, *args, **options):
        check_local(force_local=options["force_local"])
        if not catalogue_loaded():
            self.stdout.write("The catalogue is empty: running seed_all first.")
            call_command("seed_all", stdout=self.stdout)
        with quiet():
            built = build(with_open_battle=options["with_open_battle"])
        if built.removed:
            self.stdout.write(f"Removed the earlier demo campaign ({built.removed}).")
        for entry in built.missing:
            self.stdout.write(f"Not in the catalogue, left out: {entry}")
        for note in built.notes:
            self.stdout.write(f"Advance not taken: {note}")
        if built.open_battle_id:
            self.stdout.write(f"Battle {built.open_battle_id} is waiting in pre-battle.")
        others = ", ".join(email for email, _name in PLAYERS.values() if email != CAPTAIN_EMAIL)
        self.stdout.write(
            self.style.SUCCESS(
                f"{CAMPAIGN_NAME} is ready (campaign {built.campaign_id}, {built.battles_ended} battles played)."
                f" Sign in as {CAPTAIN_EMAIL} with the password '{PASSWORD}' (also {others})."
            )
        )
