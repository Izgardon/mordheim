"""Settle every battle past its deadline now, in every campaign (decision 2).

Optional and manual: nothing needs scheduling, since reading a campaign's battle list (or writing to a battle)
settles what is overdue. `--dry-run` lists what would be settled.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.battles.models import Battle
from apps.battles.services.broadcast import bump_state_version
from apps.battles.services.expiry import expire_locked_battle, publish_expired
from apps.battles.services.timing import TIMED_STATUSES


class Command(BaseCommand):
    help = "Decline unanswered invitations and close postbattles past their 72-hour deadline."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="List the overdue battles without changing them.")

    def handle(self, *args, dry_run: bool = False, **options):
        overdue = Battle.objects.filter(Q(status__in=TIMED_STATUSES), closes_at__lte=timezone.now()).order_by(
            "closes_at"
        )
        settled = 0
        for battle_id, status in overdue.values_list("id", "status"):
            if dry_run:
                self.stdout.write(f"battle {battle_id}: {status}, overdue")
                continue
            with transaction.atomic():
                battle = Battle.objects.select_for_update(skip_locked=True).filter(id=battle_id).first()
                events = expire_locked_battle(battle) if battle else []
                version = bump_state_version(battle) if battle and events else 0
            if battle and events:
                publish_expired(battle, events, version)
                settled += 1
                self.stdout.write(f"battle {battle_id}: {status} settled ({battle.status})")
        self.stdout.write(f"{settled} battle(s) settled" if not dry_run else "dry run: nothing changed")
