"""manage.py check_gold [--fix]: compare every warband's stored gold with the sum of its ledger (decision 4).

Run it after deploying the ledger migrations, and whenever the header gold looks wrong. It exits with an error
when any warband differs; `--fix` sets those warbands' gold to their ledger sum instead.
"""

from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from apps.warbands.models import Warband
from apps.warbands.services import ledger


class Command(BaseCommand):
    help = "Compare each warband's stored gold with the sum of its ledger rows and report any difference."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--fix", action="store_true", help="Set each differing warband's gold to its ledger sum.")

    def handle(self, *args: Any, **options: Any) -> None:
        checked = Warband.objects.count()
        drift = ledger.gold_drift()
        if not drift:
            self.stdout.write(f"Checked {checked} warbands: every stored gold matches its ledger.")
            return
        for warband_id, name, stored, total in drift:
            self.stdout.write(
                f"Warband {warband_id} ({name}): stored {stored} gc, ledger {total} gc, difference {stored - total} gc"
            )
        if options["fix"]:
            fixed = ledger.reset_gold([warband_id for warband_id, *_rest in drift])
            self.stdout.write(f"Set the gold of {fixed} warbands to their ledger sum.")
            return
        raise CommandError(f"{len(drift)} of {checked} warbands differ from their ledger (run with --fix to reset).")
