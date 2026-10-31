"""Seed the book's dramatis personae from the catalogue import's `out/dramatis-personae.json` (mordheimer's 30, made seed
rows by catalogue_import/personae.py; the shape: apps/hirelings/seeding.py)."""

from apps.hirelings.seeding import DRAMATIS_PERSONAE, SeedCommand


class Command(SeedCommand):
    help = "Seed the book's dramatis personae from JSON data."
    spec = DRAMATIS_PERSONAE
