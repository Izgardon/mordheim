"""Write the pivotal moments of ended battles again (next step 9): for dev data, or after the moment rules change.

Idempotent: each battle's moments are replaced, in one transaction per battle, by what its kills and its fight's
out-of-action data give now, so running it twice leaves the same moments. `--campaign` or `--battle` narrows it.
"""

from django.core.management.base import BaseCommand

from apps.battles.models import Battle
from apps.campaigns.pivotal_moments import regenerate_pivotal_moments


class Command(BaseCommand):
    help = "Write the pivotal moments of every ended battle again (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument("--campaign", type=int, help="Only this campaign's battles.")
        parser.add_argument("--battle", type=int, help="Only this battle.")

    def handle(self, *args, campaign: int | None = None, battle: int | None = None, **options):
        battles = Battle.objects.filter(status=Battle.STATUS_ENDED, flow_type=Battle.FLOW_TYPE_NORMAL)
        if campaign is not None:
            battles = battles.filter(campaign_id=campaign)
        if battle is not None:
            battles = battles.filter(id=battle)
        count = moments = 0
        for ended in battles.order_by("id"):
            moments += regenerate_pivotal_moments(ended)
            count += 1
        self.stdout.write(f"Wrote {moments} pivotal moments for {count} ended battles.")
