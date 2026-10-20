"""The base uniqueness constraints of the catalogue tables (BUG-17, IMP-83) and the 400 a write gets from them.

Each table holds one row per name (and type) in the book, in an add-on (`campaign_type`) and in a campaign; NULLs
are not distinct, so the book is covered too. A campaign entry may still share a book entry's name: the campaign is
part of the key. A house-rule clone is left out of the item constraint, because a campaign may already hold a
custom entry of the book armour's name when the rule is switched on.
"""

from collections.abc import Iterator
from contextlib import contextmanager

from django.db import IntegrityError, transaction

from apps.core.errors import ApiError

NAME_CONSTRAINTS = frozenset(
    {
        "item_unique_name_type",
        "skill_unique_name_type",
        "spell_unique_name_type",
        "special_unique_name_type",
        "race_unique_name",
        "bestiary_entry_unique_name",
    }
)


@contextmanager
def refusing_duplicates(what: str) -> Iterator[None]:
    """Run the write in a transaction; an exact duplicate of a campaign entry (`what`: "a skill with this name and
    type") answers 400 `duplicate_entry` instead of a 500, with nothing written."""
    try:
        with transaction.atomic():
            yield
    except IntegrityError as error:
        if not any(name in str(error) for name in NAME_CONSTRAINTS):
            raise
        detail = f"This campaign already has {what}."
        raise ApiError(detail, code="duplicate_entry", fields={"name": [detail]}) from error
