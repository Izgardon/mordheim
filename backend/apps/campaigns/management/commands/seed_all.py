from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Run all seed commands in the correct order"

    def handle(self, *args, **options):
        seed_commands = [
            "seed_races",
            "seed_restrictions",
            "seed_items",
            "seed_skills",
            "seed_spells_and_special",
        ]

        for command in seed_commands:
            self.stdout.write(f"Running {command}...")
            try:
                call_command(command)
                self.stdout.write(self.style.SUCCESS(f"  {command} completed"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  {command} failed: {e}"))
                raise

        self.stdout.write(self.style.SUCCESS("\nAll seed commands completed successfully!"))
