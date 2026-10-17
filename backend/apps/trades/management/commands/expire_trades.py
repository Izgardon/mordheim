"""`manage.py expire_trades [--dry-run]`: close the trades that ran out (decision 8, BUG-69).

Meant for a Render Cron Job every 5 minutes (`*/5 * * * *`, command `python manage.py expire_trades`), so that
reading a trade never writes. Each due trade is expired under its row lock: its traders are given back, its
notifications resolved and both players sent `trade_closed`. Safe to run at any time and as often as wanted.
"""

from typing import Any

from django.core.management.base import BaseCommand, CommandParser

from apps.trades.models import TradeRequest
from apps.trades.selectors import due_trades
from apps.trades.services.lifecycle import expire_due_trades


def _describe(trade: TradeRequest) -> str:
    return (
        f"{trade.id} {trade.status} {trade.from_warband.name} -> {trade.to_warband.name}, "
        f"due {trade.expires_at.isoformat()}"
    )


class Command(BaseCommand):
    help = "Expire open trades past their deadline, giving their traders back (run from cron)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--dry-run", action="store_true", help="List the trades that would expire; change nothing.")

    def handle(self, *args: Any, **options: Any) -> None:
        due = list(due_trades())
        if options["dry_run"]:
            self.stdout.write(f"Would expire {len(due)} trade(s).")
            for trade in due:
                self.stdout.write(f"  {_describe(trade)}")
            return
        expired = expire_due_trades([trade.id for trade in due])
        self.stdout.write(f"Expired {len(expired)} trade(s).")
        for trade in expired:
            self.stdout.write(f"  {_describe(trade)}")
