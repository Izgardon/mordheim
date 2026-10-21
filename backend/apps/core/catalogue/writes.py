"""The one write path of the catalogue: every create, edit, revert and delete of an entry, for every kind, runs here.

A write of a kind with names runs in one transaction, where a name that two writes took at once answers 400
`name_taken` with nothing written (duplicates.py, names.py). A delete deletes the entry, or answers 409 `in_use`
with the counts and deletes nothing when anything holds it (usage.py; BUG-16 safety net, BUG-130). Every write
bumps its campaign's catalogue version in the same transaction, which retires the campaign's cached lists
(cache.py, PERF-13).
"""

from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from typing import TYPE_CHECKING, Any, NoReturn

from django.db import models, transaction

from apps.core.errors import ApiError

from . import names
from .cache import bump
from .duplicates import refusing_duplicates
from .usage import count_usage

if TYPE_CHECKING:
    from .kinds import CatalogueKindSpec


@contextmanager
def catalogue_write(
    kind: "CatalogueKindSpec", campaign_id: int, name: str | None = None, allowed: Iterable[Any] = ()
) -> Iterator[None]:
    """A create, an edit or a revert of one of the campaign's entries (`name`: the name it writes, `allowed`: the
    entry ids that may hold it)."""
    if not kind.named:  # one INSERT (an item property): nothing to refuse, and nothing to wrap
        yield
        bump(campaign_id)  # after the INSERT's commit: a list read in between caches the new row under the old version
        return

    def taken() -> NoReturn:
        written = name or ""
        names.refuse(kind, written, names.matches(kind, campaign_id, written, allowed))

    with refusing_duplicates(taken):
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
        usage = count_usage(kind, entry.pk, entry.campaign_id)
        raise ApiError(detail, code="in_use", status=409, usage=usage) from error
