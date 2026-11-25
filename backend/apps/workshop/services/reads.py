"""Reading workshops: the caller's own (`GET workshop/`), one shared by its code (the preview anyone signed in reads,
and what every import starts from), and deleting one. A fixed number of queries whatever their number.

A deleted workshop is gone: not listed, not readable, its code finds nothing (copies made from it stay).
"""

from dataclasses import dataclass
from typing import Any

from django.db.models import Count, Prefetch, Q, QuerySet
from django.utils import timezone

from apps.campaigns.constants import OWNER
from apps.campaigns.errors import CampaignError
from apps.campaigns.models import HOLDS_LIST, HOLDS_WARBAND, WORKSHOP, Campaign, CampaignMembership
from apps.users.names import display_name
from apps.warband_templates.models import WarbandTemplate, WarbandTemplateType
from apps.warbands.models import Warband
from apps.warbands.services.roster_cost import roster_values

NO_SUCH_CODE = "No warband or warband list has that code. Check it with whoever shared it."


def live_workshops() -> QuerySet[Campaign]:
    return Campaign.objects.filter(kind=WORKSHOP, deleted_at__isnull=True)


def owned_by(user: Any) -> QuerySet[Campaign]:
    return live_workshops().filter(memberships__user=user, memberships__role__slug=OWNER)


def normalised(code: Any) -> str:
    return str(code or "").strip().upper().replace(" ", "").replace("-", "")


def shared(code: Any) -> Campaign:
    """The live workshop with this code, or a 404 `code_not_found` in the server's words (one query)."""
    found = live_workshops().filter(share_code=normalised(code)).select_related("settings").first()
    if found is None:
        raise CampaignError(NO_SUCH_CODE, code="code_not_found", status=404)
    return found


@dataclass(frozen=True)
class Held:
    """What each workshop holds: its warband (read with its type and campaign settings) or its list."""

    warbands: dict[int, Warband]
    lists: dict[int, WarbandTemplate]


def held(workshops: list[Campaign]) -> Held:
    """Each workshop's warband or list (two queries)."""
    warband_ids = [w.pk for w in workshops if w.holds == HOLDS_WARBAND]
    list_ids = [w.pk for w in workshops if w.holds == HOLDS_LIST]
    warbands = Warband.objects.filter(campaign_id__in=warband_ids).select_related(
        "warband_type", "campaign", "campaign__settings"
    )
    types = Prefetch("type_links", WarbandTemplateType.objects.select_related("warband_type").order_by("id"))
    templates = WarbandTemplate.objects.filter(campaign_id__in=list_ids).prefetch_related(types).order_by("id")
    lists: dict[int, WarbandTemplate] = {}
    for template in templates:
        lists.setdefault(int(template.campaign_id or 0), template)
    return Held(warbands={w.campaign_id: w for w in warbands} if warband_ids else {}, lists=lists)


def type_names(template: WarbandTemplate) -> list[dict[str, Any]]:
    return [{"id": link.warband_type_id, "name": link.warband_type.name} for link in template.type_links.all()]


def warband_row(workshop: Campaign, warband: Warband | None, value: Any) -> dict[str, Any]:
    return {
        "id": workshop.pk,
        "campaign_id": workshop.pk,
        "warband_id": warband.pk if warband else None,
        "name": warband.name if warband else workshop.name,
        "warband_type": (
            {"id": warband.warband_type_id, "name": warband.warband_type.name}
            if warband and warband.warband_type
            else None
        ),
        "cost": value.cost if value else 0,
        "budget": value.budget if value else 0,
        "share_code": workshop.share_code,
        "updated_at": max(workshop.updated_at, warband.updated_at) if warband else workshop.updated_at,
    }


def list_row(workshop: Campaign, template: WarbandTemplate | None) -> dict[str, Any]:
    return {
        "id": workshop.pk,
        "campaign_id": workshop.pk,
        "template_id": template.pk if template else None,
        "name": template.name if template else workshop.name,
        "warband_types": type_names(template) if template else [],
        "share_code": workshop.share_code,
        "updated_at": max(workshop.updated_at, template.updated_at or workshop.updated_at)
        if template
        else workshop.updated_at,
    }


def mine(user: Any) -> dict[str, list[dict[str, Any]]]:
    """The user's workshops, newest first: `{warbands, lists}` (eight queries)."""
    workshops = list(owned_by(user).order_by("-created_at", "-id"))
    found = held(workshops)
    values = roster_values(found.warbands.values())
    warbands = []
    for workshop in workshops:
        if workshop.holds == HOLDS_WARBAND:
            warband = found.warbands.get(workshop.pk)
            warbands.append(warband_row(workshop, warband, values.get(warband.pk) if warband else None))
    lists = [list_row(w, found.lists.get(w.pk)) for w in workshops if w.holds == HOLDS_LIST]
    return {"warbands": warbands, "lists": lists}


def preview(code: Any) -> dict[str, Any]:
    """What a code shares, for anyone signed in: what it holds, its name and maker, and a warband's type, cost,
    budget and how many heroes, henchmen and hired swords it has, or a list's types (at most eight queries)."""
    workshop = shared(code)
    owner = CampaignMembership.objects.filter(campaign=workshop, role__slug=OWNER).select_related("user").first()
    found = held([workshop])
    body: dict[str, Any] = {
        "kind": workshop.holds,
        "share_code": workshop.share_code,
        "maker": display_name(owner.user) if owner else "",
    }
    if workshop.holds == HOLDS_LIST:
        template = found.lists.get(workshop.pk)
        row = list_row(workshop, template)
        return {**body, "name": row["name"], "warband_types": row["warband_types"]}
    warband = found.warbands.get(workshop.pk)
    value = roster_values([warband])[warband.pk] if warband else None
    row = warband_row(workshop, warband, value)
    counts = _counts(warband) if warband else dict.fromkeys(("heroes", "henchmen", "hired_swords"), 0)
    picked = ("name", "warband_type", "cost", "budget")
    return {**body, **{key: row[key] for key in picked}, **counts}


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


def delete(workshop: Campaign) -> None:
    """Soft delete: hidden, unreadable and its code no longer found; copies made from it stay."""
    Campaign.objects.filter(pk=workshop.pk, deleted_at__isnull=True).update(deleted_at=timezone.now())
