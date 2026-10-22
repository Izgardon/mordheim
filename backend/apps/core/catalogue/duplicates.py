"""The base uniqueness constraints of the catalogue tables (BUG-17, IMP-83) and what a write that meets one answers.

Each table holds one row per name (and type) in the book, in an add-on (`campaign_type`) and in a campaign; NULLs
are not distinct, so the book is covered too. A campaign version keeps the name of the book entry it replaces: the
campaign is part of the key. A house-rule clone is left out of the item constraint. The name rule a create meets
first is wider (names.py); two writes of one exact name at once get past it and meet the constraint instead, which
answers the same 400 `name_taken`.
"""

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from typing import NoReturn

from django.db import IntegrityError, transaction

NAME_CONSTRAINTS = frozenset(
    {
        "item_unique_name_type",
        "skill_unique_name_type",
        "spell_unique_name_type",
        "special_unique_name_type",
        "race_unique_name",
        "bestiary_entry_unique_name",
        "hired_sword_unique_name",
        "dramatis_persona_unique_name",
    }
)


@contextmanager
def refusing_duplicates(on_taken: Callable[[], NoReturn]) -> Iterator[None]:
    """Run the write in a transaction; a name constraint's violation is answered by `on_taken` (which raises), with
    nothing written."""
    try:
        with transaction.atomic():
            yield
    except IntegrityError as error:
        if not any(name in str(error) for name in NAME_CONSTRAINTS):
            raise
        on_taken()
