"""The catalogue's shared tables: the book's version (PERF-13), the columns every entry table carries for versions,
archiving and badges (CAT-TWEAK-01, -04, CAT-NEW-03), and the two campaign records a book entry can have
(CAT-NEW-05's removals, and the versions a campaign reverted)."""

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

BOOK = 1  # the row's id: there is one

# The tables whose entries a campaign versions, archives or removes, by the catalogue kind that owns each (a hired
# sword is its bestiary entry): the `kind` of a removal or a reverted version.
ENTRY_TABLES = (
    ("items", "Item"),
    ("skills", "Skill"),
    ("spells", "Spell"),
    ("specials", "Special"),
    ("races", "Race"),
    ("bestiary", "Bestiary entry"),
)


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


class CatalogueEntry(models.Model):
    """What every catalogue entry table carries besides its own columns (items, skills, spells, specials, races and
    bestiary entries; a hired sword's are its entry's).

    `replaces`: a campaign's version of a book entry points at the entry it stands in for (decisions 1 and 2): the
    campaign's lists, prices and pickers find it through this reference, never through the name. A house rule's
    generated clone is a version too (its `generated_effect_key` is set). `archived_at`: a custom entry deleted while
    something still held it (decision 5), hidden from lists but valid in copies. `updated_by`/`updated_at`: who last
    wrote the entry through the catalogue, for the badges' tooltip (CAT-NEW-03); null on the book.
    """

    replaces = models.ForeignKey(
        "self", related_name="versions", null=True, blank=True, on_delete=models.RESTRICT
    )  # RESTRICT: a book entry a campaign has a version of can't go; deleting the campaign still takes its versions
    archived_at = models.DateTimeField(null=True, blank=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="+", null=True, blank=True, on_delete=models.SET_NULL
    )
    updated_at = models.DateTimeField(null=True, blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="+", null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        abstract = True


def version_constraints(prefix: str) -> list[models.BaseConstraint]:
    """One version of a book entry per campaign, and only a campaign's row is one (the service also requires that
    it replaces a book row)."""
    return [
        models.UniqueConstraint(
            fields=["campaign", "replaces"], condition=models.Q(replaces__isnull=False), name=f"{prefix}_one_version"
        ),
        models.CheckConstraint(
            check=models.Q(replaces__isnull=True) | models.Q(campaign__isnull=False),
            name=f"{prefix}_version_in_a_campaign",
        ),
    ]


class CatalogueRemoval(models.Model):
    """A book entry deleted for one campaign (CAT-NEW-05): hidden from that campaign's lists, shops and pickers; the
    book and every other campaign keep it, copies stay valid, and restoring deletes the record.

    One table for every kind, keyed by the kind that owns the entry's table (`ENTRY_TABLES`), rather than six
    identical tables: lists, pickers and restore read it through one path, as they read the kinds registry. The id
    has no foreign key, but book rows are never deleted (the seeders upsert, copies hold them with RESTRICT, the
    API never deletes one), and the record goes with its campaign."""

    campaign = models.ForeignKey("campaigns.Campaign", related_name="catalogue_removals", on_delete=models.CASCADE)
    kind = models.CharField(max_length=20, choices=ENTRY_TABLES)
    entry_id = models.BigIntegerField()
    removed_at = models.DateTimeField(default=timezone.now)
    removed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="+", null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        db_table = "catalogue_removal"
        constraints = [
            models.UniqueConstraint(fields=["campaign", "kind", "entry_id"], name="catalogue_removal_once"),
        ]

    def __str__(self):
        return f"{self.kind} {self.entry_id} removed from campaign {self.campaign_id}"


class RevertedVersion(models.Model):
    """A version a campaign reverted (its row is gone) and the book entry it stood in for: open battles name item
    ids in their item-use events and finds, and finalise maps a reverted version's id back to the book entry
    through here (apps/core/catalogue/current.py)."""

    campaign = models.ForeignKey("campaigns.Campaign", related_name="+", on_delete=models.CASCADE)
    kind = models.CharField(max_length=20, choices=ENTRY_TABLES)
    version_id = models.BigIntegerField()
    book_id = models.BigIntegerField()
    reverted_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "catalogue_reverted_version"
        constraints = [models.UniqueConstraint(fields=["kind", "version_id"], name="catalogue_reverted_once")]

    def __str__(self):
        return f"{self.kind} {self.version_id} reverted to {self.book_id}"
