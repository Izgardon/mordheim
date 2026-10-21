"""The catalogue's views (design 0.29 for the catalogue, IMP-79): every catalogue route is one of these, given its
kind (kinds.py), on pass 4's `CampaignScopedView`.

A catalogue path doesn't name its campaign. A list reads `?campaign_id=` (none: the book, which needs only a
login), a create reads its body's `campaign_id` (none: 404), an entry its own campaign. A book entry is read by
anyone signed in; a write to it names the campaign it is for (`campaign_id` in the body or the query; none: 403),
where an edit makes or changes the campaign's version of it (versions.py). Once the campaign is known, access is
the campaign routes': a non-member 404 "Not found", a write to an archived campaign 403 `campaign_archived`, then
the method's rule: reading takes membership, creating, editing and reverting `edit_catalogue`, deleting
`delete_catalogue` (decisions 4 and 5). A method a view handles but `rules` doesn't name is refused (deny by
default).
"""

from typing import Any, ClassVar

from django.db.models import Model
from django.http.response import HttpResponseBase
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer

from apps.campaigns.permissions import parse_campaign_id
from apps.campaigns.views.base import CampaignScopedView

from . import archive, cache, names, versions
from .hooks import CampaignRequired
from .kinds import CatalogueKindSpec, entry_kind
from .usage import count_usage
from .writes import catalogue_write

CATALOGUE_RULES = {
    "GET": "view",
    "POST": "edit_catalogue",
    "PUT": "edit_catalogue",
    "PATCH": "edit_catalogue",
    "DELETE": "delete_catalogue",
}
EDITS = frozenset({"PUT", "PATCH"})
ACTIONS = {"PUT": "edit", "PATCH": "edit", "DELETE": "delete"}


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

    def stamp(self, serializer: BaseSerializer[Any]) -> None:
        """Who writes the entry, and when, saved with it for the badges' tooltip (CAT-NEW-03)."""
        if self.kind.versioned:
            serializer.validated_data.update(updated_by=self.request.user, updated_at=timezone.now())

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
        params = request.query_params
        listed = kind.hooks.shown(kind.hooks.listed(kind, rows, self.campaign_id, params), params)
        serializer = kind.hooks.row_serializer(kind, request.query_params)
        return serializer(kind.hooks.read(listed), many=True).data

    def create(self, request: Request) -> Response:
        assert self.campaign_id is not None  # load_scope found it
        serializer = self.write_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)  # every field and linked id, before anything is written
        name = serializer.validated_data.get("name")
        if self.kind.named and name is not None:
            names.check_create(self.kind, self.campaign_id, name)  # 400 name_taken with the matches (CAT-TWEAK-02)
        self.stamp(serializer)
        with catalogue_write(self.kind, self.campaign_id, name):
            entry = self.kind.hooks.create(serializer, self.campaign_id)
        return Response(self.answer(entry), status=status.HTTP_201_CREATED)


class CatalogueListView(CatalogueCollectionView):
    def get(self, request: Request) -> HttpResponseBase:
        return self.list(request)

    def post(self, request: Request) -> Response:
        return self.create(request)


def named_campaign(request: Request) -> int | None:
    """The campaign a write to a book entry is for: `campaign_id` in the body, else in the query (a DELETE)."""
    body = request.data.get("campaign_id") if hasattr(request.data, "get") else None
    return parse_campaign_id(body if body not in (None, "") else request.query_params.get("campaign_id"))


class CatalogueEntryView(CatalogueScopedView):
    """One entry: read (GET), edited (PUT, PATCH) or deleted (DELETE)."""

    entry: Any
    book_methods: ClassVar[frozenset[str]] = frozenset({"PUT", "PATCH", "DELETE"})  # a book entry's, for a campaign
    reads_detail: ClassVar[bool] = True  # GET reads the entry with what its detail shows
    actions: ClassVar[dict[str, str]] = ACTIONS  # method -> what `hooks.refuse_write` is asked about

    def load_scope(self, method: str, **kwargs: Any) -> None:
        kind = self.kind
        rows = kind.hooks.detail_rows(kind) if method == "GET" and self.reads_detail else kind.hooks.write_rows(kind)
        entry = rows.filter(pk=kwargs[kind.url_kwarg]).first()
        if entry is None:
            raise NotFound("Not found")
        self.entry = entry
        campaign_id = entry.campaign_id
        if campaign_id is None:  # the book: read by anyone signed in, written for one campaign
            campaign_id = named_campaign(self.request) if method in self.book_methods else None
            if campaign_id is None:
                if method == "GET":
                    return
                raise PermissionDenied("Forbidden")
        elif method in EDITS:
            kind.hooks.check_edit_body(self.request, entry)
        self.campaign_id = campaign_id
        self.enter_campaign(method, campaign_id)
        if method in self.actions and entry.campaign_id is not None:
            kind.hooks.refuse_write(versions.entry_of(kind, entry), self.actions[method])
        self.check_rule(self.rules.get(method))

    def read(self) -> Response:
        return Response(self.kind.entry_serializer(self.entry).data)

    def edit(self, *, partial: bool) -> Response:
        """The fields an edit sends change; a list it sends replaces that list. A book entry's first edit in a
        campaign makes the campaign's version of it, which the answer is (CAT-TWEAK-01)."""
        assert self.campaign_id is not None  # the book itself is never written
        kind = self.kind
        serializer = self.write_serializer(
            kind.hooks.write_instance(self.entry), data=self.request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        name, shown = serializer.validated_data.get("name"), versions.entry_of(kind, self.entry)
        names.check_edit(kind, shown, self.campaign_id, name)  # its own name, or its book entry's, stays allowed
        self.stamp(serializer)
        with catalogue_write(kind, self.campaign_id, name, allowed=[shown.pk, shown.replaces_id or shown.pk]):
            entry = versions.editable(kind, self.entry, self.campaign_id)
            serializer.instance = kind.hooks.write_instance(entry)
            kind.hooks.update(entry, serializer)
        return Response(self.answer(entry))

    def destroy(self) -> Response:
        """A custom entry is deleted, or archived while something holds it; a book entry is removed for the campaign;
        a version is refused (409 use_revert): CAT-TWEAK-04, CAT-NEW-05."""
        assert self.campaign_id is not None
        body = archive.delete_entry(self.kind, self.entry, self.campaign_id, self.request.user)
        return Response(status=status.HTTP_204_NO_CONTENT) if body is None else Response(body)


class CatalogueDetailView(CatalogueEntryView):
    def get(self, request: Request, **kwargs: Any) -> Response:
        return self.read()

    def patch(self, request: Request, **kwargs: Any) -> Response:
        return self.edit(partial=True)

    def delete(self, request: Request, **kwargs: Any) -> Response:
        return self.destroy()


class CatalogueRevertView(CatalogueEntryView):
    """POST <kind>/:id/revert/: the campaign's version goes and its copies go back to the book entry, keeping what was
    paid (CAT-TWEAK-01). A book id with `campaign_id` reverts the campaign's version of it (a list read before the
    edit). The answer is the book entry."""

    rules = {"POST": "edit_catalogue"}
    book_methods = frozenset({"POST"})
    actions = {"POST": "revert"}

    def post(self, request: Request, **kwargs: Any) -> Response:
        assert self.campaign_id is not None
        with catalogue_write(self.kind, self.campaign_id):
            book = versions.revert(self.kind, self.entry, self.campaign_id)
        return Response(self.answer(book))


class CatalogueRestoreView(CatalogueEntryView):
    """POST <kind>/:id/restore/: an archived entry, or a book entry removed for the campaign (with `campaign_id`), is
    back in the campaign's lists (CAT-TWEAK-04, CAT-NEW-05). The answer is the entry."""

    rules = {"POST": "edit_catalogue"}
    book_methods = frozenset({"POST"})
    actions = {"POST": "restore"}

    def post(self, request: Request, **kwargs: Any) -> Response:
        assert self.campaign_id is not None
        archive.restore(self.kind, self.entry, self.campaign_id)
        return Response(self.answer(self.entry))


class CatalogueUsageView(CatalogueEntryView):
    """GET <kind>/:id/usage/: how much of the campaign holds the entry, in the counts a delete answers with (a book
    entry's needs `?campaign_id=`)."""

    rules = {"GET": "view"}
    book_methods = frozenset({"GET"})
    reads_detail = False

    def get(self, request: Request, **kwargs: Any) -> Response:
        if self.campaign_id is None:
            raise CampaignRequired()
        entry = versions.entry_of(self.kind, self.entry)
        return Response(count_usage(entry_kind(self.kind), entry.pk, self.campaign_id))
