"""The shared catalogue cache (the workshop plan, "Speed and longevity"): one list body for every campaign that holds
nothing of its own for the kind, keyed by the settings in play rather than by the campaign.

What a campaign's list body holds, kind by kind (views.list_data and hooks.py):
- its rows: the campaign's own entries and versions, and the book's it has not replaced or removed (merge.py), its
  archived and removed ones with `?archived=1`;
- each row's `in_play`, and a template's types' `in_play`, by the settings it ticked (every one in a workshop);
- what another kind's campaign rows make of a row: a skill group's skills as the campaign's versions of them
  (`CatalogueKindSpec.reads_campaign`);
- the badges, which are each row's own (its `replaces`, archive, who wrote it, its book entry's fields).
Nothing else in a list reads the campaign: no usage, no counts, no member.

So a campaign with **no rows of its own in the kind's table** (own entries, versions, archived ones), no removal of a
book entry of the kind, and none in the tables its list reads too, shows the book's rows with their `in_play` by its
settings: exactly the body of every other such campaign ticking the same settings. Such a body is computed **from the
book and the settings alone** (`Ticked`, never the campaign's rows), so a write racing the read can never put one
campaign's entry into the body others are served. Whether a campaign is plain, the settings it ticked and the book's
version are read in the membership's one query (`shared_reads`), so a list served from the shared body costs that
query alone, as a campaign's own did. A workshop has every setting in play, so every plain workshop shares one.
"""

from collections.abc import Mapping
from typing import Any

from django.contrib.postgres.expressions import ArraySubquery
from django.db.models import BooleanField, Exists, ExpressionWrapper, OuterRef, Q, Subquery

from apps.campaigns.access import CampaignAccess
from apps.campaigns.in_play import Ticked
from apps.campaigns.models import CampaignCampaignType
from apps.core.models import BOOK, CatalogueRemoval, CatalogueVersion

from .specs import CatalogueKindSpec

HOLDS_OWN = "catalogue_holds_own"
TICKED = "catalogue_ticked"
BOOK_VERSION = "catalogue_book_version"


def shared_reads(kind: CatalogueKindSpec) -> Mapping[str, Any]:
    """The membership's annotations for a list of `kind`: whether the campaign holds rows of its own the list shows,
    the settings it ticked and the book's version (subqueries of the one query)."""
    campaign = OuterRef("campaign_id")
    own = Q(Exists(CatalogueRemoval.objects.filter(campaign_id=campaign, kind=kind.key)))
    for model in (kind.model, *kind.reads_campaign):
        own |= Q(Exists(model._default_manager.filter(campaign_id=campaign)))
    ticked = CampaignCampaignType.objects.filter(campaign_id=campaign).order_by("campaign_type_id")
    return {
        HOLDS_OWN: ExpressionWrapper(own, output_field=BooleanField()),
        TICKED: ArraySubquery(ticked.values("campaign_type_id")),
        BOOK_VERSION: Subquery(CatalogueVersion.objects.filter(pk=BOOK).values("version")[:1]),
    }


def shared_scope(access: CampaignAccess) -> tuple[Ticked, Any] | None:
    """The settings a plain campaign's list is shared by and the book's version, or None when the campaign holds
    rows of its own for it (or has no settings row, or the book no version: then nothing is cached)."""
    membership = access.membership
    if getattr(membership, HOLDS_OWN, True) or access.settings is None:
        return None
    book = getattr(membership, BOOK_VERSION, None)
    if book is None:
        return None
    if access.workshop:
        return Ticked(None), book
    return Ticked(frozenset(getattr(membership, TICKED, None) or ())), book
