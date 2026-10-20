"""The catalogue's views (design 0.29 for the catalogue, IMP-79): every catalogue route is one of these, given its
kind (kinds.py), on pass 4's `CampaignScopedView`.

A catalogue path doesn't name its campaign. A list reads `?campaign_id=` (none: the book, which needs only a
login), a create reads its body's `campaign_id` (none: 404), a detail its entry's campaign (none: a book entry,
which anyone signed in reads and nobody writes, 403). Once the campaign is known, access is the campaign routes':
a non-member 404 "Not found", a write to an archived campaign 403 `campaign_archived`, then the method's rule:
reading takes membership, creating and editing `edit_catalogue`, deleting `delete_catalogue` (decisions 4 and 5).
A method a view handles but `rules` doesn't name is refused (deny by default).
"""

from typing import Any, ClassVar

from django.db.models import Model
from django.http.response import HttpResponseBase
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer

from apps.campaigns.permissions import parse_campaign_id
from apps.campaigns.views.base import CampaignScopedView

from . import cache
from .kinds import CatalogueKindSpec
from .writes import catalogue_write, delete_unless_in_use

CATALOGUE_RULES = {
    "GET": "view",
    "POST": "edit_catalogue",
    "PUT": "edit_catalogue",
    "PATCH": "edit_catalogue",
    "DELETE": "delete_catalogue",
}
EDITS = frozenset({"PUT", "PATCH"})


class CatalogueScopedView(CampaignScopedView):
    kind: ClassVar[CatalogueKindSpec]
    rules = CATALOGUE_RULES
    campaign_id: int | None = None  # None: the book

    def enter(self, method: str, campaign_id: int) -> None:
        """The caller's access to the campaign, then the method's rule."""
        self.campaign_id = campaign_id
        self.enter_campaign(method, campaign_id)
        self.check_rule(self.rules.get(method))

    def write_serializer(self, *args: Any, **kwargs: Any) -> BaseSerializer[Any]:
        """The kind's write serializer, its linked ids scoped to the campaign (SEC-07)."""
        assert self.kind.write_serializer is not None, f"{self.kind.key} is read-only"
        return self.kind.write_serializer(*args, context={"campaign_id": self.campaign_id}, **kwargs)

    def answer(self, entry: Model) -> Any:
        """A write's answer: the entry as its detail reads it."""
        kind = self.kind
        row = kind.hooks.detail_rows(kind).get(pk=entry.pk) if kind.reread else entry
        return kind.entry_serializer(row).data


class CatalogueCollectionView(CatalogueScopedView):
    """A kind's list (GET) and create (POST)."""

    def load_scope(self, method: str, **kwargs: Any) -> None:
        source = self.request.query_params if method == "GET" else self.request.data
        campaign_id = parse_campaign_id(source.get("campaign_id"))  # garbage is a 400 (BUG-79)
        if campaign_id is not None:
            self.enter(method, campaign_id)
        elif method != "GET":
            self.kind.hooks.missing_campaign()

    def list(self, request: Request) -> HttpResponseBase:
        """The kind's rows, filtered, then the book's or the campaign's by today's name rule; answered from the cache
        while neither catalogue has changed (PERF-13)."""
        campaign_settings = self.access.settings if self.campaign_id is not None else None
        version = campaign_settings.catalogue_version if campaign_settings else None
        key = cache.list_key(self.kind.key, self.campaign_id, version, request)
        hit = cache.cached_response(key) if key else None
        if hit is not None:
            return hit
        response = Response(self.list_data(request))
        if key:
            response.add_post_render_callback(cache.remembered(key))
        return response

    def list_data(self, request: Request) -> Any:
        kind = self.kind
        rows = kind.hooks.rows(kind)
        if kind.excluded_types:
            rows = rows.exclude(type__in=kind.excluded_types)
        for param, keeps in kind.filters.items():
            value = request.query_params.get(param)
            if value:
                rows = rows.filter(keeps(value.strip()))
        listed = kind.hooks.read(kind.hooks.listed(kind, rows, self.campaign_id))
        return kind.row_serializer(listed, many=True).data

    def create(self, request: Request) -> Response:
        assert self.campaign_id is not None  # load_scope found it
        serializer = self.write_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)  # every field and linked id, before anything is written
        with catalogue_write(self.kind, self.campaign_id):
            entry = self.kind.hooks.create(serializer, self.campaign_id)
        return Response(self.answer(entry), status=status.HTTP_201_CREATED)


class CatalogueListView(CatalogueCollectionView):
    def get(self, request: Request) -> HttpResponseBase:
        return self.list(request)

    def post(self, request: Request) -> Response:
        return self.create(request)


class CatalogueEntryView(CatalogueScopedView):
    """One entry: read (GET), edited (PUT, PATCH) or deleted (DELETE)."""

    entry: Any

    def load_scope(self, method: str, **kwargs: Any) -> None:
        kind = self.kind
        rows = kind.hooks.detail_rows(kind) if method == "GET" else kind.hooks.write_rows(kind)
        entry = rows.filter(pk=kwargs[kind.url_kwarg]).first()
        if entry is None:
            raise NotFound("Not found")
        self.entry = entry
        if entry.campaign_id is None:  # the book: read by anyone signed in, written by nobody
            if method != "GET":
                raise PermissionDenied("Forbidden")
            return
        if method in EDITS:
            kind.hooks.check_edit_body(self.request, entry)
        self.campaign_id = entry.campaign_id
        self.enter_campaign(method, entry.campaign_id)
        if method != "GET":
            kind.hooks.refuse_write(entry)
        self.check_rule(self.rules.get(method))

    def read(self) -> Response:
        return Response(self.kind.entry_serializer(self.entry).data)

    def edit(self, *, partial: bool) -> Response:
        """The fields an edit sends change; a list it sends replaces that list."""
        assert self.campaign_id is not None  # the book is never written
        instance = self.kind.hooks.write_instance(self.entry)
        serializer = self.write_serializer(instance, data=self.request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        with catalogue_write(self.kind, self.campaign_id):
            self.kind.hooks.update(self.entry, serializer)
        return Response(self.answer(self.entry))

    def destroy(self) -> Response:
        delete_unless_in_use(self.kind, self.entry)  # 409 in_use when anything holds it (BUG-16)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CatalogueDetailView(CatalogueEntryView):
    def get(self, request: Request, **kwargs: Any) -> Response:
        return self.read()

    def patch(self, request: Request, **kwargs: Any) -> Response:
        return self.edit(partial=True)

    def delete(self, request: Request, **kwargs: Any) -> Response:
        return self.destroy()
