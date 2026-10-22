"""Seed the book's hired swords from `apps/hirelings/data/hired-swords.json` (the shape: apps/hirelings/seeding.py)."""

from apps.hirelings.seeding import HIRED_SWORDS, SeedCommand


class Command(SeedCommand):
    help = "Seed the book's hired swords from JSON data."
    spec = HIRED_SWORDS
