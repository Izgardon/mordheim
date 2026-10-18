"""A refused battle action, in the standard error shape `{"detail": str, "code": str, "fields": {name: [msg]}}`.

Raised inside the action's transaction, so nothing the action wrote is kept, and answered by the view. `code` is
stable for clients to branch on; older battle refusals keep their detail-only body.
"""

from typing import Any

from rest_framework.response import Response


class BattleError(Exception):
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

    def body(self) -> dict[str, Any]:
        return {"detail": self.detail, "code": self.code, "fields": self.fields, **self.extra}

    def response(self) -> Response:
        return Response(self.body(), status=self.status)


def field_error(field: str, detail: str, message: str) -> BattleError:
    """A 400 for one invalid input field."""
    return BattleError(detail, fields={field: [message]})
