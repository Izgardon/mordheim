"""The one write path of the catalogue's creates, edits and reverts, for every kind.

A write of a kind with names runs in one transaction, where a name that two writes took at once answers 400
`name_taken` with nothing written (duplicates.py, names.py). Every write bumps its campaign's catalogue version in
the same transaction, which retires the campaign's cached lists (cache.py, PERF-13). Deletes, archives, removals
and restores are archive.py's.
"""

from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from typing import TYPE_CHECKING, Any, NoReturn

from . import names
from .cache import bump
from .duplicates import refusing_duplicates

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
