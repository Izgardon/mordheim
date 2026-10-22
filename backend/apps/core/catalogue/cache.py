"""Catalogue list bodies, cached per kind, campaign, catalogue version and query (PERF-13's server half).

A version is a random value replaced, in the writer's transaction, whenever what a list shows changes. A
campaign's (`CampaignSettings.catalogue_version`) covers everything its lists show: the catalogue's write path
(writes.py), the house-rule syncs and an injury's new campaign special bump it, and so does every seeder, since
campaign lists show the book too. The book's own version (`core.CatalogueVersion`, one row) keys the lists read
without a campaign, and the seeders bump it with every campaign's. A list reads its version before its rows (a
campaign's comes with the membership read; the book's is one query), so a body is never stored under a version
older than its rows. An unchanged list is answered from the cache: a campaign list's revalidation costs the
membership read alone and no serialisation, and ConditionalGetMiddleware still turns a matching ETag into a 304.

The "catalogue" cache is each gunicorn worker's own memory. That is enough because the versions are read from the
database: a worker never serves a body another worker's write retired, it only fills its own cache.
"""

import hashlib
import uuid
from collections.abc import Callable
from urllib.parse import urlencode

from django.core.cache import caches
from django.http import HttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from apps.campaigns.models import CampaignSettings
from apps.core.models import BOOK, CatalogueVersion
from apps.realtime.services import send_catalogue_changed

CACHE = "catalogue"


def bump(campaign_id: int | None, *kinds: str, socket_id: str | None = None) -> None:
    """What the campaign's lists of `kinds` show changed: they are stale from the caller's commit on (one query), and
    each kind's `catalogue.changed` goes to the campaign's members after it (BUG-80; not to `socket_id`, the writer's).
    None: the book changed, which every list shows, so the book's version and every campaign's move (two queries);
    no event goes per campaign, the pages read the book again after their stale time."""
    if campaign_id is not None:
        CampaignSettings.objects.filter(campaign_id=campaign_id).update(catalogue_version=uuid.uuid4())
        for kind in kinds:
            send_catalogue_changed(campaign_id, kind, socket_id)
        return
    CatalogueVersion.objects.bulk_create(
        [CatalogueVersion(id=BOOK, version=uuid.uuid4())],
        update_conflicts=True,
        unique_fields=["id"],
        update_fields=["version"],
    )
    CampaignSettings.objects.update(catalogue_version=uuid.uuid4())  # one value: each key holds its campaign's id


def list_key(kind: str, campaign_id: int | None, campaign_version: uuid.UUID | None, request: Request) -> str | None:
    """The cache key of a list request, or None when its body isn't cached: the browsable API's HTML (it shows the
    viewer), a campaign without settings (nothing bumps it), or a database without the book's row."""
    if request.accepted_renderer.format != "json":
        return None
    version = campaign_version if campaign_id is not None else book_version()
    if version is None:
        return None
    query = urlencode(sorted(request.query_params.lists()), doseq=True)
    digest = hashlib.md5(f"{request.accepted_media_type}?{query}".encode(), usedforsecurity=False).hexdigest()
    return f"catalogue:{kind}:{campaign_id or 'book'}:{version}:{digest}"


def book_version() -> uuid.UUID | None:
    return CatalogueVersion.objects.filter(pk=BOOK).values_list("version", flat=True).first()


def cached_response(key: str) -> HttpResponse | None:
    """The body cached under `key`, answered as it was first sent."""
    hit = caches[CACHE].get(key)
    if hit is None:
        return None
    content_type, body = hit
    return HttpResponse(body, content_type=content_type)


def remembered(key: str) -> Callable[[Response], None]:
    """A post-render callback that caches the rendered body under `key`."""

    def remember(response: Response) -> None:
        caches[CACHE].set(key, (response["Content-Type"], response.content))

    return remember
