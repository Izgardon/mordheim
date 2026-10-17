from collections.abc import Callable

from django.http import HttpRequest, HttpResponse
from django.utils.cache import patch_cache_control


class ApiRevalidateMiddleware:
    """Mark API GET responses as private and always-revalidate.

    Together with ConditionalGetMiddleware (which adds a content ETag and answers a
    matching If-None-Match with an empty 304), the browser re-downloads a response
    only when it actually changed - e.g. the ~370 KB of catalogue lists on every
    campaign entry. Nothing is ever served stale: each use revalidates.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)
        if request.method == "GET" and request.path.startswith("/api/") and not response.has_header("Cache-Control"):
            patch_cache_control(response, private=True, no_cache=True)
        return response
