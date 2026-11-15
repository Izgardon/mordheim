"""The campaign the end-to-end tests run against: `manage.py seed_e2e` (apps/campaigns/e2e_seed/).

Deterministic and built from scratch every run, so a suite can be run again without cleaning up after itself. Its
users' password is in the repository, so it refuses to run unless DEBUG is on and the database is local, exactly as
seed_demo_campaign does. It is never called from seed_all, seed_catalogue_if_empty or the server's start.
"""

import json
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.campaigns.demo.api import quiet
from apps.campaigns.demo.catalogue import catalogue_loaded
from apps.campaigns.demo.guard import check_local
from apps.campaigns.e2e_seed.build import build
from apps.campaigns.e2e_seed.cast import CAMPAIGN_NAME, JOIN_CODE, OWNER_EMAIL


class Command(BaseCommand):
    help = "Build the e2e campaign 'E2E Shards' (local dev only; the passwords are in apps/campaigns/e2e_seed/)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force-local",
            action="store_true",
            help="Run against a database host other than db, localhost or 127.0.0.1 that is still local.",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Accepted and ignored: every run already deletes the campaign the last one left and builds it again.",
        )
        parser.add_argument(
            "--emit",
            metavar="PATH",
            help="Write the suite's fixture (credentials, campaign, warband and battle ids) to this file as JSON.",
        )

    def handle(self, *args, **options):
        check_local(force_local=options["force_local"], command="seed_e2e")
        if not catalogue_loaded():
            self.stdout.write("The catalogue is empty: running seed_all first.")
            call_command("seed_all", stdout=self.stdout)
        with quiet():
            built = build()
        if built.removed:
            self.stdout.write(f"Removed the earlier e2e campaign ({built.removed}).")
        for entry in built.missing:
            self.stdout.write(f"Not in the catalogue, left out: {entry}")
        if options["emit"]:
            path = Path(options["emit"])
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(built.facts(), indent=2) + "\n")
            self.stdout.write(f"Fixture written to {path}.")
        stages = ", ".join(f"{stage} {battle_id}" for stage, battle_id in built.battles.items())
        self.stdout.write(
            self.style.SUCCESS(
                f"{CAMPAIGN_NAME} is ready (campaign {built.campaign_id}, join code {JOIN_CODE}; battles: {stages})."
                f" Sign in as {OWNER_EMAIL}."
            )
        )
