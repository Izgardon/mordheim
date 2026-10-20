"""The book catalogue's version (PERF-13): what the catalogue lists read without a campaign are cached under."""

import uuid

from django.db import models

BOOK = 1  # the row's id: there is one


class CatalogueVersion(models.Model):
    """A new random value each time a seeder writes the book, in the seeder's transaction (with every campaign's
    `CampaignSettings.catalogue_version`, since campaign lists show the book too; apps/core/catalogue/cache.py). One
    row, created by the migration: a fresh value after a wipe, so a body cached before it can't be served after."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=BOOK)
    version = models.UUIDField(default=uuid.uuid4)

    class Meta:
        db_table = "catalogue_version"
        constraints = [models.CheckConstraint(check=models.Q(id=BOOK), name="catalogue_version_one_row")]

    def __str__(self):
        return f"Book catalogue {self.version}"
