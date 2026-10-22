"""A refusal in the standard error body, `{"detail": str, "code": str, "fields": {name: [msg]}, ...extra}`.

`ApiError` is a DRF exception, so a service or view of any app raises it and DRF answers it (inside a transaction,
what the request wrote is rolled back first). Unlike a plain `APIException`, the body is sent as given: extra keys
keep their types, so counts stay numbers.
"""

from typing import Any

from rest_framework.exceptions import APIException


class ApiError(APIException):
    def __init__(
        self,
        detail: str,
        *,
        code: str,
        status: int = 400,
        fields: dict[str, list[str]] | None = None,
        **extra: Any,
    ) -> None:
        super().__init__(detail, code)
        self.status_code = status
        self.detail: Any = {"detail": detail, "code": code, "fields": fields or {}, **extra}
