"""Cursor pages, newest first, for the warband log and the treasury (ECON-PERF-06).

A client asks for pages with `?limit=N` (1 to 100) and follows `next_cursor` with `?cursor=...` (the limit
defaults to 25). The cursor is the last row's (created_at, id), so a page never repeats or skips rows when new
ones arrive, and each page is one index seek on (warband, -created_at, -id). A request with neither parameter
gets the whole list, as clients from before pass 2 expect.
"""

import base64
import binascii
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from django.db.models import Model, Q, QuerySet
from rest_framework.exceptions import ValidationError

DEFAULT_LIMIT = 25
MAX_LIMIT = 100


@dataclass(frozen=True)
class PageRequest:
    limit: int
    after: tuple[datetime, int] | None  # the (created_at, id) of the last row already shown


@dataclass(frozen=True)
class Page:
    rows: list[Any]
    next_cursor: str | None


def _cursor(row: Any) -> str:
    return base64.urlsafe_b64encode(f"{row.created_at.isoformat()}|{row.id}".encode()).decode()


def _decode(cursor: str) -> tuple[datetime, int]:
    try:
        created_at, row_id = base64.urlsafe_b64decode(cursor.encode()).decode().split("|")
        return datetime.fromisoformat(created_at), int(row_id)
    except (binascii.Error, UnicodeDecodeError, ValueError) as error:
        raise ValidationError({"cursor": ["Invalid cursor."]}) from error


def requested_page(params: Mapping[str, str]) -> PageRequest | None:
    """The page a request asks for, or None for the whole list (no `limit` and no `cursor`)."""
    if "limit" not in params and "cursor" not in params:
        return None
    limit = DEFAULT_LIMIT
    if "limit" in params:
        try:
            limit = int(params["limit"])
        except ValueError:
            limit = 0
        if not 1 <= limit <= MAX_LIMIT:
            raise ValidationError({"limit": [f"Ask for 1 to {MAX_LIMIT} rows."]})
    cursor = params.get("cursor")
    return PageRequest(limit, _decode(cursor) if cursor else None)


def newest_first(rows: QuerySet[Any]) -> QuerySet[Any]:
    return rows.order_by("-created_at", "-id")


def paginate(rows: QuerySet[Any], page: PageRequest) -> Page:
    """One page of `rows`, newest first, after the cursor; one query (it reads one row more to know if more)."""
    if page.after is not None:
        created_at, row_id = page.after
        rows = rows.filter(Q(created_at__lt=created_at) | Q(created_at=created_at, id__lt=row_id))
    found: list[Model] = list(newest_first(rows)[: page.limit + 1])
    shown = found[: page.limit]
    return Page(shown, _cursor(shown[-1]) if len(found) > page.limit else None)
