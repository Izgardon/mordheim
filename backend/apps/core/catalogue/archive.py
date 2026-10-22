"""Deleting, archiving, removing and restoring catalogue entries (decision 5; CAT-TWEAK-04, CAT-NEW-05, BUG-16).

A campaign's custom entry is deleted when nothing holds it, and archived when something does (`archived_at`): it
leaves the campaign's lists, shops and pickers, and every copy stays valid. A book entry is never deleted: deleting
it for a campaign writes a `CatalogueRemoval`, which hides it from that campaign alone, whatever holds it; the book
and every other campaign keep it. A version is reverted, not deleted. Restore undoes an archive or a removal. Each
runs in one transaction that bumps the campaign's catalogue version (cache.py), and the answer says what happened,
with the usage the page shows ("Used by 3 units in 2 warbands").
"""

from typing import TYPE_CHECKING, Any

from django.db import models, transaction
from django.utils import timezone

from apps.core.errors import ApiError
from apps.core.models import CatalogueRemoval

from .cache import bump
from .kinds import entry_kind
from .usage import count_usage
from .versions import entry_of

if TYPE_CHECKING:
    from .kinds import CatalogueKindSpec

USE_REVERT = "This entry is (or has) the campaign's version of a book entry: revert it instead of deleting it."


def delete_entry(
    kind: "CatalogueKindSpec", row: Any, campaign_id: int, user: Any, socket_id: str | None = None
) -> dict[str, Any] | None:
    """Delete, archive or remove the entry for the campaign; the answer's body, None when it was deleted."""
    entry, owner = entry_of(kind, row), entry_kind(kind)
    is_version = entry.campaign_id is not None and entry.replaces_id is not None
    manager = owner.model._default_manager
    has_version = entry.campaign_id is None and manager.filter(campaign_id=campaign_id, replaces=entry).exists()
    if is_version or has_version:  # the list shows the version: Revert is the way back to the book
        raise ApiError(USE_REVERT, code="use_revert", status=409)
    with transaction.atomic():
        if entry.campaign_id is None:
            CatalogueRemoval.objects.get_or_create(
                campaign_id=campaign_id, kind=owner.key, entry_id=entry.pk, defaults={"removed_by": user}
            )
            outcome = "removed"
        elif _deleted(kind, row):
            outcome = "deleted"
        else:
            owner.model._default_manager.filter(pk=entry.pk, archived_at__isnull=True).update(
                archived_at=timezone.now(), archived_by=user
            )
            outcome = "archived"
        bump(campaign_id, *kind.changed_lists, socket_id=socket_id)
    if outcome == "deleted":
        return None
    return {"outcome": outcome, "usage": count_usage(owner, entry.pk, campaign_id)}


def _deleted(kind: "CatalogueKindSpec", row: Any) -> bool:
    """Delete the entry unless something holds it (RESTRICT: nothing is deleted then)."""
    try:
        with transaction.atomic():
            kind.hooks.delete(row)
    except models.RestrictedError:
        return False
    return True


def restore(kind: "CatalogueKindSpec", row: Any, campaign_id: int, socket_id: str | None = None) -> None:
    """Bring back an archived entry, or a book entry removed for the campaign (nothing to do otherwise)."""
    entry, owner = entry_of(kind, row), entry_kind(kind)
    with transaction.atomic():
        if entry.campaign_id is None:
            CatalogueRemoval.objects.filter(campaign_id=campaign_id, kind=owner.key, entry_id=entry.pk).delete()
            owner.hooks.back_to_book(campaign_id)
        else:
            owner.model._default_manager.filter(pk=entry.pk).update(archived_at=None, archived_by=None)
            entry.archived_at, entry.archived_by_id = None, None
        bump(campaign_id, *kind.changed_lists, socket_id=socket_id)
