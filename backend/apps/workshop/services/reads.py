"""Reading a player's workshop (`GET workshop/`), what a code shares (the preview anyone signed in reads, and where
every import starts) and the workshop's own lists. A fixed number of queries whatever their number.

A deleted warband (its Delete) and an archived list (the catalogue's Delete of one a warband uses; one nothing uses is
gone) are gone: not listed, and their codes find nothing. So is everything in the workshop of a deleted account.
Copies made from them stay.
"""

from dataclasses import dataclass
from typing import Any

from django.db.models import Count, Prefetch, Q, QuerySet

from apps.campaigns.errors import CampaignError
from apps.campaigns.models import WORKSHOP, Campaign
from apps.core.share_codes import normalised
from apps.users.names import display_name
from apps.warband_templates.models import WarbandTemplate, WarbandTemplateType
from apps.warbands.models import Warband
from apps.warbands.services.roster_cost import RosterValue, roster_values

from .making import workshop_of

NO_SUCH_CODE = "No warband or warband list has that code. Check it with whoever shared it."
LIVE_WORKSHOP = {"campaign__kind": WORKSHOP, "campaign__deleted_at__isnull": True}


def live_warbands() -> QuerySet[Warband]:
    """Warbands in live workshops, not deleted, read with their type and their workshop's settings."""
    rows = Warband.objects.filter(in_workshop=True, deleted_at__isnull=True, **LIVE_WORKSHOP)
    return rows.select_related("warband_type", "campaign", "campaign__settings", "user")


def live_lists() -> QuerySet[WarbandTemplate]:
    """Lists in live workshops (a workshop's own templates), not archived, read with the types they serve."""
    types = Prefetch("type_links", WarbandTemplateType.objects.select_related("warband_type").order_by("id"))
    rows = WarbandTemplate.objects.filter(archived_at__isnull=True, **LIVE_WORKSHOP)
    return rows.select_related("campaign__workshop_owner").prefetch_related(types)


@dataclass(frozen=True)
class Shared:
    """What a code shares: a warband or a list."""

    warband: Warband | None = None
    template: WarbandTemplate | None = None


def shared(code: Any) -> Shared:
    """The live warband or list with this code, or a 404 `code_not_found` in the server's words (one query for a
    warband's, three for a list's)."""
    wanted = normalised(code)
    warband = live_warbands().filter(share_code=wanted).first() if wanted else None
    if warband is not None:
        return Shared(warband=warband)
    template = live_lists().filter(share_code=wanted).first() if wanted else None
    if template is None:
        raise CampaignError(NO_SUCH_CODE, code="code_not_found", status=404)
    return Shared(template=template)


def type_names(template: WarbandTemplate) -> list[dict[str, Any]]:
    return [
        {"id": link.warband_type_id, "name": link.warband_type.name, "variant": link.variant}
        for link in template.type_links.all()
    ]


def warband_row(warband: Warband, value: RosterValue) -> dict[str, Any]:
    return {
        "id": warband.pk,
        "campaign_id": warband.campaign_id,
        "name": warband.name,
        "warband_type": (
            {"id": warband.warband_type_id, "name": warband.warband_type.name} if warband.warband_type else None
        ),
        "template_id": warband.template_id,
        "cost": value.cost,
        "budget": value.budget,
        "share_code": warband.share_code,
        "updated_at": warband.updated_at,
    }


def list_row(template: WarbandTemplate) -> dict[str, Any]:
    return {
        "id": template.pk,
        "campaign_id": template.campaign_id,
        "name": template.name,
        "warband_types": type_names(template),
        "variants": list(template.variants),
        "share_code": template.share_code,
        "updated_at": template.updated_at,
    }


def warband_rows(warbands: list[Warband]) -> list[dict[str, Any]]:
    """The warbands as `GET workshop/` lists them, each with its cost and budget (at most five queries)."""
    values = roster_values(warbands)
    return [warband_row(warband, values[warband.pk]) for warband in warbands]


def mine(user: Any) -> dict[str, Any]:
    """The player's workshop: its id (null before his first use), his warbands and his lists, newest first (at most
    eight queries, whatever their number)."""
    workshop = workshop_of(user)
    if workshop is None:
        return {"id": None, "warbands": [], "lists": []}
    warbands = list(live_warbands().filter(campaign=workshop).order_by("-created_at", "-id"))
    lists = live_lists().filter(campaign=workshop).order_by("-id")
    return {"id": workshop.pk, "warbands": warband_rows(warbands), "lists": [list_row(row) for row in lists]}


def preview(code: Any) -> dict[str, Any]:
    """What a code shares, for anyone signed in: what it is, its name and maker, and a warband's type, cost, budget
    and how many heroes, henchmen and hired swords it has, or a list's types and variants (at most eight queries)."""
    found = shared(code)
    if found.template is not None:
        template = found.template
        owner = template.campaign.workshop_owner if template.campaign else None
        row = list_row(template)
        picked = ("name", "share_code", "warband_types", "variants")
        return {"kind": "list", "maker": display_name(owner) if owner else "", **{key: row[key] for key in picked}}
    warband = found.warband
    assert warband is not None
    row = warband_rows([warband])[0]
    shown = ("name", "share_code", "warband_type", "cost", "budget")
    body = {"kind": "warband", "maker": display_name(warband.user), **{key: row[key] for key in shown}}
    return {**body, **_counts(warband)}


def _alive(prefix: str) -> Q:
    return Q(**{f"{prefix}dead": False, f"{prefix}dismissed_at__isnull": True})


def _counts(warband: Warband) -> dict[str, int]:
    """How many heroes, henchmen (models) and hired swords are on its roster (one query)."""
    members = _alive("henchmen_groups__") & _alive("henchmen_groups__henchmen__")
    counted = {
        "heroes": Count("heroes", filter=_alive("heroes__"), distinct=True),
        "henchmen": Count("henchmen_groups__henchmen", filter=members, distinct=True),
        "hired_swords": Count("hirelings", filter=_alive("hirelings__"), distinct=True),
    }
    row = Warband.objects.filter(pk=warband.pk).aggregate(**counted)
    return {key: int(row.get(key) or 0) for key in counted}


def my_list(workshop: Campaign, template_id: Any) -> WarbandTemplate | None:
    """One of the workshop's live lists by id, or None (one query)."""
    return WarbandTemplate.objects.filter(pk=template_id, campaign=workshop, archived_at__isnull=True).first()
