"""Roster errors in the standard shape: `{"detail": str, "code": str, "fields": {name: [msg]}}`.

Raised from services (inside their transactions, which roll back as the error propagates) and rendered by
DRF as they are. `code` is stable for clients to branch on; `fields` keys name the offending input, dotted
for nested input (e.g. "create.0.name" in a batch).
"""

from collections.abc import Mapping
from typing import Any

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.settings import api_settings

FieldErrors = dict[str, list[str]]


class RosterError(APIException):
    status_code: int = status.HTTP_400_BAD_REQUEST

    def __init__(self, detail: str, code: str, fields: FieldErrors | None = None, *, status_code: int = 400):
        super().__init__({"detail": detail, "code": code, "fields": fields or {}})
        self.status_code = status_code
        self.error_code = code
        self.message = detail
        self.fields: FieldErrors = fields or {}


def flatten_errors(errors: Any, prefix: str = "") -> FieldErrors:
    """DRF's nested validation errors as one level of dotted keys: {"henchmen": {0: {"name": [...]}}} ->
    {"<prefix>.henchmen.0.name": [...]}. Non-field errors land on the prefix itself."""
    if isinstance(errors, Mapping):
        flat: FieldErrors = {}
        for key, value in errors.items():
            name = (prefix or str(key)) if key == api_settings.NON_FIELD_ERRORS_KEY else _join(prefix, str(key))
            for field, messages in flatten_errors(value, name).items():
                flat.setdefault(field, []).extend(messages)
        return flat
    if isinstance(errors, list) and any(isinstance(entry, Mapping | list) for entry in errors):
        flat = {}
        for index, entry in enumerate(errors):
            for field, messages in flatten_errors(entry, _join(prefix, str(index))).items():
                flat.setdefault(field, []).extend(messages)
        return flat
    messages = errors if isinstance(errors, list) else [errors]
    return {prefix: [str(message) for message in messages]}


def _join(prefix: str, key: str) -> str:
    return f"{prefix}.{key}" if prefix else key


def validation_error(errors: Any, prefix: str = "") -> RosterError:
    """A 400 for DRF validation errors, in the standard shape with dotted field keys."""
    return RosterError("Some of the values are invalid.", "invalid", flatten_errors(errors, prefix))
