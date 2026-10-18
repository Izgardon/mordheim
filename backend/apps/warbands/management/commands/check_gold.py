"""manage.py check_gold [--fix]: compare every warband's stored gold with the sum of its ledger (decision 4).

Run it after deploying the ledger migrations, and whenever the header gold looks wrong. It exits with an error
when any warband differs, or when rows carry an action name outside the vocabulary (written by the previous
release while this one deployed). `--fix` renames and signs those rows as the migrations did, then sets each
differing warband's gold to its ledger sum.
"""

from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from apps.warbands.models import LedgerAction, Warband, WarbandTrade
from apps.warbands.services import ledger
from apps.warbands.services.ledger_names import normalise_legacy_rows


class Command(BaseCommand):
    help = "Compare each warband's stored gold with the sum of its ledger rows and report any difference."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--fix",
            action="store_true",
            help="Rename old-named rows and set each differing warband's gold to its ledger sum.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        if options["fix"]:
            renamed = normalise_legacy_rows()
            if renamed:
                self.stdout.write(f"Renamed and signed {renamed} rows with an old action name.")
        legacy = WarbandTrade.objects.exclude(action__in=LedgerAction.values).count()
        checked = Warband.objects.count()
        drift = ledger.gold_drift()
        if not drift and not legacy:
            self.stdout.write(f"Checked {checked} warbands: every stored gold matches its ledger.")
            return
        if legacy:
            self.stdout.write(f"{legacy} ledger rows have an action name outside the vocabulary.")
        for warband_id, name, stored, total in drift:
            self.stdout.write(
                f"Warband {warband_id} ({name}): stored {stored} gc, ledger {total} gc, difference {stored - total} gc"
            )
        if options["fix"]:
            fixed = ledger.reset_gold([warband_id for warband_id, *_rest in drift])
            self.stdout.write(f"Set the gold of {fixed} warbands to their ledger sum.")
            return
        problems = f"{len(drift)} of {checked} warbands differ from their ledger" + (
            f" and {legacy} rows have an old action name" if legacy else ""
        )
        raise CommandError(f"{problems} (run with --fix to repair).")
