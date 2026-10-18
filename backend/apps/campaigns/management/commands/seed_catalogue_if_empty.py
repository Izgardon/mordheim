"""Load the catalogue when it is missing or incomplete, so a wiped database reseeds itself on the next start.

Data is disposable during the review (CLAUDE.md), so production may be wiped; gunicorn.conf.py starts this command
in the background once the server is listening. The bestiary is seeded last and in one transaction, so a catalogue
with bestiary entries is complete; anything else (empty, or a seed cut short by a restart) runs `seed_all` again,
whose commands create what is missing and update the rest. An advisory lock keeps two starting instances from
seeding at once.
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection

from apps.bestiary.models import BestiaryEntry

SEED_LOCK_ID = 5_118_001  # any constant; every instance must use the same one


class Command(BaseCommand):
    help = "Run seed_all if the catalogue is missing or incomplete"

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_try_advisory_lock(%s)", [SEED_LOCK_ID])
            locked = cursor.fetchone()[0]
        if not locked:
            self.stdout.write("Another process is seeding the catalogue; skipping.")
            return
        try:
            if BestiaryEntry.objects.exists():
                self.stdout.write("Catalogue already loaded; nothing to seed.")
                return
            self.stdout.write("Catalogue is missing or incomplete; running seed_all.")
            call_command("seed_all", stdout=self.stdout)
        finally:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_unlock(%s)", [SEED_LOCK_ID])
