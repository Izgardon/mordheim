"""The differences between catalogue kinds that are behaviour rather than data (IMP-79), as pass 1 did for units.

The generic views (views.py) call these hooks. `CatalogueHooks` is what skills, spells, specials and restrictions
need: every row of the model with what its badges read, the list rule (merge.py), a create that saves the serializer
in the campaign, an edit that saves it, a delete of the entry. Items refuse deleting or reverting a house rule's
clone and write through `items/writes.py`; bestiary entries write through `bestiary/writes.py` and read their
details through `bestiary/selectors.py`, hired swords and dramatis personae through `hirelings/writes.py` and
`hirelings/selectors.py`; a race edit naming another campaign is refused (BUG-147); item properties list the book's
and the campaign's side by side.
"""

from typing import TYPE_CHECKING, Any

from django.db.models import Model, Q, QuerySet
from django.http import QueryDict
from rest_framework.exceptions import APIException, NotFound, PermissionDenied
from rest_framework.request import Request
from rest_framework.serializers import BaseSerializer

from apps.bestiary import writes as bestiary_writes
from apps.bestiary.selectors import entry_details
from apps.hirelings import selectors as hireling_selectors
from apps.hirelings import writes as hireling_writes
from apps.hirelings.models import HirelingProfile
from apps.items import writes as item_writes
from apps.items.selectors import item_rows

from . import merge
from .payloads import badge_joins
from .rows import BestiaryEntryBriefRowSerializer

if TYPE_CHECKING:
    from .kinds import CatalogueKindSpec

Serializer = BaseSerializer[Any]
HOUSE_RULE_ITEM = {
    "detail": "This item comes from a house rule and changes with it. Edit it (which detaches it from the rule), or"
    " change the house rule instead.",
    "code": "house_rule_item",
}  # BUG-51: deleting or reverting a generated clone would fight its rule; an edit detaches it (PR C's Calls)


class CampaignRequired(APIException):
    status_code = 400
    default_detail = "campaign_id is required"
    default_code = "required"


class CatalogueHooks:
    def rows(self, kind: "CatalogueKindSpec") -> QuerySet[Any]:
        """Every row of the kind: what a list filters and the detail reads, with what its badges read (CAT-NEW-03)."""
        rows = kind.model._default_manager.all()
        return rows.select_related(*badge_joins()) if kind.versioned else rows

    def listed(
        self, kind: "CatalogueKindSpec", rows: QuerySet[Any], campaign_id: int | None, params: QueryDict
    ) -> QuerySet[Any]:
        """The filtered rows a list shows, in order: the book's, or the campaign's with the book entries it hasn't
        replaced or removed, archived and removed ones too with `?archived=1` (merge.py; restrictions, which have no
        versions, by their text)."""
        if campaign_id is None:
            return merge.book_rows(rows).order_by(*kind.order)
        if kind.versioned:
            merged = merge.campaign_list(kind, rows, campaign_id, archived=params.get("archived") in ("1", "true"))
        else:
            merged = merge.campaign_rows(rows, campaign_id, kind.name_field)
        return merged.order_by(*merge.campaign_first(*kind.order))

    def shown(self, rows: QuerySet[Any], params: QueryDict) -> QuerySet[Any]:
        """What the list keeps of its merged rows (the bestiary's `?exclude_type=`)."""
        return rows

    def row_serializer(self, kind: "CatalogueKindSpec", params: QueryDict) -> type[Serializer]:
        """The serializer of the list's rows (the bestiary's `?view=summary`)."""
        return kind.row_serializer

    def read(self, rows: QuerySet[Any]) -> QuerySet[Any]:
        """The list's rows with what its serializer reads."""
        return rows

    def detail_rows(self, kind: "CatalogueKindSpec") -> QuerySet[Any]:
        """Entries with what the detail (and a write's answer) reads."""
        return self.rows(kind)

    def write_rows(self, kind: "CatalogueKindSpec") -> QuerySet[Any]:
        """Entries an edit or a delete may find."""
        return kind.model._default_manager.all()

    def missing_campaign(self) -> None:
        """A create that names no campaign: there is nothing to add it to."""
        raise NotFound("Not found")

    def check_edit_body(self, request: Request, entry: Any) -> None:
        """Runs before an edit (PUT, PATCH) loads the caller's access."""

    def refuse_write(self, entry: Any, action: str = "edit") -> None:
        """Runs once the caller is known to be a member, before the method's rule: an entry `action` (edit, delete,
        revert, restore) may not touch."""

    def create(self, serializer: Serializer, campaign_id: int) -> Model:
        entry: Model = serializer.save(campaign_id=campaign_id)
        return entry

    def update(self, entry: Any, serializer: Serializer) -> None:
        serializer.save()

    def delete(self, entry: Any) -> None:
        entry.delete()

    def back_to_book(self, campaign_id: int) -> None:
        """Runs after one of the campaign's entries went back to the book (a Revert, a removal restored)."""


class ItemHooks(CatalogueHooks):
    def read(self, rows: QuerySet[Any]) -> QuerySet[Any]:
        return item_rows(rows)

    def detail_rows(self, kind: "CatalogueKindSpec") -> QuerySet[Any]:
        return item_rows()

    def refuse_write(self, entry: Any, action: str = "edit") -> None:
        if entry.generated_effect_key and action != "edit":  # an edit detaches the clone (versions.editable)
            raise PermissionDenied(HOUSE_RULE_ITEM)

    def create(self, serializer: Serializer, campaign_id: int) -> Model:
        return item_writes.create_item(campaign_id, serializer.validated_data)

    def update(self, entry: Any, serializer: Serializer) -> None:
        item_writes.update_item(entry, serializer.validated_data)

    def back_to_book(self, campaign_id: int) -> None:
        """The campaign's item-effect house rules apply to a book item again once its version or removal is gone."""
        from apps.campaigns.services.house_rules import resync_campaign  # campaigns -> items -> catalogue

        resync_campaign(campaign_id)


class BestiaryHooks(CatalogueHooks):
    """The Bestiary page's list leaves out a type and the descriptions it doesn't show (PERF-47): additive query
    parameters, so the default list is unchanged."""

    def shown(self, rows: QuerySet[Any], params: QueryDict) -> QuerySet[Any]:
        """`?exclude_type=` (repeatable, any case) leaves out entries of the type after the merge, as the page did."""
        for excluded in params.getlist("exclude_type"):
            if excluded.strip():
                rows = rows.exclude(type__iexact=excluded.strip())
        return rows

    def row_serializer(self, kind: "CatalogueKindSpec", params: QueryDict) -> type[Serializer]:
        """`?view=summary`: each row without its description; any other view is the default row."""
        return BestiaryEntryBriefRowSerializer if params.get("view") == "summary" else kind.row_serializer

    def detail_rows(self, kind: "CatalogueKindSpec") -> QuerySet[Any]:
        return entry_details()

    def create(self, serializer: Serializer, campaign_id: int) -> Model:
        return bestiary_writes.create_entry(campaign_id, serializer.validated_data)

    def update(self, entry: Any, serializer: Serializer) -> None:
        bestiary_writes.update_entry(entry, serializer.validated_data)


class HirelingProfileHooks(CatalogueHooks):
    """Hired swords and dramatis personae (apps/hirelings): their race and restrictions with the list, their links
    with the detail, and writes that save their links too."""

    def __init__(self, model: type[HirelingProfile]) -> None:
        self.model = model

    def read(self, rows: QuerySet[Any]) -> QuerySet[Any]:
        return hireling_selectors.profile_rows(rows)

    def detail_rows(self, kind: "CatalogueKindSpec") -> QuerySet[Any]:
        return hireling_selectors.profile_details(self.model)

    def create(self, serializer: Serializer, campaign_id: int) -> Model:
        return hireling_writes.create_profile(self.model, campaign_id, serializer.validated_data)

    def update(self, entry: Any, serializer: Serializer) -> None:
        hireling_writes.update_profile(entry, serializer.validated_data)


class RaceHooks(CatalogueHooks):
    def check_edit_body(self, request: Request, entry: Any) -> None:
        sent = request.data.get("campaign_id")
        if sent and str(sent) != str(entry.campaign_id):  # an edit naming another campaign (BUG-147)
            raise NotFound("Not found")


class ItemPropertyHooks(CatalogueHooks):
    def listed(
        self, kind: "CatalogueKindSpec", rows: QuerySet[Any], campaign_id: int | None, params: QueryDict
    ) -> QuerySet[Any]:
        """The book's properties and the campaign's side by side: a property overrides nothing."""
        scope = (
            Q(campaign__isnull=True) if campaign_id is None else Q(campaign_id=campaign_id) | Q(campaign__isnull=True)
        )
        return rows.filter(scope).order_by(*kind.order)

    def missing_campaign(self) -> None:
        raise CampaignRequired()
