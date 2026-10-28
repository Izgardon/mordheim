"""Seed the book's dramatis personae from `apps/hirelings/data/dramatis-personae.json` (empty until they are scraped;
the shape: apps/hirelings/seeding.py)."""

from apps.hirelings.seeding import DRAMATIS_PERSONAE, SeedCommand


class Command(SeedCommand):
    help = "Seed the book's dramatis personae from JSON data."
    spec = DRAMATIS_PERSONAE
