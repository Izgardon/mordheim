"""No two entries of a kind share a name in a campaign's catalogue (decisions 1 and 2, CAT-TWEAK-02).

A name is taken when an entry of the kind already has it, compared trimmed and in any case, whatever its type: one
of the campaign's (archived ones included, which Restore brings back) or one of the book's (removed for the campaign
or not). Bestiary entries and hired swords share their names. A create of a taken name answers 400 `name_taken` with
every match, so the page can offer "Edit this instead"; an edit may keep its own name, or take back the name of the
book entry it replaces. Two creates of one exact name at once meet the database's constraint, which answers the same
way (the 400 `duplicate_entry` of PR A is retired: every duplicate it caught is a taken name).
"""

from collections.abc import Iterable
from typing import TYPE_CHECKING, Any, NoReturn

from django.db.models import Exists, F, OuterRef, Q
from django.db.models.functions import Lower, Trim

from apps.core.errors import ApiError
from apps.core.models import CatalogueRemoval

from .kinds import entry_kind

if TYPE_CHECKING:
    from .kinds import CatalogueKindSpec


def matches(
    kind: "CatalogueKindSpec", campaign_id: int, name: str, allowed: Iterable[Any] = ()
) -> list[dict[str, Any]]:
    """The book's and the campaign's entries of the kind named `name` (trimmed, any case), but `allowed` (entry-table
    ids), as `{kind, id, name, type, source, archived}`: one query."""
    owner = entry_kind(kind)
    rows = owner.model._default_manager.annotate(folded=Lower(Trim("name"))).filter(
        Q(campaign__isnull=True) | Q(campaign_id=campaign_id), folded=name.strip().lower()
    )
    if owner.excluded_types:
        rows = rows.exclude(type__in=owner.excluded_types)
    removed = CatalogueRemoval.objects.filter(campaign_id=campaign_id, kind=owner.key, entry_id=OuterRef("pk"))
    allowed = list(allowed)  # and the campaign's version of an allowed book entry
    rows = rows.exclude(pk__in=allowed).exclude(replaces_id__in=allowed).annotate(removed=Exists(removed))
    has_type = any(field.name == "type" for field in owner.model._meta.fields)
    columns = ["id", "name", "campaign_id", "archived_at", "removed", *(["type"] if has_type else [])]
    if owner.key == "bestiary":
        rows = rows.annotate(profile_id=F("hired_sword_profile__id"))
        columns.append("profile_id")
    found = rows.order_by(F("campaign_id").asc(nulls_last=True), "name", "id").values(*columns)
    return [_match(owner.key, row) for row in found]


def _match(key: str, row: dict[str, Any]) -> dict[str, Any]:
    profile_id = row.get("profile_id")
    return {
        "kind": "hired_swords" if profile_id else key,
        "id": profile_id or row["id"],
        "name": row["name"],
        "type": row.get("type"),
        "source": "book" if row["campaign_id"] is None else "campaign",
        "archived": bool(row["archived_at"] or row["removed"]),  # archived, or a book entry removed for the campaign
    }


def refuse(kind: "CatalogueKindSpec", name: str, found: list[dict[str, Any]]) -> NoReturn:
    """400 `name_taken` naming every match."""
    labels = [match["type"] or match["source"] for match in found[:2]]
    more = f" and {len(found) - 2} more" if len(found) > 2 else ""
    listed = f": {', '.join(labels)}{more}" if labels else ""
    detail = f"{name.strip()} is already in the catalogue{listed}. Edit {'it' if len(found) < 2 else 'one'} instead."
    raise ApiError(detail, code="name_taken", fields={"name": [detail]}, matches=found)


def check_create(kind: "CatalogueKindSpec", campaign_id: int, name: str) -> None:
    found = matches(kind, campaign_id, name)
    if found:
        refuse(kind, name, found)


def check_edit(kind: "CatalogueKindSpec", entry: Any, campaign_id: int, name: str | None) -> None:
    """An edit of `entry` (an entry-table row: a book entry being versioned, a version, a custom entry) to `name`:
    its own name, and the name of the book entry it is or replaces, stay allowed."""
    if name is None or name.strip().lower() == entry.name.strip().lower():
        return
    book = entry if entry.campaign_id is None else entry.replaces
    if book is not None and name.strip().lower() == book.name.strip().lower():
        return
    found = matches(kind, campaign_id, name, allowed=[entry.pk, *([book.pk] if book is not None else [])])
    if found:
        refuse(kind, name, found)
