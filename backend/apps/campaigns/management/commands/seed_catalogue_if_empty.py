"""Load the catalogue when it is empty, so a wiped database reseeds itself on the next start.

Data is disposable during the review (CLAUDE.md), so production may be wiped; gunicorn.conf.py runs this command
before the workers start. It does nothing once any item exists.
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.items.models import Item


class Command(BaseCommand):
    help = "Run seed_all if the catalogue is empty"

    def handle(self, *args, **options):
        if Item.objects.exists():
            self.stdout.write("Catalogue already loaded; nothing to seed.")
            return
        self.stdout.write("Catalogue is empty; running seed_all.")
        call_command("seed_all", stdout=self.stdout)
