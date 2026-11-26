"""A refused campaign request in the standard error shape `{"detail": str, "code": str, "fields": {name: [msg]}}`.

Services raise it inside the request's transaction, so nothing they wrote is kept, and the view answers it. `code`
is stable for clients to branch on; older campaign refusals keep their detail-only body.
"""

from typing import Any

from rest_framework.exceptions import APIException
from rest_framework.response import Response

ARCHIVED_DETAIL = "This campaign is archived, so nothing in it can change. Its owner can restore it."


class CampaignArchived(APIException):
    """403 `campaign_archived` in the standard body: an archived campaign is read-only for everyone (decision 5).

    A DRF exception, so any view answers it (campaign, warband, battle, trade and catalogue writes alike)."""

    status_code = 403
    default_code = "campaign_archived"

    def __init__(self) -> None:
        super().__init__({"detail": ARCHIVED_DETAIL, "code": "campaign_archived", "fields": {}})


WORKSHOP_DETAIL = (
    "This is a workshop, not a campaign: it holds your own warbands, warband lists and content, and has no battles,"
    " trades, members or campaign pages."
)


class WorkshopCampaign(APIException):
    """403 `workshop_campaign` in the standard body: what a workshop never does (apps/workshop: battles, trades,
    joining, members, the campaign's pages and settings, and the catalogue kinds that only matter in a campaign:
    scenarios, plots, exploration charts; the kinds a warband's units use are written there: catalogue/specs.py).

    A DRF exception, as `CampaignArchived` is, so any view answers it."""

    status_code = 403
    default_code = "workshop_campaign"

    def __init__(self, detail: str = WORKSHOP_DETAIL) -> None:
        super().__init__({"detail": detail, "code": "workshop_campaign", "fields": {}})


BOOK_ENTRY_DETAIL = "The book's entries are read only in your workshop: add one of your own instead."
NO_ARCHIVE_DETAIL = "Your workshop keeps no archive: a deleted entry stays only on what still uses it."


class WorkshopBookEntry(APIException):
    """403 `workshop_book_entry` (William, 26 Nov 2026: "New + edit own"): in a workshop the book's entries are read
    only, so nothing makes, changes, removes or reverts the workshop's version of one. `field`: the input that named
    it (a skill's `group_ids`), else none."""

    status_code = 403
    default_code = "workshop_book_entry"

    def __init__(self, detail: str = BOOK_ENTRY_DETAIL, field: str | None = None) -> None:
        fields = {field: [detail]} if field else {}
        super().__init__({"detail": detail, "code": "workshop_book_entry", "fields": fields})


class WorkshopNoArchive(APIException):
    """403 `workshop_no_archive` (William, 26 Nov 2026): a workshop has no archive to list or restore from; a deleted
    entry something still holds is only hidden from its lists and pickers (core/catalogue/archive.py)."""

    status_code = 403
    default_code = "workshop_no_archive"

    def __init__(self) -> None:
        super().__init__({"detail": NO_ARCHIVE_DETAIL, "code": "workshop_no_archive", "fields": {}})


class CampaignError(Exception):
    def __init__(
        self,
        detail: str,
        *,
        code: str = "invalid",
        fields: dict[str, list[str]] | None = None,
        status: int = 400,
        **extra: Any,
    ) -> None:
        super().__init__(detail)
        self.detail = detail
        self.code = code
        self.fields = fields or {}
        self.status = status
        self.extra = extra

    def response(self) -> Response:
        body = {"detail": self.detail, "code": self.code, "fields": self.fields, **self.extra}
        return Response(body, status=self.status)


def field_error(field: str, detail: str, code: str = "invalid") -> CampaignError:
    """A 400 for one invalid input field."""
    return CampaignError(detail, code=code, fields={field: [detail]})


class Refused(Exception):
    """A refusal in the older campaign body, `{"detail": str}` (with `code` when it has one), which the current
    pages read as they are."""

    def __init__(self, detail: str, *, code: str | None = None, status: int = 400) -> None:
        super().__init__(detail)
        self.detail = detail
        self.code = code
        self.status = status

    def response(self) -> Response:
        body = {"detail": self.detail, **({"code": self.code} if self.code else {})}
        return Response(body, status=self.status)
