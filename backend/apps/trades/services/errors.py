"""A refused trade action."""

from typing import Any


class TradeError(Exception):
    """Raised inside the action's transaction, so nothing the action wrote is kept.

    Answered with `status` and `{"detail": ...}`, plus `code` and any `extra` keys when given (new refusals
    carry a stable code; the older 400s keep their detail-only body).
    """

    def __init__(self, detail: str, *, status: int = 400, code: str | None = None, **extra: Any) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status = status
        self.code = code
        self.extra = extra

    def body(self) -> dict[str, Any]:
        body: dict[str, Any] = {"detail": self.detail}
        if self.code is not None:
            body["code"] = self.code
        return {**body, **self.extra}
