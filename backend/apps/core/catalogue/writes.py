"""The one write path of the catalogue: every create, edit and delete of an entry, for every kind, runs here.

A write of a kind with a name constraint runs in one transaction, where an exact duplicate answers 400
`duplicate_entry` with nothing written (duplicates.py). A delete deletes the entry, or answers 409 `in_use` with
the counts and deletes nothing when anything holds it (usage.py; BUG-16 safety net, BUG-130). Every write bumps
its campaign's catalogue version in the same transaction, which retires the campaign's cached lists (cache.py,
PERF-13). PR C's archive, copy-on-write and `catalogue.changed` event are added here, once for every kind.
"""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import TYPE_CHECKING, Any

from django.db import models, transaction

from apps.core.errors import ApiError

from .cache import bump
from .duplicates import refusing_duplicates
from .usage import usage_of

if TYPE_CHECKING:
    from .kinds import CatalogueKindSpec


@contextmanager
def catalogue_write(kind: "CatalogueKindSpec", campaign_id: int) -> Iterator[None]:
    """A create or an edit of one of the campaign's entries."""
    if kind.duplicate is None:  # one INSERT (an item property): nothing to refuse, and nothing to wrap
        yield
        bump(campaign_id)  # after the INSERT's commit: a list read in between caches the new row under the old version
        return
    with refusing_duplicates(kind.duplicate):
        yield
        bump(campaign_id)


def delete_unless_in_use(kind: "CatalogueKindSpec", entry: Any) -> None:
    """Delete the entry; when anything holds it, nothing is deleted and the caller gets 409 `in_use` with the counts
    (`usage`), so the page can say what uses it."""
    try:
        with transaction.atomic():
            kind.hooks.delete(entry)
            bump(entry.campaign_id)
    except models.RestrictedError as error:
        detail = f"This {kind.noun} is in use, so nothing was deleted."
        raise ApiError(detail, code="in_use", status=409, usage=usage_of(error.restricted_objects)) from error
