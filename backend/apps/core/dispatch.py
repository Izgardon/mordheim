"""Run slow external calls (Pusher, Resend) after commit, off the request thread.

A request must never wait on, or fail because of, a third-party HTTP call: the
write it made is already committed, so an exception here would only turn a
success into a 500 and invite a duplicate retry.
"""

import logging
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)

# A single worker per process keeps events on a channel in the order they were sent.
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="external-dispatch")


def _run_logged(fn: Callable[..., Any], args: tuple[Any, ...], kwargs: dict[str, Any]) -> None:
    try:
        fn(*args, **kwargs)
    except Exception:
        logger.exception("External dispatch failed: %s", getattr(fn, "__qualname__", fn))


def dispatch_after_commit(fn: Callable[..., Any], *args: Any, **kwargs: Any) -> None:
    """Call ``fn(*args, **kwargs)`` in the background once the current transaction commits.

    Outside a transaction it is queued immediately. Failures are logged, never raised.
    ``fn`` must not touch the database: it runs on another thread.
    """

    def submit() -> None:
        if settings.EXTERNAL_DISPATCH_SYNC:
            _run_logged(fn, args, kwargs)
        else:
            _executor.submit(_run_logged, fn, args, kwargs)

    transaction.on_commit(submit, robust=True)
