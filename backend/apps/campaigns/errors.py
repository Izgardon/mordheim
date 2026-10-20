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
